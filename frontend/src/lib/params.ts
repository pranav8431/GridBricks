import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { GateId } from '../api/client';
import type { GateSelection } from '../api/queries';

/** Every control lives in the URL, so any view can be shared as a link. */
export const GATE_IDS: readonly GateId[] = ['epex_hourly', 'n2ex', 'epex_halfhourly'];
export const DEFAULT_GATE: GateId = 'epex_hourly';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseGate(value: string | null): GateId {
  return GATE_IDS.find((id) => id === value) ?? DEFAULT_GATE;
}

export function parseCutoff(value: string | null): string | undefined {
  return value !== null && HHMM.test(value) && value < '23:00' ? value : undefined;
}

export function parseDate(value: string | null, min?: string, max?: string): string | undefined {
  if (value === null || !ISO_DATE.test(value)) return undefined;
  if ((min && value < min) || (max && value > max)) return undefined;
  return value;
}

type Patch = Record<string, string | null | undefined>;

export function useUrlState() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (patch: Patch) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [params, update] as const;
}

export function useGateSelection(): [GateSelection, (next: GateSelection) => void] {
  const [params, update] = useUrlState();
  const gate = parseGate(params.get('gate'));
  const cutoff = parseCutoff(params.get('cutoff'));
  const selection = useMemo(() => ({ gate, cutoff }), [gate, cutoff]);
  const setSelection = useCallback(
    (next: GateSelection) =>
      update({ gate: next.gate === DEFAULT_GATE ? null : next.gate, cutoff: next.cutoff ?? null }),
    [update],
  );
  return [selection, setSelection];
}

/** Query string carrying the gate selection, for links between pages. */
export function gateQueryString(selection: GateSelection, extra: Patch = {}): string {
  const query = new URLSearchParams();
  if (selection.gate !== DEFAULT_GATE) query.set('gate', selection.gate);
  if (selection.cutoff) query.set('cutoff', selection.cutoff);
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `?${text}` : '';
}
