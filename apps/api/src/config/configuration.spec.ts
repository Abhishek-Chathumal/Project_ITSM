import { randomBytes } from 'node:crypto';
import configuration from './configuration';

const DEV_SESSION_SECRET = 'dev-insecure-secret-change-me';

/**
 * Generated, not committed. A high-entropy literal here is indistinguishable from a real
 * leaked credential to a secret scanner — GitGuardian flagged exactly that on the first
 * version of this file. This is also how the production error message says to make one.
 */
const STRONG_SECRET = randomBytes(36).toString('base64');

/** Plain words on purpose, for the same reason: mixed alphanumerics here read as entropy. */
const TOO_SHORT_VALUE = 'short-and-public';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SESSION_SECRET;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sessionSecret outside production', () => {
    it('falls back to a stable dev secret when SESSION_SECRET is unset', () => {
      process.env.NODE_ENV = 'development';
      expect(configuration().app.sessionSecret).toBe(DEV_SESSION_SECRET);
    });

    it('returns the same fallback on every call, so a dev login survives a restart', () => {
      process.env.NODE_ENV = 'development';
      expect(configuration().app.sessionSecret).toBe(configuration().app.sessionSecret);
    });

    it('accepts a short secret, which CI relies on', () => {
      process.env.NODE_ENV = 'test';
      process.env.SESSION_SECRET = 'ci-test-secret';
      expect(configuration().app.sessionSecret).toBe('ci-test-secret');
    });
  });

  describe('sessionSecret in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('refuses to boot when SESSION_SECRET is unset', () => {
      expect(() => configuration()).toThrow(/SESSION_SECRET is not set/);
    });

    it('refuses to boot when SESSION_SECRET is blank', () => {
      process.env.SESSION_SECRET = '   ';
      expect(() => configuration()).toThrow(/SESSION_SECRET is not set/);
    });

    it('rejects the placeholder that docker-compose.yml used to default to', () => {
      process.env.SESSION_SECRET = 'change-me-to-a-long-random-string';
      expect(() => configuration()).toThrow(/placeholder/);
    });

    it('rejects the dev fallback, so it can never leak into production', () => {
      process.env.SESSION_SECRET = DEV_SESSION_SECRET;
      expect(() => configuration()).toThrow(/placeholder/);
    });

    it('rejects a placeholder regardless of case', () => {
      process.env.SESSION_SECRET = 'Change-Me-To-A-Long-Random-String';
      expect(() => configuration()).toThrow(/placeholder/);
    });

    it('rejects a secret shorter than 32 characters', () => {
      process.env.SESSION_SECRET = 'a'.repeat(31);
      expect(() => configuration()).toThrow(/31 characters/);
    });

    it('never echoes the secret in the error it throws, because that reaches the logs', () => {
      process.env.SESSION_SECRET = TOO_SHORT_VALUE;
      let message = '';
      try {
        configuration();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(new RegExp(`${TOO_SHORT_VALUE.length} characters`));
      expect(message).not.toContain(TOO_SHORT_VALUE);
    });

    it('accepts a long random secret', () => {
      process.env.SESSION_SECRET = STRONG_SECRET;
      expect(configuration().app.sessionSecret).toBe(STRONG_SECRET);
    });

    it('trims surrounding whitespace from an otherwise valid secret', () => {
      process.env.SESSION_SECRET = `  ${STRONG_SECRET}  `;
      expect(configuration().app.sessionSecret).toBe(STRONG_SECRET);
    });
  });
});
