import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  const mockSendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });
  });

  describe('with SMTP_HOST configured', () => {
    let mailService: MailService;
    let configService: ConfigService;

    beforeEach(() => {
      configService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | number> = {
            SMTP_HOST: 'smtp.campusgg.edu',
            SMTP_PORT: '587',
            SMTP_USER: 'smtp_user',
            SMTP_PASS: 'smtp_pass',
            MAIL_FROM: 'CampusGG <noreply@campusgg.edu>',
            APP_BASE_URL: 'http://localhost:3000',
          };
          return config[key];
        }),
      } as unknown as ConfigService;

      mailService = new MailService(configService);
    });

    it('should create transporter with configured SMTP credentials', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.campusgg.edu',
        port: 587,
        secure: false,
        auth: {
          user: 'smtp_user',
          pass: 'smtp_pass',
        },
      });
    });

    it('should send verification email with link and template', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'msg-123' });

      await mailService.sendVerificationEmail(
        'student@purdue.edu',
        'BoilerGamer',
        'token-abc-123',
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0] as unknown as [
        Record<string, string>,
      ];
      const mailArgs = call[0];

      expect(mailArgs.to).toBe('student@purdue.edu');
      expect(mailArgs.from).toBe('CampusGG <noreply@campusgg.edu>');
      expect(mailArgs.subject).toContain('Verify');
      expect(mailArgs.text).toContain(
        'http://localhost:3000/api/auth/verify?token=token-abc-123',
      );
      expect(mailArgs.html).toContain(
        'http://localhost:3000/api/auth/verify?token=token-abc-123',
      );
    });

    it('should strip trailing slash from APP_BASE_URL in verification link', async () => {
      configService = {
        get: jest.fn((key: string) => {
          if (key === 'SMTP_HOST') return 'smtp.campusgg.edu';
          if (key === 'APP_BASE_URL') return 'https://campusgg.com///';
          return undefined;
        }),
      } as unknown as ConfigService;

      mailService = new MailService(configService);
      mockSendMail.mockResolvedValueOnce({});

      await mailService.sendVerificationEmail(
        'student@purdue.edu',
        'BoilerGamer',
        'token-xyz',
      );

      const call = mockSendMail.mock.calls[0] as unknown as [
        Record<string, string>,
      ];
      const mailArgs = call[0];
      expect(mailArgs.text).toContain(
        'https://campusgg.com/api/auth/verify?token=token-xyz',
      );
    });
  });

  describe('with SMTP_PORT=465 (SSL)', () => {
    it('should set secure to true for port 465', () => {
      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'SMTP_HOST') return 'smtp.campusgg.edu';
          if (key === 'SMTP_PORT') return 465;
          return undefined;
        }),
      } as unknown as ConfigService;

      new MailService(configService);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        }),
      );
    });
  });

  describe('without SMTP_HOST configured (Dev Mode Fallback)', () => {
    let mailService: MailService;
    let loggerSpy: jest.SpyInstance;

    beforeEach(() => {
      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'APP_BASE_URL') return 'http://localhost:3000';
          return undefined;
        }),
      } as unknown as ConfigService;

      loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      mailService = new MailService(configService);
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    it('should not create a transporter', () => {
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should log verification URL instead of sending email', async () => {
      await mailService.sendVerificationEmail(
        'dev@purdue.edu',
        'DevUser',
        'dev-token-456',
      );

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV MODE - No SMTP configured]'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'http://localhost:3000/api/auth/verify?token=dev-token-456',
        ),
      );
    });
  });
});
