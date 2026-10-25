import { ValidationPipe } from '@nestjs/common';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  const pipe = new ValidationPipe({
    expectedType: UpdateProfileDto,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validate = (body: unknown) => pipe.transform(body, { type: 'body' });

  it('normalizes names and games without adding omitted fields', async () => {
    const dto = (await validate({
      displayName: ' Player ',
      favoriteGames: [' Valorant '],
    })) as UpdateProfileDto;
    expect(dto.displayName).toBe('Player');
    expect(dto.favoriteGames).toEqual(['Valorant']);
    expect(dto.bio).toBeUndefined();
    expect(dto.skillLevel).toBeUndefined();
  });

  it.each([
    { id: 'another-user' },
    { username: 'other' },
    { email: 'other@example.edu' },
    { password: 'secret' },
    { eduVerified: true },
    { verificationToken: '123456' },
    { displayName: ' ' },
    { displayName: 'x'.repeat(101) },
    { displayName: null },
    { bio: null },
    { bio: 'x'.repeat(501) },
    { favoriteGames: 'Valorant' },
    { favoriteGames: ['Valorant', ' valorant '] },
    { favoriteGames: [''] },
    { favoriteGames: ['x'.repeat(51)] },
    { favoriteGames: [null] },
    { favoriteGames: Array.from({ length: 11 }, (_, i) => `Game ${i}`) },
    { skillLevel: 'Expert' },
    { skillLevel: null },
  ])('rejects invalid or unsupported fields: %j', async (body) => {
    await expect(validate(body)).rejects.toThrow();
  });

  it('accepts empty clearing values and an empty partial update', async () => {
    await expect(
      validate({ bio: '', favoriteGames: [], skillLevel: '' }),
    ).resolves.toBeDefined();
    await expect(validate({})).resolves.toBeDefined();
  });
});
