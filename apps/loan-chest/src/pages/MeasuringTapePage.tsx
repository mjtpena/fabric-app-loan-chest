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
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import type { Schema } from '../model';
import { FIT_EASE, IDEAL_EASE_CM, SIZE_LABEL } from '../domain/config';
import { computeFit } from '../domain/rules';
import { loadChestSnapshot, upsertBorrowerProfile } from '../domain/store';

export function MeasuringTapePage() {
  const { store, me } = useApp<Schema>();
  const [chestDraft, setChestDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => loadChestSnapshot(store), [store]);
  const state = useAsync(load, [load]);

  const computed = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const myProfile = data.profiles.find((p) => p.personSub === me.sub) ?? null;
    const chest = chestDraft !== null ? Number(chestDraft) : (myProfile?.chestCm ?? 98);
    const ranked = data.loaners
      .filter((l) => l.status !== 'retired')
      .map((loaner) => ({ loaner, fit: computeFit(loaner.chestCm, chest) }))
      .filter((x) => x.fit.fits)
      .sort((a, b) => a.fit.closenessToIdeal - b.fit.closenessToIdeal);
    return { myProfile, chest, ranked };
  }, [state.data, me.sub, chestDraft]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!computed) return;
    setErr(null);
    setSaving(true);
    try {
      await upsertBorrowerProfile(store, computed.myProfile, me.sub, computed.chest);
      setChestDraft(null);
      await state.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Measuring tape" meta={`Your chest profile and best-fitting sweaters (${FIT_EASE[0]}–${FIT_EASE[1]} cm ease)`} />
      <DataState state={state} isEmpty={() => !computed}>
        {() =>
          computed ? (
            <div className="space-y-6">
              <StatStrip>
                <Stat label="Your chest" value={`${computed.chest} cm`} />
                <Stat label="Ideal ease" value={`+${IDEAL_EASE_CM} cm`} />
                <Stat label="Matching sweaters" value={String(computed.ranked.length)} />
              </StatStrip>

              <Section title="Save your measurement">
                <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
                  <Field label="Chest (cm)" htmlFor="mt-chest">
                    <Input
                      id="mt-chest"
                      type="number"
                      min={70}
                      max={160}
                      value={chestDraft ?? String(computed.myProfile?.chestCm ?? 98)}
                      onChange={(e) => setChestDraft(e.target.value)}
                      className="w-32"
                    />
                  </Field>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save chest size'}
                  </Button>
                </form>
                <InlineError error={err} className="mt-2" />
              </Section>

              <Section title="Best fits in the chest">
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Tag</Th>
                        <Th>Sweater</Th>
                        <Th>Size</Th>
                        <Th numeric>Garment (cm)</Th>
                        <Th numeric>Ease (cm)</Th>
                        <Th>Status</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {computed.ranked.slice(0, 12).map(({ loaner, fit }) => (
                        <Tr key={loaner.id}>
                          <Td className="font-mono font-medium">{loaner.tag}</Td>
                          <Td>{loaner.title}</Td>
                          <Td>{SIZE_LABEL[loaner.size]}</Td>
                          <Td numeric>{loaner.chestCm}</Td>
                          <Td numeric>+{fit.ease}</Td>
                          <Td>
                            <Badge tone={loaner.status === 'shelf' ? 'ok' : 'warn'}>{loaner.status}</Badge>
                          </Td>
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
