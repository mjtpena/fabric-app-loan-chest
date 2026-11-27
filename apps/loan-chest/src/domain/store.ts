import { PermissionError, RuleError, type DataStore } from '@x10/shared/data';

import type { BorrowerProfile, Loan, LoanCondition, Loaner, Schema } from '../model';
import {
  canExtendLoan,
  checkAvailability,
  computeLatenessFee,
  evaluateReturn,
} from './rules';

export interface ChestSnapshot {
  loaners: Loaner[];
  loans: Loan[];
  profiles: BorrowerProfile[];
}

export async function loadChestSnapshot(store: DataStore<Schema>): Promise<ChestSnapshot> {
  const [loaners, loans, profiles] = await Promise.all([
    store.repo('Loaner').list(),
    store.repo('Loan').list(),
    store.repo('BorrowerProfile').list(),
  ]);
  const sortedLoaners = [...loaners].sort((a, b) => a.tag.localeCompare(b.tag));
  const sortedLoans = [...loans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { loaners: sortedLoaners, loans: sortedLoans, profiles };
}

export interface ReserveInput {
  loaner: Loaner;
  existingLoans: Loan[];
  borrowerSub: string;
  borrowerName: string;
  startsOn: string;
  dueOn: string;
  now?: Date;
}

export async function reserveLoaner(
  store: DataStore<Schema>,
  input: ReserveInput,
): Promise<Loan> {
  const now = input.now ?? new Date();
  const avail = checkAvailability(input.loaner, input.existingLoans, input.startsOn, input.dueOn);
  if (!avail.available) {
    throw new RuleError(avail.reason ?? 'Loaner is not available for those dates.');
  }

  return store.repo('Loan').create({
    id: crypto.randomUUID(),
    loanerId: input.loaner.id,
    borrowerSub: input.borrowerSub,
    borrowerName: input.borrowerName,
    startsOn: input.startsOn,
    dueOn: input.dueOn,
    returnedOn: null,
    status: 'reserved',
    condition: null,
    extended: false,
    curatorSub: input.loaner.curatorSub,
    createdAt: now.toISOString(),
  });
}

export async function extendLoan(
  store: DataStore<Schema>,
  loan: Loan,
  allLoans: Loan[],
  actorSub: string,
  extraDays = 2,
): Promise<Loan> {
  if (actorSub !== loan.borrowerSub && actorSub !== loan.curatorSub) {
    throw new PermissionError('Only the borrower or curator can extend this loan.');
  }
  const check = canExtendLoan(loan, allLoans, extraDays);
  if (!check.allowed || !check.newDueOn) {
    throw new RuleError(check.reason ?? 'Loan cannot be extended.');
  }
  return store.repo('Loan').update(loan.id, {
    dueOn: check.newDueOn.toISOString(),
    extended: true,
  });
}

export async function checkInReturn(
  store: DataStore<Schema>,
  loan: Loan,
  loaner: Loaner,
  allLoans: Loan[],
  profiles: BorrowerProfile[],
  condition: LoanCondition,
  actorSub: string,
  isAdmin: boolean,
  now = new Date(),
): Promise<{ loan: Loan; loaner: Loaner; fee: number; retired: boolean }> {
  if (actorSub !== loaner.curatorSub && !isAdmin) {
    throw new PermissionError('Only the curator can check in returns.');
  }
  const { fee } = computeLatenessFee(loan.dueOn, now);
  const outcome = evaluateReturn(loaner, allLoans, condition);

  const updatedLoan = await store.repo('Loan').update(loan.id, {
    status: 'returned',
    returnedOn: now.toISOString(),
    condition,
  });
  const updatedLoaner = await store.repo('Loaner').update(loaner.id, {
    wears: outcome.nextWears,
    status: outcome.nextStatus,
  });

  const prof = profiles.find((p) => p.personSub === loan.borrowerSub);
  if (prof) {
    await store.repo('BorrowerProfile').update(prof.id, {
      lastLoanOn: now.toISOString(),
    });
  }

  return { loan: updatedLoan, loaner: updatedLoaner, fee, retired: outcome.shouldRetire };
}

export async function markLoanerClean(
  store: DataStore<Schema>,
  loaner: Loaner,
  actorSub: string,
  isAdmin: boolean,
): Promise<Loaner> {
  if (actorSub !== loaner.curatorSub && !isAdmin) {
    throw new PermissionError('Only the curator can mark a loaner clean.');
  }
  if (loaner.status !== 'cleaning') {
    throw new RuleError('Only loaners in cleaning can be marked clean.');
  }
  return store.repo('Loaner').update(loaner.id, { status: 'shelf' });
}

export async function upsertBorrowerProfile(
  store: DataStore<Schema>,
  existing: BorrowerProfile | null,
  personSub: string,
  chestCm: number,
): Promise<BorrowerProfile> {
  if (!Number.isInteger(chestCm) || chestCm < 70 || chestCm > 160) {
    throw new RuleError('Chest measurement must be between 70 and 160 cm.');
  }
  if (existing) {
    return store.repo('BorrowerProfile').update(existing.id, { chestCm });
  }
  return store.repo('BorrowerProfile').create({
    id: crypto.randomUUID(),
    personSub,
    chestCm,
    lastLoanOn: null,
  });
}
