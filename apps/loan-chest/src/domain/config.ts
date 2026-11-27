import type { LoanerSize } from '../model';

export const LOAN_DAYS_MAX = 4;
export const CLEAN_DAYS = 2;
export const GRACE_DAYS = 1;
export const FEE_PER_DAY = 1.0;
export const MAX_WEARS = 12;
export const FIT_EASE: readonly [number, number] = [0, 20];
export const IDEAL_EASE_CM = 10;
export const NEVER_BORROWED_PRIORITY = 60;
export const EXTENSION_DAYS_MAX = 2;
export const DRAWERS_PER_CHEST = 18;

export const LOANER_SIZES: readonly LoanerSize[] = ['s', 'm', 'l', 'xl', 'xxl'] as const;

export const SIZE_LABEL: Record<LoanerSize, string> = {
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: 'XXL',
};
