export class ConfigService<K = any> {
  private readonly envConfig: Record<string, any>;

  constructor(internalConfig?: Record<string, any>) {
    this.envConfig = internalConfig ?? process.env;
  }

  get<T = any>(key: string): T | undefined {
    return this.envConfig[key] as T;
  }

  getOrThrow<T = any>(key: string): T {
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
