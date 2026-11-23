import { FindManyOptions, FindOperator, In, Repository } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';

import { LobbiesService } from './lobbies.service';
import { Lobby, LobbyVisibility } from './lobby.entity';
import { UsersService } from '../users/users.service';
import { LobbyMember, LobbyMemberRole } from './lobby-member.entity';
import { MAX_RECOMMENDATION_CANDIDATES } from '../recommendations/recommendation.config';

describe('LobbiesService', () => {
  it('returns the authenticated user’s lobby roles without exposing user or lobby data', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        lobby: { id: 'lobby', details: 'private' },
        role: LobbyMemberRole.HOST,
        user: { email: 'private' },
      },
    ]);
    const service = new LobbiesService(
      { manager: { find } } as unknown as Repository<Lobby>,
      {} as UsersService,
    );
    await expect(service.findMyMemberships('user')).resolves.toEqual([
      { lobbyId: 'lobby', role: 'host' },
    ]);
    expect(find).toHaveBeenCalledWith(LobbyMember, {
      where: { user: { id: 'user' } },
      relations: { lobby: true },
    });
  });
  function setup() {
    const find = jest
      .fn<Promise<Lobby[]>, [FindManyOptions<Lobby>]>()
      .mockResolvedValue([]);
    const query = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const repository = {
      find,
      manager: { getRepository: () => ({ createQueryBuilder: () => query }) },
    } as unknown as Repository<Lobby>;

    const usersService = {
      findOne: jest.fn(),
    } as unknown as UsersService;

    const service = new LobbiesService(repository, usersService);

    return { service, find, query };
  }

  it('counts every membership including the host with a grouped query', async () => {
    const { service, find, query } = setup();
    find.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as Lobby[]);
    query.getRawMany.mockResolvedValue([{ lobbyId: 'a', count: '3' }]);
    const result = await service.findAll();
    expect(result.map(({ id, memberCount }) => ({ id, memberCount }))).toEqual([
      { id: 'a', memberCount: 3 },
      { id: 'b', memberCount: 0 },
    ]);
    expect(query.groupBy).toHaveBeenCalledWith('member.lobby_id');
    expect(query.where).toHaveBeenCalledWith(
      'member.lobby_id IN (:...lobbyIds)',
      { lobbyIds: ['a', 'b'] },
    );
    expect(query.getRawMany).toHaveBeenCalledTimes(1);
  });

  it('does not query counts when no lobbies are visible', async () => {
    const { service, query } = setup();
    expect(await service.findAll()).toEqual([]);
    expect(query.getRawMany).not.toHaveBeenCalled();
  });

  it('lists only public lobbies and the authenticated user’s memberships', async () => {
    const { service, find } = setup();
    jest
      .spyOn(service, 'findMyMemberships')
      .mockResolvedValue([
        { lobbyId: 'private-id', role: LobbyMemberRole.MEMBER },
      ]);
    await service.findAll({}, 'user');
    expect(find.mock.calls[0][0].where).toEqual([
      { visibility: LobbyVisibility.PUBLIC },
      { id: In(['private-id']) },
    ]);
  });

  it('should retrieve all lobbies without filters', async () => {
    const { service, find } = setup();

    const result = await service.findAll();

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { visibility: LobbyVisibility.PUBLIC },
        order: { createdAt: 'DESC' },
        relations: { host: true },
      }),
    );
    expect(find.mock.calls[0][0].select).toMatchObject({
      host: { id: true, username: true },
    });

    expect(result).toEqual([]);
  });

  it('rejects creation when the host already belongs to a lobby', async () => {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'user' }),
      findOne: jest.fn().mockResolvedValue({ id: 'membership' }),
      create: jest.fn(),
      transaction: jest.fn(),
    };
    manager.transaction.mockImplementation(
      (work: (value: unknown) => unknown) => work(manager),
    );
    const service = new LobbiesService(
      { manager } as unknown as Repository<Lobby>,
      {
        findOne: jest.fn().mockResolvedValue({ id: 'user' }),
      } as unknown as UsersService,
    );
    await expect(
      service.create({ lobbyName: 'Test', details: 'Test' }, 'user'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.create).not.toHaveBeenCalled();
  });

  it('canonicalizes the game and needed roles on creation', async () => {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'user' }),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn().mockResolvedValue({ id: 'lobby' }),
      transaction: jest.fn(),
    };
    manager.transaction.mockImplementation(
      (work: (value: unknown) => unknown) => work(manager),
    );
    const service = new LobbiesService(
      { manager } as unknown as Repository<Lobby>,
      {
        findOne: jest.fn().mockResolvedValue({ id: 'user' }),
      } as unknown as UsersService,
    );

    await service.create(
      {
        lobbyName: 'Test',
        details: 'Test',
        game: 'csgo',
        neededRoles: ['support', 'Entry'],
      },
      'user',
    );

    expect(manager.create).toHaveBeenCalledWith(
      Lobby,
      expect.objectContaining({
        game: 'CS2',
        neededRoles: ['Support', 'Entry'],
      }),
    );
  });

  it('rejects needed roles that are not valid for the game', async () => {
    const service = new LobbiesService(
      { manager: {} } as unknown as Repository<Lobby>,
      {
        findOne: jest.fn().mockResolvedValue({ id: 'user' }),
      } as unknown as UsersService,
    );

    await expect(
      service.create(
        {
          lobbyName: 'Test',
          details: 'Test',
          game: 'CS2',
          neededRoles: ['Controller'],
        },
        'user',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should filter lobbies by game and skill level', async () => {
    const { service, find } = setup();

    await service.findAll({
      game: 'Valorant',
      skillLevel: 'Beginner',
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
      }),
    );

    const [options] = find.mock.calls[0];
    const where = options.where as {
      game?: FindOperator<string>;
      skillLevel?: string;
      visibility?: LobbyVisibility;
    };
    expect(where.skillLevel).toBe('Beginner');
    expect(where.visibility).toBe(LobbyVisibility.PUBLIC);
    expect(where.game).toBeInstanceOf(FindOperator);
    expect(where.game?.getSql?.('lobby.game')).toContain('LOWER(lobby.game)');
  });

  it('should filter lobbies by game only', async () => {
    const { service, find } = setup();

    await service.findAll({
      game: 'Valorant',
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
      }),
    );

    const [options] = find.mock.calls[0];
    const where = options.where as {
      game?: FindOperator<string>;
      visibility?: LobbyVisibility;
    };
    expect(where.visibility).toBe(LobbyVisibility.PUBLIC);
    expect(where.game).toBeInstanceOf(FindOperator);
    expect(where.game?.getSql?.('lobby.game')).toContain('LOWER(lobby.game)');
  });

  function setupRecommendationCandidates() {
    const query = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => query),
      manager: {
        getRepository: () => ({
          createQueryBuilder: () => ({
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          }),
        }),
      },
    } as unknown as Repository<Lobby>;
    return {
      query,
      service: new LobbiesService(repository, {} as UsersService),
    };
  }

  it('filters recommendation candidates by game in SQL before limiting', async () => {
    const { service, query } = setupRecommendationCandidates();

    await service.findRecommendationCandidates('viewer', 'lol');

    expect(query.andWhere).toHaveBeenCalledWith(
      'LOWER(lobby.game) IN (:...gameKeys)',
      { gameKeys: ['league of legends', 'league', 'lol'] },
    );
    expect(query.take).toHaveBeenCalledWith(MAX_RECOMMENDATION_CANDIDATES);
  });

  it('keeps the public and freshness predicates for recommendation candidates', async () => {
    const { service, query } = setupRecommendationCandidates();

    await service.findRecommendationCandidates('viewer', 'Dota 2');

    expect(query.where).toHaveBeenCalledWith('lobby.visibility = :visibility', {
      visibility: LobbyVisibility.PUBLIC,
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'lobby.updatedAt >= :staleBefore',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed as any
      { staleBefore: expect.any(Date) },
    );
  });

  it('does not add a game predicate when no game is requested', async () => {
    const { service, query } = setupRecommendationCandidates();

    await service.findRecommendationCandidates('viewer');

    expect(query.andWhere).not.toHaveBeenCalledWith(
      'LOWER(lobby.game) IN (:...gameKeys)',
      expect.anything(),
    );
  });
});
