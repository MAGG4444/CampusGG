import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Connection } from './connection.entity';
import {
  connectionPairKey,
  ConnectionsService,
  relationshipFor,
} from './connections.service';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const D = '00000000-0000-4000-8000-000000000004';

function person(id: string, username: string, verified = true): User {
  return {
    id,
    username,
    displayName: username,
    email: `${username}@purdue.edu`,
    eduVerified: verified,
    verificationToken: null,
    tokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    password: 'private-hash',
  };
}

// In-memory repository doubles exercise service decisions and conditional
// writes. The real PostgreSQL constraint still needs an integration test.
describe('ConnectionsService', () => {
  let service: ConnectionsService;
  let rows: Connection[];
  let people: User[];
  let insert: jest.Mock;
  let update: jest.Mock;
  let remove: jest.Mock;
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    rows = [];
    people = [
      person(A, 'alpha'),
      person(B, 'beta'),
      person(C, 'gamma'),
      person(D, 'unverified', false),
    ];
    const matches = (row: Connection, filter: Partial<Connection>) =>
      Object.entries(filter).every(
        ([key, value]) => row[key as keyof Connection] === value,
      );
    insert = jest.fn().mockImplementation((data: Partial<Connection>) => {
      if (rows.some((row) => row.pairKey === data.pairKey)) {
        return Promise.reject(
          Object.assign(new Error('Duplicate pair'), { code: '23505' }),
        );
      }
      rows.push({
        ...data,
        id: 'connection-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        requester: people.find((p) => p.id === data.requesterId),
        recipient: people.find((p) => p.id === data.recipientId),
      } as Connection);
      return Promise.resolve({});
    });
    update = jest
      .fn()
      .mockImplementation(
        (filter: Partial<Connection>, data: Partial<Connection>) => {
          const row = rows.find((r) => matches(r, filter));
          if (row) Object.assign(row, data);
          return Promise.resolve({ affected: row ? 1 : 0 });
        },
      );
    remove = jest.fn().mockImplementation((filter: Partial<Connection>) => {
      const before = rows.length;
      rows = rows.filter((row) => !matches(row, filter));
      return Promise.resolve({ affected: before - rows.length });
    });
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([people[1]]),
    };
    const module = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest
              .fn()
              .mockImplementation(
                (where: { id: string; eduVerified: boolean }) =>
                  Promise.resolve(
                    people.find(
                      (p) =>
                        p.id === where.id &&
                        p.eduVerified === where.eduVerified,
                    ) ?? null,
                  ),
              ),
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Connection),
          useValue: {
            insert,
            update,
            delete: remove,
            findOneBy: jest
              .fn()
              .mockImplementation((filter: Partial<Connection>) =>
                Promise.resolve(rows.find((r) => matches(r, filter)) ?? null),
              ),
            find: jest
              .fn()
              .mockImplementation(
                ({ where }: { where: Partial<Connection>[] }) =>
                  Promise.resolve(
                    rows.filter((r) => where.some((f) => matches(r, f))),
                  ),
              ),
            findBy: jest.fn().mockImplementation(() => Promise.resolve(rows)),
          },
        },
      ],
    }).compile();
    service = module.get(ConnectionsService);
  });

  it('normalizes reversed pairs and rejects self-requests', async () => {
    expect(connectionPairKey(A, B)).toBe(connectionPairKey(B, A));
    await expect(service.request(A, A)).rejects.toThrow(BadRequestException);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects unverified viewers and targets', async () => {
    await expect(service.request(D, A)).rejects.toThrow(ForbiddenException);
    await expect(service.request(A, D)).rejects.toThrow(NotFoundException);
    expect(insert).not.toHaveBeenCalled();
  });

  it('starts with none and supports both sides of the complete friendship lifecycle', async () => {
    expect(await service.status(A, B)).toEqual({
      userId: B,
      relationship: 'none',
    });
    expect(await service.request(A, B)).toEqual({
      userId: B,
      relationship: 'outgoing',
    });
    expect(await service.status(B, A)).toEqual({
      userId: A,
      relationship: 'incoming',
    });
    expect((await service.list(A, 'outgoing')).items[0]).toMatchObject({
      id: B,
      relationship: 'outgoing',
    });
    expect((await service.list(B, 'incoming')).items[0]).toMatchObject({
      id: A,
      relationship: 'incoming',
    });
    expect((await service.list(A, 'friend')).items).toEqual([]);
    await service.accept(B, A);
    expect((await service.list(A, 'outgoing')).items).toEqual([]);
    expect((await service.list(B, 'incoming')).items).toEqual([]);
    expect((await service.list(A, 'friend')).items[0]).toMatchObject({
      id: B,
      relationship: 'friend',
    });
    expect((await service.list(B, 'friend')).items[0]).toMatchObject({
      id: A,
      relationship: 'friend',
    });
    await service.remove(A, B);
    expect(await service.status(B, A)).toEqual({
      userId: A,
      relationship: 'none',
    });
  });

  it('rejects duplicates in both directions and existing friendships', async () => {
    await service.request(A, B);
    await expect(service.request(A, B)).rejects.toThrow(ConflictException);
    await expect(service.request(B, A)).rejects.toThrow(ConflictException);
    await service.accept(B, A);
    await expect(service.request(A, B)).rejects.toThrow(ConflictException);
    expect(rows).toHaveLength(1);
  });

  it('only allows the recipient to accept or decline', async () => {
    await service.request(A, B);
    await expect(service.accept(A, B)).rejects.toThrow(NotFoundException);
    await expect(service.decline(A, B)).rejects.toThrow(NotFoundException);
    await expect(service.accept(C, A)).rejects.toThrow(NotFoundException);
    expect(rows[0].status).toBe('pending');
    await service.decline(B, A);
    expect(rows).toHaveLength(0);
  });

  it('only allows the requester to cancel, and accepts a fresh request later', async () => {
    await service.request(A, B);
    await expect(service.cancel(B, A)).rejects.toThrow(NotFoundException);
    await service.cancel(A, B);
    await service.request(B, A);
    expect(rows[0].requesterId).toBe(B);
  });

  it('cannot remove pending requests, or cancel/decline accepted friendships', async () => {
    await service.request(A, B);
    await expect(service.remove(A, B)).rejects.toThrow(NotFoundException);
    await service.accept(B, A);
    await expect(service.cancel(A, B)).rejects.toThrow(NotFoundException);
    await expect(service.decline(B, A)).rejects.toThrow(NotFoundException);
    await expect(service.remove(C, B)).rejects.toThrow(NotFoundException);
    await service.remove(B, A);
    expect(rows).toHaveLength(0);
  });

  it('does not return another pair’s relationship', async () => {
    await service.request(A, B);
    expect(relationshipFor(C, rows[0])).toBe('none');
    expect((await service.list(C, 'incoming')).items).toEqual([]);
  });

  it('returns public search fields and the current relationship only', async () => {
    await service.request(A, B);
    const result = await service.search(A, ' be ');
    expect(result.items).toEqual([
      {
        id: B,
        username: 'beta',
        name: 'beta',
        displayName: 'beta',
        bio: '',
        game: null,
        experienceLevel: null,
        relationship: 'outgoing',
      },
    ]);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.any(String), {
      q: 'be',
    });
    expect(queryBuilder.take).toHaveBeenCalledWith(30);
    await expect(service.search(A, ' ')).rejects.toThrow(BadRequestException);
  });
});
