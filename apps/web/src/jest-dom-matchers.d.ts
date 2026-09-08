// Type augmentation registering jest-dom's matchers on vitest's `expect`.
//
// jest-dom ships its own '@testing-library/jest-dom/vitest' augmentation, but as of
// jest-dom 7.0.1 it declares `interface Assertion<T = any>` — a single type parameter,
// matching vitest <= 4. Vitest 5 changed the signature to `Assertion<R, T>`, and a
// declaration-merge whose type-parameter list doesn't match is not applied, so the
// matchers never land on `expect(...)` and every `.toBeInTheDocument()` fails to compile.
//
// Augmenting `Matchers<R, T>` instead is the fix: it is vitest 5's designated (empty)
// extension point for custom matchers, and both `Assertion` and `ExpectStatic` extend it.
// Drop this file once jest-dom ships vitest 5-compatible types.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
