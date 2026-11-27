import { useCallback, useMemo, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Badge,
  Button,
  DataState,
  InlineError,
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

import type { LoanCondition, Schema } from '../model';
import { computeLatenessFee, formatMoney, formatShortDate } from '../domain/rules';
import { checkInReturn, loadChestSnapshot } from '../domain/store';

export function ReturnSlipPage() {
  const { store, me, isAdmin } = useApp<Schema>();
  const [conditions, setConditions] = useState<Record<string, LoanCondition>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => loadChestSnapshot(store), [store]);
  const state = useAsync(load, [load]);

  const computed = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const now = new Date();
    const outLoans = data.loans
      .filter((l) => l.status === 'out')
      .map((loan) => {
        const loaner = data.loaners.find((x) => x.id === loan.loanerId)!;
        const late = computeLatenessFee(loan.dueOn, now);
        return { loan, loaner, late };
      })
      .filter((x) => Boolean(x.loaner));
    const totalJar = outLoans.reduce((s, x) => s + x.late.fee, 0);
    return { outLoans, totalJar, allLoans: data.loans, profiles: data.profiles };
  }, [state.data]);

  const handleCheckIn = async (loanId: string) => {
    if (!computed) return;
    const row = computed.outLoans.find((r) => r.loan.id === loanId);
    if (!row) return;
    setErr(null);
    setNotice(null);
    setBusyId(loanId);
    try {
      const cond = conditions[loanId] ?? 'clean';
      const res = await checkInReturn(
        store,
        row.loan,
        row.loaner,
        computed.allLoans,
        computed.profiles,
        cond,
        me.sub,
        isAdmin,
      );
      setNotice(
        res.retired
          ? `${row.loaner.tag} reached ${res.loaner.wears} wears and has been retired.`
          : `${row.loaner.tag} checked in for cleaning.${res.fee > 0 ? ` Charity jar donation: ${formatMoney(res.fee)}.` : ''}`,
      );
      await state.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Check-in failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Return slip" meta="Curator check-in, condition log, and automatic retirement" />
      <DataState state={state} isEmpty={() => !computed}>
        {() =>
          computed ? (
            <div className="space-y-6">
              <StatStrip>
                <Stat label="Currently out" value={String(computed.outLoans.length)} />
                <Stat label="Overdue" value={String(computed.outLoans.filter((x) => x.late.daysLate > 0).length)} />
                <Stat label="Pending jar donations" value={formatMoney(computed.totalJar)} />
              </StatStrip>

              <InlineError error={err} />
              {notice && <p className="text-sm text-ok font-medium">{notice}</p>}

              <Section title="Active loans">
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Tag</Th>
                        <Th>Borrower</Th>
                        <Th>Due</Th>
                        <Th numeric>Wears</Th>
                        <Th numeric>Jar donation</Th>
                        <Th>Condition</Th>
                        {isAdmin && <Th>Action</Th>}
                      </Tr>
                    </thead>
                    <tbody>
                      {computed.outLoans.map(({ loan, loaner, late }) => (
                        <Tr key={loan.id}>
                          <Td className="font-mono font-medium">{loaner.tag}</Td>
                          <Td>{loan.borrowerName}</Td>
                          <Td>
                            {formatShortDate(loan.dueOn)}{' '}
                            {late.daysLate > 0 && <Badge tone="bad">+{late.daysLate}d</Badge>}
                          </Td>
                          <Td numeric>{loaner.wears}/{loaner.maxWears}</Td>
                          <Td numeric>{formatMoney(late.fee)}</Td>
                          <Td>
                            <Select
                              aria-label={`Condition for ${loaner.tag}`}
                              value={conditions[loan.id] ?? 'clean'}
                              onChange={(e) =>
                                setConditions((prev) => ({ ...prev, [loan.id]: e.target.value as LoanCondition }))
                              }
                            >
                              <option value="clean">Clean</option>
                              <option value="worn">Worn</option>
                              <option value="stained">Stained</option>
                              <option value="damaged">Damaged</option>
                            </Select>
                          </Td>
                          {isAdmin && (
                            <Td>
                              <Button
                                size="sm"
                                disabled={busyId === loan.id}
                                onClick={() => handleCheckIn(loan.id)}
                              >
                                Check in
                              </Button>
                            </Td>
                          )}
                        </Tr>
                      ))}
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
