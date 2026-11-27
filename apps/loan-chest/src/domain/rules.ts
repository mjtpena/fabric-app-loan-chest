import type { BorrowerProfile, Loan, LoanCondition, Loaner, LoanerStatus } from '../model';
import {
  CLEAN_DAYS,
  EXTENSION_DAYS_MAX,
  FEE_PER_DAY,
  FIT_EASE,
  GRACE_DAYS,
  IDEAL_EASE_CM,
  LOAN_DAYS_MAX,
  MAX_WEARS,
  NEVER_BORROWED_PRIORITY,
} from './config';

const DAY_MS = 86_400_000;

export function toUtcDayMs(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function diffDays(start: Date | string, end: Date | string): number {
  return Math.round((toUtcDayMs(end) - toUtcDayMs(start)) / DAY_MS);
}

export function addUtcDays(date: Date | string, days: number): Date {
  return new Date(toUtcDayMs(date) + days * DAY_MS);
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  loanDays: number;
  nextFreeDate: Date | null;
}

/**
 * Rule 1: Availability & cleaning turnaround.
 * A loaner is free for [s, e] only if for every other reserved/out/returned loan [a, b],
 * e + CLEAN_DAYS <= a or b + CLEAN_DAYS <= s. Loan length <= LOAN_DAYS_MAX.
 */
export function checkAvailability(
  loaner: Loaner,
  loans: Loan[],
  startsOn: Date | string,
  dueOn: Date | string,
  ignoreLoanId?: string,
): AvailabilityResult {
  const loanDays = diffDays(startsOn, dueOn);
  if (loaner.status === 'retired') {
    return { available: false, reason: 'This loaner is retired.', loanDays, nextFreeDate: null };
  }
  if (loaner.status === 'repair') {
    return { available: false, reason: 'This loaner is currently in repair.', loanDays, nextFreeDate: null };
  }
  if (loanDays <= 0) {
    return { available: false, reason: 'Return date must be after start date.', loanDays, nextFreeDate: null };
  }
  if (loanDays > LOAN_DAYS_MAX) {
    return {
      available: false,
      reason: `Loan length (${loanDays} days) exceeds the maximum of ${LOAN_DAYS_MAX} days.`,
      loanDays,
      nextFreeDate: null,
    };
  }

  const s = toUtcDayMs(startsOn);
  const e = toUtcDayMs(dueOn);
  const relevant = loans.filter(
    (l) => l.loanerId === loaner.id && l.id !== ignoreLoanId && l.status !== 'cancelled',
  );

  let latestBlockerEnd = 0;
  for (const l of relevant) {
    const a = toUtcDayMs(l.startsOn);
    const b = toUtcDayMs(l.status === 'returned' && l.returnedOn ? l.returnedOn : l.dueOn);
    // Check overlap with CLEAN_DAYS gap
    const clearBefore = e + CLEAN_DAYS * DAY_MS <= a;
    const clearAfter = b + CLEAN_DAYS * DAY_MS <= s;
    if (!clearBefore && !clearAfter) {
      if (b > latestBlockerEnd) latestBlockerEnd = b;
    }
  }

  if (latestBlockerEnd > 0) {
    const nextFreeDate = new Date(latestBlockerEnd + CLEAN_DAYS * DAY_MS);
    return {
      available: false,
      reason: `Unavailable during ${CLEAN_DAYS}-day cleaning turnaround; next free ${formatShortDate(nextFreeDate)}.`,
      loanDays,
      nextFreeDate,
    };
  }

  return { available: true, loanDays, nextFreeDate: new Date(s) };
}

/** Compute the earliest free date for a loaner from `now`. */
export function nextFreeDateForLoaner(loaner: Loaner, loans: Loan[], now: Date): Date | null {
  if (loaner.status === 'retired' || loaner.status === 'repair') return null;
  const nowMs = toUtcDayMs(now);
  const relevant = loans
    .filter((l) => l.loanerId === loaner.id && l.status !== 'cancelled')
    .map((l) => ({
      a: toUtcDayMs(l.startsOn),
      b: toUtcDayMs(l.status === 'returned' && l.returnedOn ? l.returnedOn : l.dueOn),
    }))
    .sort((x, y) => x.a - y.a);

  let candidate = nowMs;
  if (loaner.status === 'cleaning') {
    candidate = nowMs + CLEAN_DAYS * DAY_MS;
  }
  for (const iv of relevant) {
    if (iv.b + CLEAN_DAYS * DAY_MS > candidate && iv.a <= candidate + CLEAN_DAYS * DAY_MS) {
      candidate = Math.max(candidate, iv.b + CLEAN_DAYS * DAY_MS);
    }
  }
  return new Date(candidate);
}

export interface FitResult {
  ease: number;
  fits: boolean;
  closenessToIdeal: number;
}

/** Rule 2: Fit check (0 <= ease <= 20 cm, ranked by closeness to 10 cm). */
export function computeFit(loanerChestCm: number, borrowerChestCm: number): FitResult {
  const ease = loanerChestCm - borrowerChestCm;
  const fits = ease >= FIT_EASE[0] && ease <= FIT_EASE[1];
  return { ease, fits, closenessToIdeal: Math.abs(ease - IDEAL_EASE_CM) };
}

export interface QueueRequest {
  id: string;
  borrowerSub: string;
  borrowerName: string;
  loanerId: string;
  startsOn: string;
  dueOn: string;
  createdAt: string;
}

export interface RankedQueueItem extends QueueRequest {
  priority: number;
  reason: string;
  allocated: boolean;
}

/** Rule 3: Fair queue allocation. */
export function allocateQueue(
  requests: QueueRequest[],
  profiles: BorrowerProfile[],
  availableCount: number,
  now: Date,
): RankedQueueItem[] {
  const profileBySub = new Map(profiles.map((p) => [p.personSub, p]));

  const scored = requests.map((req) => {
    const prof = profileBySub.get(req.borrowerSub);
    if (!prof || !prof.lastLoanOn) {
      return {
        ...req,
        priority: NEVER_BORROWED_PRIORITY,
        reason: `Never borrowed (priority ${NEVER_BORROWED_PRIORITY})`,
      };
    }
    const daysSince = Math.max(0, diffDays(prof.lastLoanOn, now));
    const priority = Math.min(daysSince, NEVER_BORROWED_PRIORITY);
    return {
      ...req,
      priority,
      reason: `${daysSince}d since last loan (priority ${priority})`,
    };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const awardedBorrowers = new Set<string>();
  let remaining = Math.max(0, availableCount);

  return scored.map((item) => {
    if (remaining > 0 && !awardedBorrowers.has(item.borrowerSub)) {
      awardedBorrowers.add(item.borrowerSub);
      remaining -= 1;
      return { ...item, allocated: true };
    }
    return { ...item, allocated: false };
  });
}

export interface ExtensionCheck {
  allowed: boolean;
  reason?: string;
  newDueOn?: Date;
}

/** Rule 4a: One extension of up to 2 days if no reservation follows within CLEAN_DAYS. */
export function canExtendLoan(loan: Loan, allLoans: Loan[], extraDays = EXTENSION_DAYS_MAX): ExtensionCheck {
  if (loan.status !== 'out') {
    return { allowed: false, reason: 'Only loans currently out can be extended.' };
  }
  if (loan.extended) {
    return { allowed: false, reason: 'This loan has already been extended once.' };
  }
  if (extraDays < 1 || extraDays > EXTENSION_DAYS_MAX) {
    return { allowed: false, reason: `Extensions can be at most ${EXTENSION_DAYS_MAX} days.` };
  }

  const newDueOn = addUtcDays(loan.dueOn, extraDays);
  const newDueMs = toUtcDayMs(newDueOn);

  const conflict = allLoans.find(
    (other) =>
      other.loanerId === loan.loanerId &&
      other.id !== loan.id &&
      other.status === 'reserved' &&
      toUtcDayMs(other.startsOn) < newDueMs + CLEAN_DAYS * DAY_MS,
  );
  if (conflict) {
    return {
      allowed: false,
      reason: `Cannot extend: ${conflict.borrowerName} has a reservation starting ${formatShortDate(conflict.startsOn)}.`,
    };
  }

  return { allowed: true, newDueOn };
}

export interface LatenessResult {
  daysLate: number;
  fee: number;
}

/** Rule 4b: Lateness fee = max(0, daysLate - GRACE_DAYS) * FEE_PER_DAY (donation, never blocks return). */
export function computeLatenessFee(dueOn: Date | string, asOf: Date | string): LatenessResult {
  const daysLate = Math.max(0, diffDays(dueOn, asOf));
  const chargeableDays = Math.max(0, daysLate - GRACE_DAYS);
  return { daysLate, fee: chargeableDays * FEE_PER_DAY };
}

export interface ReturnOutcome {
  nextWears: number;
  damagedCount: number;
  shouldRetire: boolean;
  nextStatus: LoanerStatus;
}

/** Rule 5: Retirement & cleaning on return. */
export function evaluateReturn(
  loaner: Loaner,
  priorLoans: Loan[],
  condition: LoanCondition,
): ReturnOutcome {
  const nextWears = loaner.wears + 1;
  const priorDamaged = priorLoans.filter(
    (l) => l.loanerId === loaner.id && l.status === 'returned' && l.condition === 'damaged',
  ).length;
  const damagedCount = priorDamaged + (condition === 'damaged' ? 1 : 0);
  const shouldRetire = nextWears >= (loaner.maxWears || MAX_WEARS) || damagedCount >= 2;
  const nextStatus: LoanerStatus = shouldRetire ? 'retired' : 'cleaning';
  return { nextWears, damagedCount, shouldRetire, nextStatus };
}

/** Deterministic festive sweater colour from tag (no red+green pairing; rich winter knit tones). */
const KNIT_SWATCHES = [
  '#4f6d43', // pine olive
  '#7a5c3e', // chestnut wool
  '#3e5c76', // winter slate
  '#8c4a3e', // mulled terracotta
  '#6b5b7b', // heather plum
  '#4a7068', // spruce teal
  '#9c7a3c', // ochre brass
  '#52604c', // moss knit
];

export function swatchForTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return KNIT_SWATCHES[Math.abs(hash) % KNIT_SWATCHES.length]!;
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
