import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailService } from './mail.service';

jest.mock('resend');

describe('MailService', () => {
  const mockSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Resend as jest.Mock).mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    }));
  });

  describe('with RESEND_API_KEY configured', () => {
    let mailService: MailService;
    let configService: ConfigService;

    beforeEach(() => {
      configService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string> = {
            RESEND_API_KEY: 're_test_key',
            MAIL_FROM: 'CampusGG <noreply@notifications.campusgg.net>',
            APP_BASE_URL: 'http://localhost:3000',
          };
          return config[key];
        }),
      } as unknown as ConfigService;

      mailService = new MailService(configService);
    });

    it('should create Resend client with configured API key', () => {
      expect(Resend).toHaveBeenCalledWith('re_test_key');
    });

    it('should send verification email with 6-digit code and template', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'email_123' },
        error: null,
      });

      await mailService.sendVerificationEmail(
        'student@purdue.edu',
        'BoilerGamer',
        '482910',
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0] as unknown as [
        Record<string, unknown>,
      ];
      const mailArgs = call[0];

      expect(mailArgs.to).toEqual(['student@purdue.edu']);
      expect(mailArgs.from).toBe(
        'CampusGG <noreply@notifications.campusgg.net>',
      );
      expect(mailArgs.subject).toBe(
        'Your CampusGG verification code is: 482910',
      );
      expect(mailArgs.text).toContain('482910');
      expect(mailArgs.html).toContain('482910');
      expect(mailArgs.html).toContain('Hi BoilerGamer,');
      expect(mailArgs.html).toContain(
        'This verification code will expire in 10 minutes.',
      );
    });
  });

  describe('without RESEND_API_KEY configured (Dev Mode Fallback)', () => {
    let mailService: MailService;
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      const configService = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      mailService = new MailService(configService);
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    it('should not create a Resend client', () => {
      expect(Resend).not.toHaveBeenCalled();
    });

    it('should log verification code instead of sending email', async () => {
      await mailService.sendVerificationEmail(
        'dev@purdue.edu',
        'DevUser',
        '654321',
      );

      expect(mockSend).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV MODE - No Resend API key]'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('654321'));
    });
  });
});
