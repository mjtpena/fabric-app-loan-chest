import { useCallback, useMemo } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Badge,
  DataState,
  PageHeader,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import type { Schema } from '../model';
import { NEVER_BORROWED_PRIORITY } from '../domain/config';
import { allocateQueue, formatShortDate } from '../domain/rules';
import { loadChestSnapshot } from '../domain/store';

export function WaitingListPage() {
  const { store } = useApp<Schema>();
  const load = useCallback(() => loadChestSnapshot(store), [store]);
  const state = useAsync(load, [load]);

  const ranked = useMemo(() => {
    const data = state.data;
    if (!data) return [];
    const reserved = data.loans.filter((l) => l.status === 'reserved');
    return allocateQueue(reserved, data.profiles, 1, new Date());
  }, [state.data]);

  return (
    <AppShell>
      <PageHeader title="Waiting list" meta="Fair priority queue ranked by days since last loan" />
      <DataState state={state} isEmpty={() => ranked.length === 0}>
        {() => (
          <div className="space-y-6">
            <StatStrip>
              <Stat label="Pending requests" value={String(ranked.length)} />
              <Stat label="Never-borrowed priority" value={String(NEVER_BORROWED_PRIORITY)} />
            </StatStrip>

            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th numeric>Rank</Th>
                    <Th>Borrower</Th>
                    <Th>Sweater</Th>
                    <Th>Window</Th>
                    <Th numeric>Priority</Th>
                    <Th>Reason</Th>
                    <Th>Allocation</Th>
                  </Tr>
                </thead>
                <tbody>
                  {ranked.map((item, idx) => {
                    const ln = state.data?.loaners.find((l) => l.id === item.loanerId);
                    return (
                      <Tr key={item.id}>
                        <Td numeric className="font-semibold">#{idx + 1}</Td>
                        <Td className="font-medium">{item.borrowerName}</Td>
                        <Td className="font-mono">{ln?.tag ?? item.loanerId}</Td>
                        <Td>{formatShortDate(item.startsOn)} – {formatShortDate(item.dueOn)}</Td>
                        <Td numeric>{item.priority}</Td>
                        <Td>{item.reason}</Td>
                        <Td>
                          <Badge tone={item.allocated ? 'ok' : 'neutral'}>
                            {item.allocated ? 'Allocated' : 'Queued'}
                          </Badge>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        )}
      </DataState>
    </AppShell>
  );
}
