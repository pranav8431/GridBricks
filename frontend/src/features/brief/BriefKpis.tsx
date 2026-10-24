import { SimpleGrid } from '@mantine/core';
import {
  IconAdjustmentsHorizontal,
  IconBolt,
  IconClockHour4,
  IconTargetArrow,
  IconWind,
} from '@tabler/icons-react';

import type { BriefResponse } from '../../api/client';
import { StatTile } from '../../components/StatTile';
import { duration, gw, gwh, signedGwh, ukTime } from '../../lib/format';
import { revisionNote } from '../../lib/headline';

export function BriefKpis({ brief, reveal }: { brief: BriefResponse; reveal: boolean }) {
  const { energy, peak, trough, calibration } = brief;

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: reveal ? 5 : 4 }} spacing="md">
      <StatTile
        label="Published forecast"
        icon={<IconWind size={18} />}
        value={gwh(energy.forecast_gwh)}
        detail={revisionNote(brief) ?? 'Energy over the 24 hourly products'}
        hint="Sum of the hourly forecast from the newest run published before the decision time."
      />
      <StatTile
        label="Corrected estimate"
        icon={<IconAdjustmentsHorizontal size={18} />}
        accent="var(--gb-adjusted)"
        value={gwh(energy.p50_gwh)}
        detail={
          energy.p10_gwh != null && energy.p90_gwh != null
            ? `Likely ${gwh(energy.p10_gwh)} – ${gwh(energy.p90_gwh)}`
            : 'Not enough history to calibrate'
        }
        hint={
          calibration.sufficient
            ? `P50 and P10–P90 learned from ${calibration.samples} decision-time forecasts settled before the decision (${calibration.window_start ?? ''} to ${calibration.window_end ?? ''}). Nothing published after the decision is used.`
            : 'Needs enough settled history before the decision.'
        }
      />
      <StatTile
        label="Peak hour"
        icon={<IconBolt size={18} />}
        value={gw(peak?.generation_mw)}
        detail={
          peak && trough
            ? `At ${ukTime(peak.start_time)} · low ${gw(trough.generation_mw)} at ${ukTime(trough.start_time)}`
            : undefined
        }
      />
      <StatTile
        label="Forecast run used"
        icon={<IconClockHour4 size={18} />}
        value={brief.decision_run ? ukTime(brief.decision_run) : 'None'}
        detail={
          brief.decision_run_age_minutes != null
            ? `Published ${duration(brief.decision_run_age_minutes)} before ${brief.gate.gate_closure_uk}`
            : undefined
        }
      />
      {reveal ? (
        <StatTile
          label="Actual outturn"
          icon={<IconTargetArrow size={18} />}
          accent="var(--gb-actual)"
          value={gwh(energy.actual_gwh)}
          detail={
            energy.error_gwh != null
              ? `Forecast error ${signedGwh(energy.error_gwh)} · adjusted ${signedGwh(energy.adjusted_error_gwh)}`
              : 'Outturn incomplete'
          }
          hint="Error = forecast − actual. Positive means less wind arrived than forecast, so the desk would have been short."
        />
      ) : null}
    </SimpleGrid>
  );
}
