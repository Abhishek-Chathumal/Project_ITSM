import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import type { AppConfig } from '../config/configuration';

/**
 * Redis-backed session store. Chosen over a signed-cookie-only session so a disabled
 * user or a logout can be revoked instantly server-side (Article IV/VII) — Redis is
 * already mandated by the architecture for exactly this role (Part VI.4).
 */
export async function buildSessionMiddleware(appConfig: AppConfig) {
  const redisClient = new Redis(appConfig.redisUrl);

  return session({
    store: new RedisStore({ client: redisClient, prefix: 'itsm:sess:' }),
    secret: appConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'itsm.sid',
    cookie: {
      httpOnly: true,
      secure: appConfig.cookieSecure,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours idle-ish absolute; refined in a later phase
    },
  });
}
