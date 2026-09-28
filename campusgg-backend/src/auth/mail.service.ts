import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (smtpHost) {
      const portVal = this.configService.get<string | number>('SMTP_PORT');
      const port = portVal ? Number(portVal) : 587;
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASS');

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  async sendVerificationEmail(
    email: string,
    username: string,
    token: string,
  ): Promise<void> {
    const appBaseUrl =
      this.configService.get<string>('APP_BASE_URL') || 'http://localhost:3000';
    const cleanBaseUrl = appBaseUrl.replace(/\/+$/, '');
    const verificationUrl = `${cleanBaseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

    const mailFrom =
      this.configService.get<string>('MAIL_FROM') ||
      'CampusGG <noreply@campusgg.edu>';

    const subject = 'Verify your CampusGG Student Account';

    const text = [
      `Hello ${username},`,
      '',
      'Welcome to CampusGG! To verify your collegiate player account, please click the link below:',
      verificationUrl,
      '',
      'This verification link expires in 24 hours.',
      '',
      'If you did not register for CampusGG, you can safely ignore this email.',
      '',
      '— The CampusGG Team',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #4f46e5;">Welcome to CampusGG, ${username}!</h2>
        <p>Thank you for registering. Please verify your .edu email address to unlock competitive matchmaking and join your campus community.</p>
        <p style="margin: 24px 0;">
          <a href="${verificationUrl}"
             style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <p style="color: #ef4444; font-size: 13px; margin-top: 24px;">Note: This verification link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you did not sign up for CampusGG, please ignore this email.</p>
      </div>
    `.trim();

    if (this.transporter) {
      await this.transporter.sendMail({
        from: mailFrom,
        to: email,
        subject,
        text,
        html,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } else {
      this.logger.log(
        `[DEV MODE - No SMTP configured] Verification email for ${username} (${email}): ${verificationUrl}`,
      );
    }
  }
}
