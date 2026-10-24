import { Group, Select } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useEffect, useState } from 'react';

import { useMeta } from '../api/queries';
import { useGateSelection } from '../lib/params';

const CUSTOM = 'custom';

/** Global decision-time control: an auction preset, or a custom time on D-1. */
export function GateSelector() {
  const meta = useMeta();
  const [selection, setSelection] = useGateSelection();
  const [draft, setDraft] = useState(selection.cutoff ?? '');

  useEffect(() => setDraft(selection.cutoff ?? ''), [selection.cutoff]);

  const gates = meta.data?.gates ?? [];
  const presetTime = gates.find((g) => g.id === selection.gate)?.gate_closure_uk ?? '09:20';
  const options = [
    ...gates.map((gate) => ({ value: gate.id, label: gate.label })),
    { value: CUSTOM, label: 'Custom decision time…' },
  ];

  const commit = (value: string) => {
    if (/^([01]\d|2[0-2]):[0-5]\d$/.test(value)) setSelection({ ...selection, cutoff: value });
  };

  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        aria-label="Decision time (auction gate closure on the day before delivery)"
        data={options}
        value={selection.cutoff ? CUSTOM : selection.gate}
        onChange={(value) => {
          if (value === CUSTOM) setSelection({ ...selection, cutoff: presetTime });
          else if (value) {
            const gate = gates.find((g) => g.id === value);
            if (gate) setSelection({ gate: gate.id as typeof selection.gate, cutoff: undefined });
          }
        }}
        allowDeselect={false}
        w={230}
        size="sm"
        comboboxProps={{ withinPortal: true }}
      />
      {selection.cutoff ? (
        <TimeInput
          aria-label="Custom decision time, UK"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(draft);
          }}
          w={110}
          size="sm"
        />
      ) : null}
    </Group>
  );
}
