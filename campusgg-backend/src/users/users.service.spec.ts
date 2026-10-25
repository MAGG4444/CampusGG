import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService profile updates', () => {
  const update = jest.fn();
  const findOne = jest.fn();
  const service = new UsersService({
    update,
    findOne,
  } as unknown as Repository<User>);
  beforeEach(() => jest.resetAllMocks());

  it('updates only the supplied editable fields for the JWT user', async () => {
    update.mockResolvedValue({ affected: 1 });
    findOne.mockResolvedValue({
      id: 'alice',
      displayName: 'Alice',
      bio: 'New bio',
    });
    await service.updateProfile('alice', { bio: ' New bio ' });
    expect(update).toHaveBeenCalledWith('alice', { bio: 'New bio' });
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'alice' } });
  });

  it('does not write an empty partial update', async () => {
    findOne.mockResolvedValue({ id: 'alice' });
    await service.updateProfile('alice', {});
    expect(update).not.toHaveBeenCalled();
  });

  it('returns not found for a removed account', async () => {
    update.mockResolvedValue({ affected: 0 });
    await expect(service.updateProfile('missing', { bio: '' })).rejects.toThrow(
      'User not found',
    );
  });
});
