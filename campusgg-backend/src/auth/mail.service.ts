import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendVerificationEmail(
    email: string,
    username: string,
    code: string,
  ): Promise<void> {
    const mailFrom =
      this.configService.get<string>('MAIL_FROM') ||
      'CampusGG <noreply@notifications.campusgg.net>';

    const subject = `Your CampusGG verification code is: ${code}`;

    const text = [
      username ? `Hi ${username},` : 'Hello,',
      '',
      'Your email verification code is:',
      code,
      '',
      'This verification code will expire in 10 minutes. If this was not you, please ignore this email.',
      '',
      '— The CampusGG Team',
    ].join('\n');

    const greeting = username ? `<p>Hi ${username},</p>` : '';
    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Welcome to CampusGG!</h2>
        ${greeting}
        <p>Your email verification code is:</p>
        <h1 style="color: #4F46E5; letter-spacing: 4px;">${code}</h1>
        <p>This verification code will expire in 10 minutes. If this was not you, please ignore this email.</p>
      </div>
    `.trim();

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: mailFrom,
          to: [email],
          subject,
          text,
          html,
        });

        if (error) {
          this.logger.error('Failed to send email:', error);
          throw new Error(
            `Resend API error sending to ${email}: ${JSON.stringify(error)}`,
          );
        }

        this.logger.log(`Email sent successfully, ID: ${data?.id}`);
      } catch (err) {
        this.logger.error(
          `Failed to send verification email to ${email}:`,
          err,
        );
        throw new Error(`Failed to send verification email to ${email}`);
      }
    } else {
      // Dev fallback: log the code to console if no API key configured
      this.logger.log(
        `[DEV MODE - No Resend API key] Verification code for ${username} (${email}): ${code}`,
      );
    }
  }
}
