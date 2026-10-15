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
    code: string,
  ): Promise<void> {
    const mailFrom =
      this.configService.get<string>('MAIL_FROM') ||
      'CampusGG <noreply@campusgg.edu>';

    const subject = 'Verify your CampusGG Student Account';

    const text = [
      `Hi ${username},`,
      '',
      'To complete your registration and verify your .edu email, please enter the following 6-digit code on the website:',
      code,
      '',
      'This code will expire in 10 minutes.',
      '',
      'See you in the lobby,',
      'The CampusGG Team',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to CampusGG!</h2>
        <p>Hi ${username},</p>
        <p>To complete your registration and verify your .edu email, please enter the following 6-digit code on the website:</p>
        <h1 style="font-size: 36px; letter-spacing: 8px; color: #000; text-align: center; background-color: #f4f4f4; padding: 20px; border-radius: 8px;">
          ${code}
        </h1>
        <p style="color: #d9534f; font-weight: bold;">This code will expire in 10 minutes.</p>
        <p>See you in the lobby,<br/>The CampusGG Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;" />
        <p style="font-size: 12px; color: #999;">If you didn't request this email, you can safely ignore it.</p>
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
        `[DEV MODE - No SMTP configured] Verification code for ${username} (${email}): ${code}`,
      );
    }
  }
}
