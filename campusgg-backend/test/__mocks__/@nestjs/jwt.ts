/**
 * Jest mock for @nestjs/jwt.
 *
 * @nestjs/jwt v12 is published as ESM-only, which Jest's CommonJS runtime
 * cannot parse. The application only needs the module's DI tokens in unit
 * tests, so a lightweight stub is sufficient.
 */
export class JwtService {
  sign = jest.fn();
  signAsync = jest.fn();
  verify = jest.fn();
  verifyAsync = jest.fn();
}

export class JwtModule {
  static register = jest.fn().mockReturnValue({ module: JwtModule });
  static registerAsync = jest.fn().mockReturnValue({ module: JwtModule });
}
