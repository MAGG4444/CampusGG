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
      'CampusGG <onboarding@resend.dev>';

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

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: mailFrom,
          to: email,
          subject,
          text,
          html,
        });

        if (error) {
          this.logger.error(`Resend API error sending to ${email}:`, error);
          throw error;
        }

        this.logger.log(
          `Verification email sent to ${email} (Resend ID: ${data?.id})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to send verification email to ${email}:`,
          err,
        );
        throw err;
      }
    } else {
      // Dev fallback: log the code to console if no API key configured
      this.logger.log(
        `[DEV MODE - No Resend API key] Verification code for ${username} (${email}): ${code}`,
      );
    }
  }
}
