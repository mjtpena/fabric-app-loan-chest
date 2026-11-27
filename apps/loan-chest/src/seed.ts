import type { DataStore } from '@x10/shared/data';
import type { SeedContext } from '@x10/shared/runtime';

import type { LoanerFibre, LoanerSize, LoanerStatus, Schema } from './model';

function addDays(base: Date, days: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days));
  return d.toISOString();
}

function deterministicUuid(tag: string, n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  const prefix = tag.padEnd(8, '0').slice(0, 8);
  return `${prefix}-0000-4000-8000-${hex}`;
}

const TITLES = [
  'Nordic Snowflake Crew', 'Pinecone Jacquard Knit', 'Cedar Cable Pullover', 'Frosted Birch Cardigan',
  'Lantern Fair Isle', 'Winter Cabin Ribbed', 'Spruce Argyle V-Neck', 'Oatmeal Moss Stitch',
  'Alpine Chalet Knit', 'Midnight Starlight Crew', 'Chestnut Waffle Pullover', 'Hearthside Tartan Knit',
  'Mistletoe Mock Neck', 'Glacier Ridge Fisherman', 'Evergreen Basketweave', 'Cinnamon Twill Crew',
  'Solstice Herringbone', 'Frostbite Raglan', 'Birchwood Shawl Collar', 'Tundra Jacquard',
  'Amber Hearth Cardigan', 'Snowdrift Chunky Knit', 'Timberline Striped Crew', 'Velvet Pine Pullover',
  'Icicle Diamond Knit', 'Fir Needle Turtleneck', 'Sleighbell Fair Isle', 'Copper Kettle Knit',
  'Wintergreen Cable', 'Stargazer Merino Crew',
];

const SIZES: LoanerSize[] = ['s', 'm', 'l', 'xl', 'xxl'];
const CHEST_BY_SIZE: Record<LoanerSize, number> = { s: 98, m: 106, l: 114, xl: 122, xxl: 130 };
const FIBRES: LoanerFibre[] = ['wool', 'cotton', 'acrylic', 'blend'];

export async function seed(store: DataStore<Schema>, ctx: SeedContext): Promise<void> {
  const now = ctx.now;
  const curatorSub = ctx.people[0]?.sub ?? ctx.personas[0]?.sub ?? 'demo-admin';
  const curatorName = ctx.people[0]?.displayName ?? ctx.personas[0]?.name ?? 'Alex Rivera';

  // 30 loaners across 2 chests:
  // 8 on_loan (indices 0..7, including #0 overdue by 3d, #1 overdue by 1d, #2 near retirement at 11 wears),
  // 4 cleaning (indices 8..11), 2 repair (12..13), 16 shelf (14..29, 3 of which have upcoming reservations)
  const loanerIds: string[] = [];
  for (let i = 0; i < 30; i++) {
    const id = deterministicUuid('40000001', i + 1);
    loanerIds.push(id);
    const size = SIZES[i % SIZES.length]!;
    let status: LoanerStatus = 'shelf';
    if (i < 8) status = 'on_loan';
    else if (i < 12) status = 'cleaning';
    else if (i < 14) status = 'repair';

    const wears = i === 2 ? 11 : (i * 3) % 9 + 1;
    await store.repo('Loaner').create({
      id,
      tag: `LC-${String(i + 1).padStart(2, '0')}`,
      title: TITLES[i]!,
      size,
      chestCm: CHEST_BY_SIZE[size],
      fibre: FIBRES[i % FIBRES.length]!,
      lights: i % 5 === 0,
      status,
      wears,
      maxWears: 12,
      curatorSub,
      curatorName,
    });
  }

  // 5 borrower profiles (one never borrowed: Jordan Lee)
  const profiles: Array<{ sub: string; chestCm: number; lastLoanDaysAgo: number | null }> = [
    { sub: curatorSub, chestCm: 102, lastLoanDaysAgo: 25 },
    { sub: 'demo-borrower', chestCm: 96, lastLoanDaysAgo: 12 },
    { sub: 'demo-newcomer', chestCm: 98, lastLoanDaysAgo: null }, // never borrowed!
    { sub: 'b-04', chestCm: 108, lastLoanDaysAgo: 40 },
    { sub: 'b-05', chestCm: 116, lastLoanDaysAgo: 5 },
  ];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i]!;
    await store.repo('BorrowerProfile').create({
      id: deterministicUuid('50000001', i + 1),
      personSub: p.sub,
      chestCm: p.chestCm,
      lastLoanOn: p.lastLoanDaysAgo === null ? null : addDays(now, -p.lastLoanDaysAgo),
    });
  }

  // 8 active 'out' loans:
  // #0 overdue by 3 days ($2.00 donation), #1 overdue by 1 day (grace), #2 at 11 wears (12th return retires!)
  const outLoans: Array<{ idx: number; sub: string; name: string; startOff: number; dueOff: number }> = [
    { idx: 0, sub: 'b-04', name: 'Priya Nair', startOff: -7, dueOff: -3 },
    { idx: 1, sub: 'b-05', name: 'Owen Grant', startOff: -5, dueOff: -1 },
    { idx: 2, sub: 'demo-borrower', name: 'Sam Taylor', startOff: -2, dueOff: 1 },
    { idx: 3, sub: 'b-04', name: 'Priya Nair', startOff: -2, dueOff: 2 },
    { idx: 4, sub: 'b-05', name: 'Owen Grant', startOff: -1, dueOff: 2 },
    { idx: 5, sub: 'demo-borrower', name: 'Sam Taylor', startOff: -1, dueOff: 3 },
    { idx: 6, sub: curatorSub, name: curatorName, startOff: -1, dueOff: 2 },
    { idx: 7, sub: 'b-04', name: 'Priya Nair', startOff: 0, dueOff: 3 },
  ];

  let loanSeq = 1;
  for (const ol of outLoans) {
    await store.repo('Loan').create({
      id: deterministicUuid('60000001', loanSeq++),
      loanerId: loanerIds[ol.idx]!,
      borrowerSub: ol.sub,
      borrowerName: ol.name,
      startsOn: addDays(now, ol.startOff),
      dueOn: addDays(now, ol.dueOff),
      returnedOn: null,
      status: 'out',
      condition: null,
      extended: false,
      curatorSub,
      createdAt: addDays(now, ol.startOff - 1),
    });
  }

  // 3 reserved loans (including conflicting requests on LC-16 (index 15, size S/M) for Waiting list demo)
  const reservations: Array<{ idx: number; sub: string; name: string; startOff: number; dueOff: number; createdOff: number }> = [
    { idx: 16, sub: 'b-05', name: 'Owen Grant', startOff: 3, dueOff: 6, createdOff: -3 },
    { idx: 16, sub: 'demo-borrower', name: 'Sam Taylor', startOff: 3, dueOff: 6, createdOff: -2 },
    { idx: 16, sub: 'demo-newcomer', name: 'Jordan Lee', startOff: 3, dueOff: 6, createdOff: -1 },
  ];

  for (const r of reservations) {
    await store.repo('Loan').create({
      id: deterministicUuid('60000001', loanSeq++),
      loanerId: loanerIds[r.idx]!,
      borrowerSub: r.sub,
      borrowerName: r.name,
      startsOn: addDays(now, r.startOff),
      dueOn: addDays(now, r.dueOff),
      returnedOn: null,
      status: 'reserved',
      condition: null,
      extended: false,
      curatorSub,
      createdAt: addDays(now, r.createdOff),
    });
  }
}
