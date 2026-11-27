import type { EntityDefs } from '@x10/shared/data';
import { AppMarkerDef, PersonDef, type AppMarker, type Person } from '@x10/shared/identity';

export type LoanerSize = 's' | 'm' | 'l' | 'xl' | 'xxl';
export type LoanerFibre = 'wool' | 'cotton' | 'acrylic' | 'blend';
export type LoanerStatus = 'shelf' | 'on_loan' | 'cleaning' | 'repair' | 'retired';
export type LoanStatus = 'reserved' | 'out' | 'returned' | 'cancelled';
export type LoanCondition = 'clean' | 'worn' | 'stained' | 'damaged';

export const limits = {
  tag: { min: 2, max: 12 },
  title: { min: 3, max: 80 },
  personName: { min: 1, max: 100 },
} as const;

export interface Loaner {
  id: string;
  tag: string;
  title: string;
  size: LoanerSize;
  chestCm: number;
  fibre: LoanerFibre;
  lights: boolean;
  status: LoanerStatus;
  wears: number;
  maxWears: number;
  curatorSub: string;
  curatorName: string;
}

export interface Loan {
  id: string;
  loanerId: string;
  borrowerSub: string;
  borrowerName: string;
  startsOn: string;
  dueOn: string;
  returnedOn: string | null;
  status: LoanStatus;
  condition: LoanCondition | null;
  extended: boolean;
  curatorSub: string;
  createdAt: string;
}

export interface BorrowerProfile {
  id: string;
  personSub: string;
  chestCm: number;
  lastLoanOn: string | null;
}

export interface Schema {
  Person: Person;
  AppMarker: AppMarker;
  Loaner: Loaner;
  Loan: Loan;
  BorrowerProfile: BorrowerProfile;
}

export const defs: EntityDefs<Schema> = {
  Person: PersonDef,
  AppMarker: AppMarkerDef,
  Loaner: {
    name: 'Loaner',
    fields: {
      id: 'uuid',
      tag: 'text',
      title: 'text',
      size: 'set',
      chestCm: 'int',
      fibre: 'set',
      lights: 'bool',
      status: 'set',
      wears: 'int',
      maxWears: 'int',
      curatorSub: 'text',
      curatorName: 'text',
    },
  },
  Loan: {
    name: 'Loan',
    fields: {
      id: 'uuid',
      loanerId: 'uuid',
      borrowerSub: 'text',
      borrowerName: 'text',
      startsOn: 'date',
      dueOn: 'date',
      returnedOn: 'date',
      status: 'set',
      condition: 'text',
      extended: 'bool',
      curatorSub: 'text',
      createdAt: 'date',
    },
  },
  BorrowerProfile: {
    name: 'BorrowerProfile',
    fields: {
      id: 'uuid',
      personSub: 'text',
      chestCm: 'int',
      lastLoanOn: 'date',
    },
  },
};
