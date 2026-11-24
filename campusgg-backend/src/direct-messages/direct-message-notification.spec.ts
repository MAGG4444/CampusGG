jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessageEvents } from './direct-message-events';
import type { DirectMessagesService } from './direct-messages.service';

describe('Direct message notifications', () => {
  const req = { user: { id: 'viewer' } } as AuthenticatedRequest;
  it('publishes only after a successful send and a changed read state', async () => {
    const events = new DirectMessageEvents();
    const listener = jest.fn();
    events.subscribe(listener);
    const service = {
      send: jest.fn().mockResolvedValue({ id: 'message' }),
      markRead: jest
        .fn()
        .mockResolvedValueOnce({ updated: 0 })
        .mockResolvedValueOnce({ updated: 1 }),
    };
    const controller = new DirectMessagesController(
      service as unknown as DirectMessagesService,
      events,
    );
    await controller.send(req, 'friend', { content: 'Hi' });
    expect(listener).toHaveBeenCalledWith(['viewer', 'friend']);
    await controller.read(req, 'friend', { messageIds: ['message'] });
    expect(listener).toHaveBeenCalledTimes(1);
    await controller.read(req, 'friend', { messageIds: ['message'] });
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it('does not publish on a rejected send', async () => {
    const events = new DirectMessageEvents();
    const listener = jest.fn();
    events.subscribe(listener);
    const service = {
      send: jest.fn().mockRejectedValue(new Error('Forbidden')),
    };
    const controller = new DirectMessagesController(
      service as unknown as DirectMessagesService,
      events,
    );
    await expect(
      controller.send(req, 'friend', { content: 'Hi' }),
    ).rejects.toThrow('Forbidden');
    expect(listener).not.toHaveBeenCalled();
  });
});
