import { AppShell } from '@x10/shared/runtime';
import { Callout, PageHeader, Section, Table, TableWrap, Td, Th, Tr } from '@x10/shared/ui';

import {
  CLEAN_DAYS,
  EXTENSION_DAYS_MAX,
  FEE_PER_DAY,
  FIT_EASE,
  GRACE_DAYS,
  LOAN_DAYS_MAX,
  MAX_WEARS,
  NEVER_BORROWED_PRIORITY,
} from '../domain/config';

export function AboutPage() {
  return (
    <AppShell>
      <PageHeader title="About Loan Chest" meta="Loaner sweater lending library" />
      <div className="space-y-6 max-w-3xl">
        <Section title="What it does">
          <p className="text-sm text-fg leading-relaxed">
            Loan Chest manages a shared wardrobe of holiday loaner sweaters with automatic cleaning turnaround,
            chest-ease fit matching, a fair priority queue when demand exceeds stock, charity-jar lateness
            donations, and automatic retirement when garments wear out.
          </p>
        </Section>

        <Section title="Rules & thresholds">
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>Rule</Th>
                  <Th>Policy / threshold</Th>
                </Tr>
              </thead>
              <tbody>
                <Tr>
                  <Td className="font-medium">Availability & cleaning</Td>
                  <Td>Max loan {LOAN_DAYS_MAX} days; {CLEAN_DAYS}-day cleaning gap between loans.</Td>
                </Tr>
                <Tr>
                  <Td className="font-medium">Fit matching</Td>
                  <Td>Ease = loanerChest − borrowerChest within {FIT_EASE[0]}–{FIT_EASE[1]} cm, ranked by closeness to 10 cm.</Td>
                </Tr>
                <Tr>
                  <Td className="font-medium">Fair queue</Td>
                  <Td>Priority = min(daysSinceLastLoan, {NEVER_BORROWED_PRIORITY}); never-borrowed = {NEVER_BORROWED_PRIORITY}; ties by earliest request.</Td>
                </Tr>
                <Tr>
                  <Td className="font-medium">Extensions & lateness</Td>
                  <Td>One extension up to {EXTENSION_DAYS_MAX} days if uncontested. Donation = max(0, daysLate − {GRACE_DAYS}) × ${FEE_PER_DAY.toFixed(2)}, never blocking returns.</Td>
                </Tr>
                <Tr>
                  <Td className="font-medium">Retirement</Td>
                  <Td>Each return adds 1 wear; retires automatically at {MAX_WEARS} wears or a second damaged return.</Td>
                </Tr>
              </tbody>
            </Table>
          </TableWrap>
        </Section>

        <Callout tone="info" title="Library aid">
          Loan Chest supports internal office lending workflows and voluntary charity-jar tracking; it is not an accounting or HR system.
        </Callout>
      </div>
    </AppShell>
  );
}
