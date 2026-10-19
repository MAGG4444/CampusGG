import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    let payload: unknown;

    try {
      payload =
        await this.jwtService.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string'
    ) {
      throw new UnauthorizedException('Invalid token payload');
    }

    request.user = {
      id: payload.sub,
    };

    return true;
  }
}
