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

  it('normalizes editable values and structured gaming profiles', async () => {
    const dto = (await validate({
      displayName: ' Player ',
      gamingProfiles: [
        {
          game: ' Valorant ',
          preferredRoles: [' Controller ', 'Sentinel'],
          experienceLevel: 'Intermediate',
        },
      ],
    })) as UpdateProfileDto;

    expect(dto.displayName).toBe('Player');
    expect(dto.gamingProfiles).toEqual([
      {
        game: 'Valorant',
        preferredRoles: ['Controller', 'Sentinel'],
        experienceLevel: 'Intermediate',
      },
    ]);
    expect(dto.bio).toBeUndefined();
  });

  it.each([
    { id: 'another-user' },
    { username: 'other' },
    { email: 'other@example.edu' },
    { password: 'secret' },
    { eduVerified: true },
    { displayName: ' ' },
    { bio: null },
    { bio: 'x'.repeat(501) },
    { gamingProfiles: 'Valorant' },
    {
      gamingProfiles: Array.from({ length: 11 }, (_, index) => ({
        game: `Game ${index}`,
        preferredRoles: [],
        experienceLevel: 'Beginner',
      })),
    },
    {
      gamingProfiles: [
        { game: '', preferredRoles: [], experienceLevel: 'Beginner' },
      ],
    },
    {
      gamingProfiles: [
        {
          game: 'Valorant',
          preferredRoles: ['Controller', ' controller '],
          experienceLevel: 'Beginner',
        },
      ],
    },
    {
      gamingProfiles: [
        { game: 'Valorant', preferredRoles: [], experienceLevel: 'Expert' },
      ],
    },
    {
      gamingProfiles: [
        { game: 'Valorant', preferredRoles: [], experienceLevel: 'Beginner' },
        { game: ' valorant ', preferredRoles: [], experienceLevel: 'Advanced' },
      ],
    },
  ])('rejects invalid or unsupported fields: %j', async (body) => {
    await expect(validate(body)).rejects.toThrow();
  });

  it('accepts optional roles, clearing games, and an empty partial update', async () => {
    await expect(
      validate({
        bio: '',
        gamingProfiles: [
          {
            game: 'Overwatch 2',
            preferredRoles: [],
            experienceLevel: 'Beginner',
          },
        ],
      }),
    ).resolves.toBeDefined();
    await expect(validate({ gamingProfiles: [] })).resolves.toBeDefined();
    await expect(validate({})).resolves.toBeDefined();
  });
});
