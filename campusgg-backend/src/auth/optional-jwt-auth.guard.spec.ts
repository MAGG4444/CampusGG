import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

describe('OptionalJwtAuthGuard', () => {
  it('allows guests and identifies valid tokens while rejecting invalid tokens', async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: 'user-id' });
    const guard = new OptionalJwtAuthGuard({
      verifyAsync,
    } as unknown as JwtService);
    const request = { headers: {} } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
    request.headers.authorization = 'Bearer valid';
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.user?.id).toBe('user-id');
    verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
