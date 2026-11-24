jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { DirectMessagesController } from './direct-messages.controller';
import type { DirectMessagesService } from './direct-messages.service';

describe('DirectMessagesController', () => {
  it('protects every endpoint with the existing JWT guard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, DirectMessagesController),
    ).toContain(JwtAuthGuard);
  });
  it('uses the JWT identity rather than accepting a sender from the client', () => {
    const service = {
      list: jest.fn(),
      history: jest.fn(),
      send: jest.fn(),
      markRead: jest.fn(),
    };
    const controller = new DirectMessagesController(
      service as unknown as DirectMessagesService,
    );
    const req = { user: { id: 'viewer' } } as AuthenticatedRequest;
    controller.list(req);
    controller.history(req, 'friend', { limit: 20, before: 'cursor' });
    controller.send(req, 'friend', { content: 'Hi' });
    controller.read(req, 'friend', { messageIds: ['message'] });
    expect(service.list).toHaveBeenCalledWith('viewer');
    expect(service.history).toHaveBeenCalledWith(
      'viewer',
      'friend',
      20,
      'cursor',
    );
    expect(service.send).toHaveBeenCalledWith('viewer', 'friend', 'Hi');
    expect(service.markRead).toHaveBeenCalledWith('viewer', 'friend', [
      'message',
    ]);
  });
});
