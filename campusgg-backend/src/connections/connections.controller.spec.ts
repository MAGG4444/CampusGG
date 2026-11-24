jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

describe('ConnectionsController', () => {
  it('requires JWT authentication for the whole controller', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ConnectionsController),
    ).toContain(JwtAuthGuard);
  });

  it('uses the authenticated viewer for every endpoint', async () => {
    const methods = {
      list: jest.fn(),
      search: jest.fn(),
      status: jest.fn(),
      request: jest.fn(),
      accept: jest.fn(),
      decline: jest.fn(),
      cancel: jest.fn(),
      remove: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [ConnectionsController],
      providers: [
        {
          provide: ConnectionsService,
          useValue: methods,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(ConnectionsController);

    const req = {
      user: { id: 'viewer' },
    } as AuthenticatedRequest;

    controller.friends(req);
    controller.incoming(req);
    controller.outgoing(req);
    controller.search(req, { q: 'player' });

    expect(methods.list.mock.calls).toEqual([
      ['viewer', 'friend'],
      ['viewer', 'incoming'],
      ['viewer', 'outgoing'],
    ]);

    expect(methods.search).toHaveBeenCalledWith('viewer', 'player');

    for (const action of [
      'status',
      'request',
      'accept',
      'decline',
      'cancel',
      'remove',
    ] as const) {
      controller[action](req, 'target');

      expect(methods[action]).toHaveBeenCalledWith('viewer', 'target');
    }

    await module.close();
  });
});
