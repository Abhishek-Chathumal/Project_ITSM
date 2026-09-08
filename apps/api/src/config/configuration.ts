export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  redisUrl: string;
  seedBootstrapAdmin: boolean;
}

export default (): { app: AppConfig } => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    seedBootstrapAdmin: process.env.SEED_BOOTSTRAP_ADMIN === 'true',
  },
});
