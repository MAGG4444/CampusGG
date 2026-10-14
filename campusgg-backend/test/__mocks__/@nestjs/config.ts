export class ConfigService {
  private readonly envConfig: Record<string, unknown>;

  constructor(internalConfig?: Record<string, unknown>) {
    this.envConfig = internalConfig ?? (process.env as Record<string, unknown>);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.envConfig[key] as T;
  }

  getOrThrow<T = unknown>(key: string): T {
    const val = this.get<T>(key);
    if (val === undefined) {
      throw new Error(`Config key "${key}" does not exist`);
    }
    return val;
  }
}

export class ConfigModule {
  static forRoot = jest.fn().mockReturnValue({ module: ConfigModule });
}
