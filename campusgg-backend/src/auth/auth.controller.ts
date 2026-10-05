import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { verificationToken, password, ...safeUser } = user;
    return safeUser;
  }

  @Get('verify')
  async verify(@Query('token') token: string) {
    const result = await this.authService.verifyEmail(token);
    return {
      statusCode: 200,
      message: result.message,
    };
  }

  @Post('resend-verification')
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendDto.email);
  }
}
