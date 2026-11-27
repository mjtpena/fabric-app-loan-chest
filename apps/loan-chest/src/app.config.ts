/**
 * App configuration. No React imports here: tools/seed-fabric.mjs loads this file in Node to export seed rows.
 */
import type { Persona } from '@x10/shared/identity';
import type { AppConfig } from '@x10/shared/runtime';

import { defs, type Schema } from './model';
import { seed } from './seed';

export const personas: Persona[] = [
  { sub: 'demo-admin', name: 'Alex Rivera', email: 'alex@example.com', isAdmin: true, role: 'Curator' },
  { sub: 'demo-borrower', name: 'Sam Taylor', email: 'sam@example.com', isAdmin: false, role: 'Borrower' },
  { sub: 'demo-newcomer', name: 'Jordan Lee', email: 'jordan@example.com', isAdmin: false, role: 'Newcomer' },
];

export const config: AppConfig<Schema> = {
  appId: 'loan-chest',
  title: 'Loan Chest',
  tagline: 'Loaner sweater lending library',
  accent: 'olive',
  logoPaths: [
    'M4 5h16v14H4V5Z',
    'M4 10h16M4 14.5h16M10 7.5h4M10 12.25h4M10 16.75h4',
  ],
  defs,
  personas,
  seed,
  nav: [
    { to: '/', label: 'Loan chest', end: true },
    { to: '/drawer-pull', label: 'Drawer pull' },
    { to: '/return-slip', label: 'Return slip' },
    { to: '/cleaning-rota', label: 'Cleaning rota' },
    { to: '/waiting-list', label: 'Waiting list' },
    { to: '/measuring-tape', label: 'Measuring tape' },
    { to: '/about', label: 'About' },
  ],
};
