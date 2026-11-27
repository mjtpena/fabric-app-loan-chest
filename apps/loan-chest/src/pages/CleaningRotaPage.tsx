import { useCallback, useMemo, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Badge,
  Button,
  DataState,
  InlineError,
  PageHeader,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import type { Loaner, Schema } from '../model';
import { CLEAN_DAYS, SIZE_LABEL } from '../domain/config';
import { loadChestSnapshot, markLoanerClean } from '../domain/store';

export function CleaningRotaPage() {
  const { store, me, isAdmin } = useApp<Schema>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => loadChestSnapshot(store), [store]);
  const state = useAsync(load, [load]);

  const cleaning = useMemo(
    () => state.data?.loaners.filter((l) => l.status === 'cleaning') ?? [],
    [state.data],
  );

  const handleMarkClean = async (loaner: Loaner) => {
    setErr(null);
    setBusyId(loaner.id);
    try {
      await markLoanerClean(store, loaner, me.sub, isAdmin);
      await state.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not mark clean.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Cleaning rota" meta={`${CLEAN_DAYS}-day wash & steam turnaround`} />
      <DataState state={state} isEmpty={() => cleaning.length === 0}>
        {() => (
          <div className="space-y-6">
            <StatStrip>
              <Stat label="In cleaning" value={String(cleaning.length)} />
              <Stat label="Turnaround" value={`${CLEAN_DAYS} days`} />
            </StatStrip>

            <InlineError error={err} />

            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>Tag</Th>
                    <Th>Sweater</Th>
                    <Th>Size</Th>
                    <Th>Fibre</Th>
                    <Th>Lights</Th>
                    {isAdmin && <Th>Action</Th>}
                  </Tr>
                </thead>
                <tbody>
                  {cleaning.map((l) => (
                    <Tr key={l.id}>
                      <Td className="font-mono font-medium">{l.tag}</Td>
                      <Td>{l.title}</Td>
                      <Td>{SIZE_LABEL[l.size]}</Td>
                      <Td>{l.fibre}</Td>
                      <Td>
                        <Badge tone={l.lights ? 'warn' : 'neutral'}>
                          {l.lights ? 'Remove battery' : 'Standard'}
                        </Badge>
                      </Td>
                      {isAdmin && (
                        <Td>
                          <Button size="sm" variant="secondary" disabled={busyId === l.id} onClick={() => handleMarkClean(l)}>
                            Mark clean
                          </Button>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        )}
      </DataState>
    </AppShell>
  );
}
