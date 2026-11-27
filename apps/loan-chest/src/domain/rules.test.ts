import { describe, expect, it } from 'vitest';

import type { BorrowerProfile, Loan, Loaner } from '../model';
import {
  allocateQueue,
  canExtendLoan,
  checkAvailability,
  computeFit,
  computeLatenessFee,
  evaluateReturn,
} from './rules';

const BASE_LOANER: Loaner = {
  id: 'ln-1',
  tag: 'LC-01',
  title: 'Pinecone Jacquard Crew',
  size: 'm',
  chestCm: 106,
  fibre: 'wool',
  lights: false,
  status: 'shelf',
  wears: 4,
  maxWears: 12,
  curatorSub: 'cur',
  curatorName: 'Alex Rivera',
};

describe('Rule 1: Availability & cleaning turnaround', () => {
  it('AC1: loaner returned Monday refuses Tuesday start and accepts Wednesday start', () => {
    const returnedMonday: Loan = {
      id: 'l-1',
      loanerId: 'ln-1',
      borrowerSub: 'b-1',
      borrowerName: 'Sam',
      startsOn: '2026-12-04T00:00:00.000Z',
      dueOn: '2026-12-07T00:00:00.000Z',
      returnedOn: '2026-12-07T00:00:00.000Z', // Monday
      status: 'returned',
      condition: 'clean',
      extended: false,
      curatorSub: 'cur',
      createdAt: '2026-12-01T00:00:00.000Z',
    };

    const tuesday = checkAvailability(BASE_LOANER, [returnedMonday], '2026-12-08T00:00:00.000Z', '2026-12-10T00:00:00.000Z');
    expect(tuesday.available).toBe(false);
    expect(tuesday.reason).toContain('cleaning');

    const wednesday = checkAvailability(BASE_LOANER, [returnedMonday], '2026-12-09T00:00:00.000Z', '2026-12-11T00:00:00.000Z');
    expect(wednesday.available).toBe(true);
  });

  it('AC2: loan longer than 4 days is refused with maximum shown', () => {
    const res = checkAvailability(BASE_LOANER, [], '2026-12-09T00:00:00.000Z', '2026-12-14T00:00:00.000Z');
    expect(res.available).toBe(false);
    expect(res.reason).toContain('4 days');
  });

  it('refuses retired loaners', () => {
    const res = checkAvailability({ ...BASE_LOANER, status: 'retired' }, [], '2026-12-09T00:00:00.000Z', '2026-12-11T00:00:00.000Z');
    expect(res.available).toBe(false);
  });
});

describe('Rule 2: Fit', () => {
  it('fits when 0 <= ease <= 20 and ranks closest to 10 cm', () => {
    expect(computeFit(106, 96)).toEqual({ ease: 10, fits: true, closenessToIdeal: 0 });
    expect(computeFit(106, 110).fits).toBe(false);
    expect(computeFit(130, 100).fits).toBe(false);
  });
});

describe('Rule 3: Fair queue', () => {
  it('AC3: longer gap beats shorter gap, and never-borrowed beats both', () => {
    const now = new Date('2026-12-10T00:00:00.000Z');
    const profiles: BorrowerProfile[] = [
      { id: 'p1', personSub: 'recent', chestCm: 98, lastLoanOn: '2026-12-02T00:00:00.000Z' }, // 8d
      { id: 'p2', personSub: 'longer', chestCm: 98, lastLoanOn: '2026-11-10T00:00:00.000Z' }, // 30d
      { id: 'p3', personSub: 'never', chestCm: 98, lastLoanOn: null }, // 60
    ];
    const reqs = [
      { id: 'r1', borrowerSub: 'recent', borrowerName: 'Recent', loanerId: 'ln-1', startsOn: '2026-12-12', dueOn: '2026-12-14', createdAt: '2026-12-09T01:00:00Z' },
      { id: 'r2', borrowerSub: 'longer', borrowerName: 'Longer', loanerId: 'ln-1', startsOn: '2026-12-12', dueOn: '2026-12-14', createdAt: '2026-12-09T02:00:00Z' },
      { id: 'r3', borrowerSub: 'never', borrowerName: 'Never', loanerId: 'ln-1', startsOn: '2026-12-12', dueOn: '2026-12-14', createdAt: '2026-12-09T03:00:00Z' },
    ];

    const ranked = allocateQueue(reqs, profiles, 1, now);
    expect(ranked.map((r) => r.borrowerSub)).toEqual(['never', 'longer', 'recent']);
    expect(ranked[0]!.allocated).toBe(true);
    expect(ranked[1]!.allocated).toBe(false);
  });
});

describe('Rule 4: Extension & lateness fee', () => {
  it('AC4: 3 days overdue gives $2.00 donation (3 - 1 grace day)', () => {
    const res = computeLatenessFee('2026-12-07T00:00:00.000Z', '2026-12-10T00:00:00.000Z');
    expect(res.daysLate).toBe(3);
    expect(res.fee).toBe(2.0);
  });

  it('1 day overdue is within grace period ($0.00)', () => {
    const res = computeLatenessFee('2026-12-09T00:00:00.000Z', '2026-12-10T00:00:00.000Z');
    expect(res.daysLate).toBe(1);
    expect(res.fee).toBe(0);
  });

  it('blocks extension when a reservation follows within CLEAN_DAYS', () => {
    const active: Loan = {
      id: 'l-out',
      loanerId: 'ln-1',
      borrowerSub: 'b-1',
      borrowerName: 'Sam',
      startsOn: '2026-12-08T00:00:00.000Z',
      dueOn: '2026-12-10T00:00:00.000Z',
      returnedOn: null,
      status: 'out',
      condition: null,
      extended: false,
      curatorSub: 'cur',
      createdAt: '2026-12-07T00:00:00.000Z',
    };
    const nextRes: Loan = {
      ...active,
      id: 'l-next',
      borrowerSub: 'b-2',
      borrowerName: 'Jordan',
      startsOn: '2026-12-13T00:00:00.000Z',
      dueOn: '2026-12-15T00:00:00.000Z',
      status: 'reserved',
    };
    expect(canExtendLoan(active, [active, nextRes], 2).allowed).toBe(false);
    expect(canExtendLoan(active, [active], 2).allowed).toBe(true);
  });
});

describe('Rule 5: Retirement', () => {
  it('AC5: 12th return retires the loaner', () => {
    const nearRetire: Loaner = { ...BASE_LOANER, wears: 11, maxWears: 12, status: 'on_loan' };
    const outcome = evaluateReturn(nearRetire, [], 'clean');
    expect(outcome.nextWears).toBe(12);
    expect(outcome.shouldRetire).toBe(true);
    expect(outcome.nextStatus).toBe('retired');
  });

  it('retires on second damaged return even below maxWears', () => {
    const priorDamaged: Loan = {
      id: 'l-prev',
      loanerId: 'ln-1',
      borrowerSub: 'b-1',
      borrowerName: 'Sam',
      startsOn: '2026-11-01T00:00:00.000Z',
      dueOn: '2026-11-03T00:00:00.000Z',
      returnedOn: '2026-11-03T00:00:00.000Z',
      status: 'returned',
      condition: 'damaged',
      extended: false,
      curatorSub: 'cur',
      createdAt: '2026-10-30T00:00:00.000Z',
    };
    const outcome = evaluateReturn(BASE_LOANER, [priorDamaged], 'damaged');
    expect(outcome.shouldRetire).toBe(true);
    expect(outcome.nextStatus).toBe('retired');
  });
});
