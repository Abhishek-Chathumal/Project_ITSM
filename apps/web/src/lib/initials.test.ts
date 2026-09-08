import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first and last initial of a full name', () => {
    expect(initialsOf('Bootstrap Admin')).toBe('BA');
    expect(initialsOf('Ada Byron Lovelace')).toBe('AL');
  });

  it('takes the first two letters of a single name', () => {
    expect(initialsOf('Prince')).toBe('PR');
  });

  it('handles a one-letter name without running off the end', () => {
    expect(initialsOf('X')).toBe('X');
  });

  it('tolerates surrounding and repeated whitespace', () => {
    expect(initialsOf('  Grace   Hopper  ')).toBe('GH');
  });

  // A blank circle reads as a rendering bug; '?' reads as missing data.
  it('falls back to a question mark rather than an empty string', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
    expect(initialsOf(null)).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
  });
});
