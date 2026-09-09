export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  redisUrl: string;
  seedBootstrapAdmin: boolean;
}

/**
 * Stable across restarts so a dev login survives a watch-mode reload. Unreachable in
 * production: resolveSessionSecret throws before it can be returned there.
 */
const DEV_SESSION_SECRET = 'dev-insecure-secret-change-me';

/**
 * Values that are published somewhere the world can read them — this repo, `.env.example`,
 * the setup docs — and are therefore worthless as a signing key however long they are.
 * `docker-compose.yml` used to supply one of these as a default, so "is it set?" is not a
 * sufficient check on its own.
 */
const PUBLISHED_SESSION_SECRETS = new Set([
  DEV_SESSION_SECRET,
  'change-me-to-a-long-random-string',
  'change-me',
]);

const MIN_SESSION_SECRET_LENGTH = 32;

const HOW_TO_FIX = 'Set SESSION_SECRET to a long random value: `openssl rand -base64 48`.';

/**
 * This value signs session cookies (session.middleware.ts) and seeds the CSRF tokens
 * (csrf.middleware.ts). A guessable one means forged sessions and a bypassed CSRF check,
 * so in production we refuse to boot rather than serve traffic that only looks protected.
 * Throwing here aborts NestFactory.create, before the app accepts a single request.
 */
function resolveSessionSecret(nodeEnv: string): string {
  const secret = process.env.SESSION_SECRET?.trim() ?? '';

  if (nodeEnv !== 'production') {
    return secret || DEV_SESSION_SECRET;
  }

  // Never include the secret itself in an error — these messages reach the logs.
  if (!secret) {
    throw new Error(`SESSION_SECRET is not set, and production has no safe default. ${HOW_TO_FIX}`);
  }
  if (PUBLISHED_SESSION_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      `SESSION_SECRET is still a placeholder from the setup docs, so it is public. ${HOW_TO_FIX}`,
    );
  }
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET is ${secret.length} characters; production requires at least ` +
        `${MIN_SESSION_SECRET_LENGTH}. ${HOW_TO_FIX}`,
    );
  }
  return secret;
}

export default (): { app: AppConfig } => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    app: {
      nodeEnv,
      port: parseInt(process.env.API_PORT ?? '3000', 10),
      corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      sessionSecret: resolveSessionSecret(nodeEnv),
      cookieSecure: process.env.COOKIE_SECURE === 'true',
      redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
      seedBootstrapAdmin: process.env.SEED_BOOTSTRAP_ADMIN === 'true',
    },
  };
};
