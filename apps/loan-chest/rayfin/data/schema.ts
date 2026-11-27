import { AppMarker } from './AppMarker.js';
import { BorrowerProfile } from './BorrowerProfile.js';
import { Loan } from './Loan.js';
import { Loaner } from './Loaner.js';
import { Person } from './Person.js';

export type AppSchema = {
  Person: Person;
  AppMarker: AppMarker;
  Loaner: Loaner;
  Loan: Loan;
  BorrowerProfile: BorrowerProfile;
};

export const schema = [Person, AppMarker, Loaner, Loan, BorrowerProfile];
