import type { Request, Response } from 'express';

type TokenGenerator = (req: Request, res: Response, overwrite?: boolean) => string;

let generator: TokenGenerator | undefined;

/** Wires the csrf-csrf token generator (built once in main.ts) so AuthController can mint tokens. */
export function setCsrfTokenGenerator(fn: TokenGenerator) {
  generator = fn;
}

/**
 * Always mints a fresh token (overwrite=true) rather than csrf-csrf's default
 * reuse-and-revalidate behavior. Without this, calling the endpoint again after
 * something changed the session identifier (e.g. login's session.regenerate())
 * throws instead of just issuing a new token bound to the current session.
 */
export function generateCsrfToken(req: Request, res: Response): string {
  if (!generator) {
    throw new Error('CSRF token generator not initialized');
  }
  return generator(req, res, true);
}
