import { useCallback, useMemo, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Badge,
  Button,
  DataState,
  Field,
  InlineError,
  Input,
  PageHeader,
  Section,
  Select,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import type { Schema } from '../model';
import { CLEAN_DAYS, LOAN_DAYS_MAX, SIZE_LABEL } from '../domain/config';
import { addUtcDays, checkAvailability, computeFit, formatShortDate } from '../domain/rules';
import { loadChestSnapshot, reserveLoaner } from '../domain/store';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DrawerPullPage() {
  const { store, me } = useApp<Schema>();
  const [selectedLoanerId, setSelectedLoanerId] = useState<string>('');
  const [startsOn, setStartsOn] = useState(() => isoDay(addUtcDays(new Date(), 3)));
  const [dueOn, setDueOn] = useState(() => isoDay(addUtcDays(new Date(), 5)));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(() => loadChestSnapshot(store), [store]);
  const state = useAsync(load, [load]);

  const computed = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const activeLoaners = data.loaners.filter((l) => l.status !== 'retired');
    const chosenId = selectedLoanerId || activeLoaners[14]?.id || activeLoaners[0]?.id || '';
    const chosen = activeLoaners.find((l) => l.id === chosenId) ?? null;
    const myProfile = data.profiles.find((p) => p.personSub === me.sub) ?? null;
    const avail = chosen
      ? checkAvailability(chosen, data.loans, `${startsOn}T00:00:00.000Z`, `${dueOn}T00:00:00.000Z`)
      : null;
    const myLoans = data.loans.filter((l) => l.borrowerSub === me.sub && l.status !== 'cancelled');
    return { activeLoaners, chosen, myProfile, avail, myLoans, allLoans: data.loans };
  }, [state.data, selectedLoanerId, startsOn, dueOn, me.sub]);

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!computed?.chosen) return;
    setErr(null);
    setOkMsg(null);
    setSaving(true);
    try {
      await reserveLoaner(store, {
        loaner: computed.chosen,
        existingLoans: computed.allLoans,
        borrowerSub: me.sub,
        borrowerName: me.displayName,
        startsOn: `${startsOn}T00:00:00.000Z`,
        dueOn: `${dueOn}T00:00:00.000Z`,
      });
      setOkMsg(`Reserved ${computed.chosen.tag} (${computed.chosen.title}).`);
      await state.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not reserve loaner.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Drawer pull" meta="Reserve a loaner sweater with automatic cleaning turnaround" />
      <DataState state={state} isEmpty={() => !computed}>
        {() =>
          computed ? (
            <div className="space-y-6">
              <StatStrip>
                <Stat label="Max loan length" value={`${LOAN_DAYS_MAX} days`} />
                <Stat label="Cleaning gap" value={`${CLEAN_DAYS} days`} />
                <Stat label="Your chest" value={computed.myProfile ? `${computed.myProfile.chestCm} cm` : 'Not set'} />
                <Stat label="Your active loans" value={String(computed.myLoans.filter((l) => l.status !== 'returned').length)} />
              </StatStrip>

              <Section title="New reservation">
                <form onSubmit={handleReserve} className="space-y-4 max-w-xl">
                  <Field label="Sweater" htmlFor="dp-loaner">
                    <Select
                      id="dp-loaner"
                      value={computed.chosen?.id ?? ''}
                      onChange={(e) => setSelectedLoanerId(e.target.value)}
                    >
                      {computed.activeLoaners.map((l) => {
                        const fit = computed.myProfile ? computeFit(l.chestCm, computed.myProfile.chestCm) : null;
                        return (
                          <option key={l.id} value={l.id}>
                            {l.tag} · {l.title} ({SIZE_LABEL[l.size]}, {l.chestCm} cm){fit?.fits ? ' — fits' : ''}
                          </option>
                        );
                      })}
                    </Select>
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Start date" htmlFor="dp-start">
                      <Input id="dp-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
                    </Field>
                    <Field label="Return date" htmlFor="dp-due">
                      <Input id="dp-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
                    </Field>
                  </div>

                  {computed.avail && !computed.avail.available && (
                    <InlineError error={computed.avail.reason ?? 'Not available'} />
                  )}
                  <InlineError error={err} />
                  {okMsg && <p className="text-sm text-ok font-medium">{okMsg}</p>}

                  <Button type="submit" disabled={saving}>
                    {saving ? 'Reserving…' : 'Reserve sweater'}
                  </Button>
                </form>
              </Section>

              <Section title="Your loans & reservations">
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Sweater</Th>
                        <Th>Start</Th>
                        <Th>Due</Th>
                        <Th>Status</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {computed.myLoans.map((l) => {
                        const ln = state.data?.loaners.find((x) => x.id === l.loanerId);
                        return (
                          <Tr key={l.id}>
                            <Td className="font-medium">{ln ? `${ln.tag} · ${ln.title}` : l.loanerId}</Td>
                            <Td>{formatShortDate(l.startsOn)}</Td>
                            <Td>{formatShortDate(l.dueOn)}</Td>
                            <Td>
                              <Badge tone={l.status === 'out' ? 'warn' : l.status === 'reserved' ? 'info' : 'ok'}>
                                {l.status}
                              </Badge>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              </Section>
            </div>
          ) : null
        }
      </DataState>
    </AppShell>
  );
}
