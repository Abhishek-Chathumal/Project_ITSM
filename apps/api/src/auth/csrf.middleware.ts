import { doubleCsrf } from 'csrf-csrf';
import type { AppConfig } from '../config/configuration';

/**
 * Double-submit-cookie CSRF protection for the cookie-based session (Part V.7).
 * A non-httpOnly token cookie is issued; the frontend echoes it back in the
 * X-CSRF-Token header on every mutating request. GET/HEAD/OPTIONS are exempt.
 */
export function buildCsrfMiddleware(appConfig: AppConfig) {
  const { doubleCsrfProtection, generateToken } = doubleCsrf({
    getSecret: () => appConfig.sessionSecret,
    cookieName: 'itsm.csrf',
    cookieOptions: {
      httpOnly: false,
      sameSite: 'lax',
      secure: appConfig.cookieSecure,
    },
    getSessionIdentifier: (req) => req.session?.id ?? 'anonymous',
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  return { doubleCsrfProtection, generateToken };
}
