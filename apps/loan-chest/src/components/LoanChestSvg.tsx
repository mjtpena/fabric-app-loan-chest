import { useMemo } from 'react';
import { useReducedMotion, useThemeColors } from '@x10/shared/ui';

import type { BorrowerProfile, Loan, Loaner } from '../model';
import { DRAWERS_PER_CHEST, SIZE_LABEL } from '../domain/config';
import {
  computeFit,
  computeLatenessFee,
  diffDays,
  formatShortDate,
  nextFreeDateForLoaner,
  swatchForTag,
} from '../domain/rules';

export type ChestLens = 'status' | 'wear' | 'size' | 'queue' | 'nextFree';

interface LoanChestSvgProps {
  loaners: Loaner[];
  loans: Loan[];
  chestIndex: number;
  onSelectChest: (idx: number) => void;
  lens: ChestLens;
  viewAs: 'curator' | 'borrower';
  borrowerProfile: BorrowerProfile | null;
  focusedLoanerId: string | null;
  onSelectLoaner: (id: string | null) => void;
}

export function LoanChestSvg({
  loaners,
  loans,
  chestIndex,
  onSelectChest,
  lens,
  viewAs,
  borrowerProfile,
  focusedLoanerId,
  onSelectLoaner,
}: LoanChestSvgProps) {
  const reducedMotion = useReducedMotion();
  const t = useThemeColors();
  const now = useMemo(() => new Date(), []);

  const totalChests = Math.max(1, Math.ceil(loaners.length / DRAWERS_PER_CHEST));
  const slice = loaners.slice(chestIndex * DRAWERS_PER_CHEST, (chestIndex + 1) * DRAWERS_PER_CHEST);

  const woodOuter = t.dark ? '#2b241d' : '#d6c3a5';
  const woodInner = t.dark ? '#1f1a15' : '#bfa784';
  const drawerFace = t.dark ? '#382f25' : '#e5d6bd';
  const brass = t.dark ? '#c7a454' : '#b8903a';
  const brassText = t.dark ? '#1b1610' : '#261d10';
  const accent = t.accent[8] ?? '#657a3b';

  const focusedLoaner = loaners.find((l) => l.id === focusedLoanerId) ?? null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 select-none gap-2">
      {totalChests > 1 && (
        <div className="flex items-center gap-2 z-10" role="tablist" aria-label="Chest selector">
          {Array.from({ length: totalChests }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={chestIndex === idx}
              onClick={() => onSelectChest(idx)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                chestIndex === idx
                  ? 'bg-accent-9 text-accent-contrast border-transparent'
                  : 'bg-surface/80 text-fg border-line hover:bg-surface-2'
              }`}
            >
              Chest {idx + 1} ({idx * DRAWERS_PER_CHEST + 1}–{Math.min((idx + 1) * DRAWERS_PER_CHEST, loaners.length)})
            </button>
          ))}
        </div>
      )}

      <svg
        viewBox="0 0 860 540"
        className="w-full h-full max-h-[calc(100vh-155px)] max-w-[980px]"
        role="img"
        aria-label={`Wooden loan chest ${chestIndex + 1} with ${slice.length} sweater drawers`}
        data-testid="loan-chest-svg"
      >
        {/* Cabinet plinth & crown moulding */}
        <rect x="34" y="18" width="792" height="16" rx="4" fill={woodOuter} stroke={t.line} strokeWidth="1" />
        <rect x="44" y="34" width="772" height="476" rx="8" fill={woodInner} stroke={t.line} strokeWidth="1.2" />
        <rect x="36" y="510" width="788" height="14" rx="3" fill={woodOuter} stroke={t.line} strokeWidth="1" />

        {/* 3 columns x 6 rows of drawers */}
        {slice.map((loaner, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cellW = 244;
          const cellH = 74;
          const x = 60 + col * (cellW + 8);
          const y = 46 + row * (cellH + 4);

          const activeOut = loans.find((l) => l.loanerId === loaner.id && l.status === 'out');
          const waitingCount = loans.filter((l) => l.loanerId === loaner.id && l.status === 'reserved').length;
          const lateness = activeOut ? computeLatenessFee(activeOut.dueOn, now) : { daysLate: 0, fee: 0 };
          const isOverdue = lateness.daysLate > 0;

          // Slide out distance: daysOut / loanLength
          let pullPx = 0;
          if (loaner.status === 'on_loan' && activeOut) {
            const totalLen = Math.max(1, diffDays(activeOut.startsOn, activeOut.dueOn));
            const daysOut = Math.max(0, diffDays(activeOut.startsOn, now));
            const ratio = Math.min(1.15, daysOut / totalLen);
            pullPx = isOverdue ? 14 : Math.round(4 + ratio * 9);
          }

          const isFocused = focusedLoanerId === loaner.id;
          const isRetired = loaner.status === 'retired';
          const isCleaning = loaner.status === 'cleaning';
          const fit = borrowerProfile ? computeFit(loaner.chestCm, borrowerProfile.chestCm) : null;
          const glowFit = viewAs === 'borrower' && fit?.fits && !isRetired && loaner.status !== 'repair';
          const knitColor = swatchForTag(loaner.tag);
          const wearPct = Math.min(1, loaner.wears / Math.max(1, loaner.maxWears));
          const nextFree = nextFreeDateForLoaner(loaner, loans, now);

          return (
            <g
              key={loaner.id}
              transform={`translate(${x}, ${y})`}
              className="cursor-pointer"
              onClick={() => onSelectLoaner(isFocused ? null : loaner.id)}
              data-testid={`drawer-${loaner.tag}`}
            >
              {/* Dark drawer recess */}
              <rect x="0" y="0" width={cellW} height={cellH} rx="6" fill={t.dark ? '#120f0c' : '#8d7658'} />

              {/* Folded sweater lip peeking from top of drawer */}
              {!isRetired && (
                <path
                  d={`M 14 ${10 + pullPx * 0.2} Q ${cellW / 2} ${3 + pullPx * 0.2} ${cellW - 14} ${10 + pullPx * 0.2} L ${cellW - 10} 22 L 10 22 Z`}
                  fill={knitColor}
                  fillOpacity={loaner.status === 'on_loan' ? 0.5 : 0.92}
                />
              )}

              {/* Sliding drawer front */}
              <g
                transform={`translate(0, ${pullPx})${isOverdue ? ' rotate(-1.6 122 36)' : ''}`}
                style={{ transition: reducedMotion ? 'none' : 'transform 200ms ease' }}
              >
                <rect
                  x="4"
                  y="14"
                  width={cellW - 8}
                  height={cellH - 18}
                  rx="5"
                  fill={drawerFace}
                  stroke={isFocused ? accent : glowFit ? accent : isOverdue ? t.warn : t.line}
                  strokeWidth={isFocused || glowFit ? 2.4 : isOverdue ? 2 : 1}
                />

                {/* Brass label plate */}
                <rect
                  x="56"
                  y="22"
                  width="132"
                  height="28"
                  rx="4"
                  fill={isOverdue ? t.warn : brass}
                  fillOpacity={isRetired ? 0.45 : 0.92}
                />

                {/* Tag & Size on brass plate */}
                <text
                  x="66"
                  y="39"
                  fill={brassText}
                  fontSize="11.5"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {loaner.tag} · {SIZE_LABEL[loaner.size]}
                </text>

                {/* Lens-specific indicator on right of brass plate */}
                <text
                  x="180"
                  y="39"
                  textAnchor="end"
                  fill={brassText}
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {lens === 'wear'
                    ? `${loaner.wears}/${loaner.maxWears}`
                    : lens === 'size'
                      ? `${loaner.chestCm}cm`
                      : lens === 'queue'
                        ? waitingCount > 0 ? `${waitingCount}q` : '—'
                        : lens === 'nextFree'
                          ? nextFree ? formatShortDate(nextFree).slice(4) : '—'
                          : isRetired
                            ? 'RET'
                            : isOverdue
                              ? `+${lateness.daysLate}d`
                              : loaner.status === 'on_loan'
                                ? 'OUT'
                                : isCleaning
                                  ? 'WASH'
                                  : loaner.status === 'repair'
                                    ? 'FIX'
                                    : 'IN'}
                </text>

                {/* Crossed-out label for retired */}
                {isRetired && (
                  <line x1="60" y1="36" x2="184" y2="36" stroke={t.bad} strokeWidth="2" />
                )}

                {/* Wear gauge bar under brass plate when in wear lens or near retirement */}
                {(lens === 'wear' || loaner.wears >= loaner.maxWears - 1) && !isRetired && (
                  <g transform="translate(56, 53)">
                    <rect x="0" y="0" width="132" height="4" rx="2" fill={t.line} />
                    <rect
                      x="0"
                      y="0"
                      width={Math.round(132 * wearPct)}
                      height="4"
                      rx="2"
                      fill={wearPct >= 0.9 ? t.bad : wearPct >= 0.7 ? t.warn : accent}
                    />
                  </g>
                )}

                {/* Drawer handle knob */}
                <circle cx="28" cy="36" r="4.5" fill={brass} stroke={brassText} strokeWidth="0.7" />
                <circle cx={cellW - 28} cy="36" r="4.5" fill={brass} stroke={brassText} strokeWidth="0.7" />

                {/* Steam tag for cleaning */}
                {isCleaning && (
                  <g transform="translate(10, 18)">
                    <rect x="0" y="0" width="38" height="14" rx="3" fill={t.info} />
                    <text x="19" y="10" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="700">
                      STEAM
                    </text>
                  </g>
                )}

                {/* Queue badge */}
                {waitingCount > 0 && (
                  <g transform={`translate(${cellW - 34}, 16)`}>
                    <circle cx="12" cy="8" r="9" fill={accent} />
                    <text x="12" y="11.5" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="700" fontFamily="ui-monospace, SFMono-Regular, monospace">
                      {waitingCount}
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Focused drawer detail strip at bottom of SVG */}
        {focusedLoaner && (
          <g transform="translate(52, 462)">
            <rect x="0" y="0" width="756" height="40" rx="8" fill={t.surface} stroke={accent} strokeWidth="1.4" />
            <text x="14" y="24" fill={t.text} fontSize="12" fontWeight="700">
              {focusedLoaner.tag} · {focusedLoaner.title} ({SIZE_LABEL[focusedLoaner.size]}, {focusedLoaner.chestCm} cm, {focusedLoaner.fibre})
            </text>
            <text x="742" y="24" textAnchor="end" fill={t.muted} fontSize="11" fontFamily="ui-monospace, SFMono-Regular, monospace">
              Wears: {focusedLoaner.wears}/{focusedLoaner.maxWears} · Status: {focusedLoaner.status}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
