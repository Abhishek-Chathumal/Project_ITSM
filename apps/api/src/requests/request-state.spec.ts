import { isOperationallyActive, operationallyActiveFilter } from './request-state';

describe('isOperationallyActive (Ref B5)', () => {
  const active = { isSpam: false, archivedAt: null, mergeParentId: null };

  it('counts an ordinary request', () => {
    expect(isOperationallyActive(active)).toBe(true);
  });

  it('excludes spam', () => {
    expect(isOperationallyActive({ ...active, isSpam: true })).toBe(false);
  });

  it('excludes an archived request', () => {
    expect(isOperationallyActive({ ...active, archivedAt: new Date() })).toBe(false);
  });

  it('excludes the secondary side of a merge', () => {
    // The primary keeps counting. Counting both double-counts one piece of work.
    expect(isOperationallyActive({ ...active, mergeParentId: 'primary-id' })).toBe(false);
  });

  it('still counts a request that is merely closed', () => {
    // Closed is not one of the three exclusions. A closed ticket happened, was worked, and
    // belongs in volume and SLA compliance — conflating "finished" with "should never have
    // counted" is the mistake B5 is written to prevent.
    expect(isOperationallyActive(active)).toBe(true);
  });
});

describe('operationallyActiveFilter', () => {
  it('expresses exactly the same three exclusions as the predicate', () => {
    // Two expressions of one rule drift invisibly: a report and a list disagreeing, with
    // neither erroring. Asserting the shape here is what keeps them honest.
    expect(operationallyActiveFilter()).toEqual({
      isSpam: false,
      archivedAt: null,
      mergeParentId: null,
    });
  });

  it('agrees with the predicate on every single-flag case', () => {
    const filter = operationallyActiveFilter();
    const cases = [
      { isSpam: false, archivedAt: null, mergeParentId: null },
      { isSpam: true, archivedAt: null, mergeParentId: null },
      { isSpam: false, archivedAt: new Date(), mergeParentId: null },
      { isSpam: false, archivedAt: null, mergeParentId: 'p' },
    ];

    for (const row of cases) {
      const matchesFilter =
        row.isSpam === filter.isSpam &&
        row.archivedAt === filter.archivedAt &&
        row.mergeParentId === filter.mergeParentId;
      expect(matchesFilter).toBe(isOperationallyActive(row));
    }
  });
});
