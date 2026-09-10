import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  PERMISSION_MANIFEST,
  PERMISSION_MANIFEST_VERSION,
  PERMISSION_MODULES,
} from '@itsm/shared';

/**
 * Integrity checks on the permission catalogue itself.
 *
 * The manifest is the thing every authorization decision ultimately references, and it is
 * long enough (174 entries) that a duplicate or a typo would not be spotted by reading it.
 * These are the properties that must hold for the seed and the guards to be trustworthy.
 */
describe('permission manifest', () => {
  it('is versioned', () => {
    // Constitution 7.3.5 calls for a *versioned* manifest — the version is what lets a
    // database be told apart from the catalogue that produced it.
    expect(PERMISSION_MANIFEST_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('has no duplicate keys', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of ALL_PERMISSION_KEYS) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('follows the module.action[.qualifier] naming convention (Ref I2)', () => {
    // Lowercase, dot-separated, snake_case segments. A key is a contract; an inconsistent
    // one is a permanent inconsistency, because renaming it later orphans every grant.
    const shape = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$/;
    const bad = ALL_PERMISSION_KEYS.filter((key) => !shape.test(key));
    expect(bad).toEqual([]);
  });

  it('never encodes a scope in a key', () => {
    // Amendment A-001: `request.view` carries a scope per assignment; it is not
    // `request.view.own` / `.team` / `.all`. That was the pre-A-001 shape, and reintroducing
    // it would quietly recreate the model the amendment replaced (ADR-0017).
    const scopeSuffixes = ['.own', '.team', '.all', '.group', '.department', '.location'];
    const offenders = ALL_PERMISSION_KEYS.filter((key) =>
      scopeSuffixes.some((suffix) => key.endsWith(suffix)),
    );
    expect(offenders).toEqual([]);
  });

  it('gives every permission a declared module and a non-empty description', () => {
    for (const permission of PERMISSION_MANIFEST) {
      expect(PERMISSION_MODULES).toContain(permission.module);
      expect(permission.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps PERMISSIONS and the manifest in exact agreement', () => {
    // They are derived from one object, so this asserts the derivation rather than two
    // hand-maintained lists — but it is the derivation that everything else depends on.
    const fromLookup = Object.values(PERMISSIONS).sort();
    const fromManifest = [...ALL_PERMISSION_KEYS].sort();
    expect(fromLookup).toEqual(fromManifest);
  });

  it('marks the permissions that must be sensitive', () => {
    // Ref I2.5 singles out grant/revoke as "the two most powerful permissions in the
    // system"; I2.6 says script management and workflow publishing are effectively code
    // execution. If any of these stops being sensitive, step-up MFA (Ref I5) stops applying
    // to it — silently.
    const mustBeSensitive = [
      PERMISSIONS.USER_PERMISSION_GRANT,
      PERMISSIONS.USER_PERMISSION_REVOKE,
      PERMISSIONS.AUTOMATION_SCRIPT_MANAGE,
      PERMISSIONS.AUTOMATION_WORKFLOW_PUBLISH,
      PERMISSIONS.SECURITY_POLICY_MANAGE,
      PERMISSIONS.ROLE_EDIT,
      PERMISSIONS.SCOPE_MANAGE,
    ];
    const byKey = new Map(PERMISSION_MANIFEST.map((p) => [p.key, p]));
    for (const key of mustBeSensitive) {
      expect(byKey.get(key)?.isSensitive).toBe(true);
    }
  });

  it('covers every module section of Ref I2', () => {
    const modulesInUse = new Set(PERMISSION_MANIFEST.map((p) => p.module));
    for (const module of PERMISSION_MODULES) {
      expect(modulesInUse.has(module)).toBe(true);
    }
  });

  it('carries the request permissions Slice 3 will guard routes with', () => {
    // Named explicitly because ADR-0017 records that an earlier branch invented
    // `ticket.view.own` / `.team` / `.all` and had to be thrown away. These are the I2.1
    // keys that replaced them.
    const required = [
      'request.view',
      'request.create',
      'request.edit',
      'request.assign',
      'request.transition',
      'request.resolve',
      'request.close',
      'request.reopen',
      'request.note.internal',
      'request.note.view_internal',
      'request.priority.override',
      'request.delete',
      'request.export',
    ];
    for (const key of required) {
      expect(ALL_PERMISSION_KEYS).toContain(key);
    }
  });

  it('does not carry any `ticket.` prefixed key', () => {
    // Ref I2.1 fixes the module prefix as `request.`, not `ticket.` (ADR-0017).
    expect(ALL_PERMISSION_KEYS.filter((k) => k.startsWith('ticket.'))).toEqual([]);
  });
});
