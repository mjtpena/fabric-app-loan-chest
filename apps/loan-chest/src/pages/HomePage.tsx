import { useCallback, useMemo, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync, usePolling } from '@x10/shared/lib';
import {
  Badge,
  DataState,
  Legend,
  LensBar,
  StagePage,
  Table,
  TableWrap,
  Td,
  Th,
  TodayPanel,
  Tr,
  ViewAsSwitch,
  ViewToggle,
  useHotkeys,
  type TodayItem,
} from '@x10/shared/ui';

import type { Schema } from '../model';
import { DRAWERS_PER_CHEST, SIZE_LABEL } from '../domain/config';
import { computeLatenessFee, formatMoney } from '../domain/rules';
import { loadChestSnapshot } from '../domain/store';
import { LoanChestSvg, type ChestLens } from '../components/LoanChestSvg';

const LENSES: Array<{ value: ChestLens; label: string; key: string }> = [
  { value: 'status', label: 'Status', key: '1' },
  { value: 'wear', label: 'Wear', key: '2' },
  { value: 'size', label: 'Size', key: '3' },
  { value: 'queue', label: 'Queue', key: '4' },
  { value: 'nextFree', label: 'Next free', key: '5' },
];

export function HomePage() {
  const { store, me, isAdmin } = useApp<Schema>();
  const [view, setView] = useState<'stage' | 'list'>('stage');
  const [lens, setLens] = useState<ChestLens>('status');
  const [viewAs, setViewAs] = useState<'curator' | 'borrower'>(isAdmin ? 'curator' : 'borrower');
  const [chestIndex, setChestIndex] = useState(0);
  const [focusedLoanerId, setFocusedLoanerId] = useState<string | null>(null);
  const [activeTodayId, setActiveTodayId] = useState<string | null>(null);

  const load = useCallback(() => loadChestSnapshot(store), [store]);
  const state = useAsync(load, [load]);
  usePolling(state.reload, 5000);

  useHotkeys({
    '1': () => setLens('status'),
    '2': () => setLens('wear'),
    '3': () => setLens('size'),
    '4': () => setLens('queue'),
    '5': () => setLens('nextFree'),
    v: () => setViewAs((p) => (p === 'curator' ? 'borrower' : 'curator')),
    l: () => setView((p) => (p === 'stage' ? 'list' : 'stage')),
  });

  const computed = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const now = new Date();
    const myProfile = data.profiles.find((p) => p.personSub === me.sub) ?? null;
    const overdue = data.loans
      .filter((l) => l.status === 'out')
      .map((l) => ({ loan: l, late: computeLatenessFee(l.dueOn, now) }))
      .filter((x) => x.late.daysLate > 0);
    const cleaning = data.loaners.filter((l) => l.status === 'cleaning');
    const nearRetire = data.loaners.filter((l) => l.status !== 'retired' && l.wears >= l.maxWears - 1);
    const reservedByLoaner = new Map<string, number>();
    for (const l of data.loans) {
      if (l.status === 'reserved') {
        reservedByLoaner.set(l.loanerId, (reservedByLoaner.get(l.loanerId) ?? 0) + 1);
      }
    }
    const conflicts = [...reservedByLoaner.entries()].filter(([, c]) => c > 1);
    return { ...data, myProfile, overdue, cleaning, nearRetire, conflicts };
  }, [state.data, me.sub]);

  const todayItems: TodayItem[] = useMemo(() => {
    if (!computed) return [];
    const items: TodayItem[] = [];
    if (computed.overdue.length > 0) {
      const worst = computed.overdue[0]!;
      const loaner = computed.loaners.find((l) => l.id === worst.loan.loanerId);
      items.push({
        id: `overdue:${worst.loan.loanerId}`,
        severity: 'bad',
        title: `${computed.overdue.length} overdue loans (${loaner?.tag ?? ''} +${worst.late.daysLate}d)`,
        meta: `Jar donation ${formatMoney(worst.late.fee)} (1-day grace applied).`,
      });
    }
    if (computed.nearRetire.length > 0) {
      const l = computed.nearRetire[0]!;
      items.push({
        id: `retire:${l.id}`,
        severity: 'warn',
        title: `${l.tag} near retirement (${l.wears}/${l.maxWears} wears)`,
        meta: 'Next return retires this sweater automatically.',
      });
    }
    if (computed.conflicts.length > 0) {
      const [loanerId, count] = computed.conflicts[0]!;
      const loaner = computed.loaners.find((l) => l.id === loanerId);
      items.push({
        id: `conflict:${loanerId}`,
        severity: 'warn',
        title: `${count} requests waiting for ${loaner?.tag ?? 'sweater'}`,
        meta: 'Fair queue ranks by days since last loan.',
      });
    }
    if (computed.cleaning.length > 0) {
      items.push({
        id: `clean:${computed.cleaning[0]!.id}`,
        severity: 'info',
        title: `${computed.cleaning.length} sweaters in cleaning`,
        meta: '2-day turnaround before next checkout.',
      });
    }
    return items.slice(0, 5);
  }, [computed]);

  const handleTodaySelect = (item: TodayItem) => {
    setActiveTodayId(item.id);
    const [kind, loanerId] = item.id.split(':');
    if (loanerId && computed) {
      const idx = computed.loaners.findIndex((l) => l.id === loanerId);
      if (idx >= 0) {
        setChestIndex(Math.floor(idx / DRAWERS_PER_CHEST));
        setFocusedLoanerId(loanerId);
      }
    }
    if (kind === 'retire') setLens('wear');
    else if (kind === 'conflict') setLens('queue');
    else setLens('status');
  };

  const resetFocus = () => {
    setFocusedLoanerId(null);
    setActiveTodayId(null);
  };

  return (
    <AppShell immersive>
      <DataState state={state} isEmpty={() => !computed || computed.loaners.length === 0}>
        {() =>
          computed ? (
            <StagePage
              label="Loan chest"
              view={view}
              title="The Loan Chest"
              meta={`${computed.loaners.length} sweaters · ${computed.loaners.filter((l) => l.status === 'shelf').length} on shelf · ${computed.overdue.length} overdue`}
              breadcrumb={[{ label: `Chest ${chestIndex + 1}`, onClick: resetFocus }]}
              topRight={
                <ViewToggle
                  value={view}
                  onChange={setView}
                  stageLabel="Chest"
                  listLabel="List"
                  glass={view === 'stage'}
                />
              }
              lenses={<LensBar lenses={LENSES} value={lens} onChange={(v) => setLens(v as ChestLens)} />}
              legend={
                <Legend
                  title="Drawer key"
                  collapsible
                  items={[
                    { label: 'Pulled out = on loan', color: 'var(--accent-9)' },
                    { label: 'Amber & askew = overdue', color: 'var(--warn-solid)' },
                    { label: 'STEAM tag = cleaning (2d)', color: 'var(--info-solid)' },
                  ]}
                />
              }
              bottomRight={
                <ViewAsSwitch
                  options={[
                    { value: 'curator', label: 'Curator' },
                    { value: 'borrower', label: 'Borrower' },
                  ]}
                  value={viewAs}
                  onChange={(v) => setViewAs(v as 'curator' | 'borrower')}
                />
              }
              side={
                <TodayPanel
                  bare
                  items={todayItems}
                  activeId={activeTodayId ?? undefined}
                  onSelect={handleTodaySelect}
                />
              }
              sideCount={todayItems.length}
              stage={
                <div className="w-full h-full lg:w-[calc(100%-var(--side-w,0px))] flex items-center justify-center">
                  <LoanChestSvg
                    loaners={computed.loaners}
                    loans={computed.loans}
                    chestIndex={chestIndex}
                    onSelectChest={setChestIndex}
                    lens={lens}
                    viewAs={viewAs}
                    borrowerProfile={computed.myProfile}
                    focusedLoanerId={focusedLoanerId}
                    onSelectLoaner={setFocusedLoanerId}
                  />
                </div>
              }
              list={
                <div className="p-4 sm:p-6 max-w-5xl mx-auto">
                  <TableWrap>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>Tag</Th>
                          <Th>Sweater</Th>
                          <Th>Size</Th>
                          <Th numeric>Chest (cm)</Th>
                          <Th numeric>Wears</Th>
                          <Th>Status</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {computed.loaners.map((l) => (
                          <Tr key={l.id}>
                            <Td className="font-mono font-medium">{l.tag}</Td>
                            <Td>{l.title}</Td>
                            <Td>{SIZE_LABEL[l.size]}</Td>
                            <Td numeric>{l.chestCm}</Td>
                            <Td numeric>{l.wears}/{l.maxWears}</Td>
                            <Td>
                              <Badge
                                tone={
                                  l.status === 'shelf'
                                    ? 'ok'
                                    : l.status === 'retired'
                                      ? 'bad'
                                      : l.status === 'cleaning'
                                        ? 'info'
                                        : 'warn'
                                }
                              >
                                {l.status}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                </div>
              }
            />
          ) : null
        }
      </DataState>
    </AppShell>
  );
}
