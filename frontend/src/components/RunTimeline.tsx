import { Tooltip } from '@mantine/core';

import type { RunInfo } from '../api/client';
import { duration, ukMinutesOfDay, ukTime } from '../lib/format';

interface RunTimelineProps {
  runs: RunInfo[];
  cutoff: string;
  decisionRun: string | null | undefined;
  gateLabel: string;
}

const DAY_MINUTES = 24 * 60;
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

const position = (minutes: number) => `${((minutes / DAY_MINUTES) * 100).toFixed(3)}%`;

function describe(run: RunInfo, used: boolean): string {
  const time = ukTime(run.publish_time);
  const gap = duration(run.minutes_from_cutoff);
  const timing = run.available_at_decision
    ? `${gap} before gate closure`
    : `${gap} after gate closure`;
  const flags = [used ? 'used for the decision' : '', run.off_schedule ? 'off-schedule' : '']
    .filter(Boolean)
    .join(', ');
  return `${time} run, published ${timing}${flags ? ` (${flags})` : ''}`;
}

/** The decision day at a glance: which forecast runs landed before gate closure. */
export function RunTimeline({ runs, cutoff, decisionRun, gateLabel }: RunTimelineProps) {
  const gateMinutes = ukMinutesOfDay(cutoff);
  const summary = runs.map((run) => describe(run, run.publish_time === decisionRun)).join('; ');
  return (
    <figure style={{ margin: 0 }}>
      <div
        className="gb-timeline"
        role="img"
        aria-label={`Forecast runs on the decision day: ${summary}`}
      >
        <div className="gb-timeline-track" />
        <div className="gb-timeline-gate" style={{ left: position(gateMinutes) }}>
          <span className="gb-timeline-gate-label">{gateLabel}</span>
        </div>
        {runs.map((run) => {
          const used = run.publish_time === decisionRun;
          return (
            <Tooltip key={run.publish_time} label={describe(run, used)} withArrow>
              <button
                type="button"
                className="gb-timeline-run gb-focusable"
                data-available={run.available_at_decision}
                data-used={used}
                style={{ left: position(ukMinutesOfDay(run.publish_time)) }}
                aria-label={describe(run, used)}
              />
            </Tooltip>
          );
        })}
        {TICKS.map((hour) => (
          <span key={hour} className="gb-timeline-tick" style={{ left: position(hour * 60) }}>
            {String(hour).padStart(2, '0')}:00
          </span>
        ))}
      </div>
      <figcaption className="gb-visually-hidden">{summary}</figcaption>
    </figure>
  );
}
