import type { BriefResponse } from '../api/client';
import { calendarDate, duration, gwh, ukTime } from './format';

/** The one-paragraph answer a trader needs before gate closure. */
export function briefHeadline(brief: BriefResponse): string {
  const decisionDay = calendarDate(brief.decision_date, false);
  const deliveryDay = calendarDate(brief.delivery_date, false);
  const gate = brief.gate.gate_closure_uk;
  if (!brief.decision_run || brief.decision_run_age_minutes == null) {
    return `No wind forecast had been published before ${gate} on ${decisionDay}.`;
  }
  const run = ukTime(brief.decision_run);
  const age = duration(brief.decision_run_age_minutes);
  const { energy } = brief;
  let text =
    `At ${gate} on ${decisionDay}, the newest forecast was the ${run} run, published ${age} ` +
    `earlier. It expects ${gwh(energy.forecast_gwh)} of wind for delivery on ${deliveryDay}.`;
  if (energy.p50_gwh != null && energy.p10_gwh != null && energy.p90_gwh != null) {
    text +=
      ` Corrected for the last two weeks' forecast error, expect about ${gwh(energy.p50_gwh)},` +
      ` most likely between ${gwh(energy.p10_gwh)} and ${gwh(energy.p90_gwh)}.`;
  }
  return text;
}

/** Explains the first run that missed the cutoff, e.g. "The 09:30 run landed 10 min too late." */
export function nextRunNote(brief: BriefResponse): string | null {
  const next = brief.next_run;
  if (!next) return null;
  const minutes = Math.round(next.minutes_from_cutoff);
  if (minutes > 6 * 60) return null;
  const when =
    minutes === 0 ? 'exactly at gate closure' : `${duration(minutes)} after gate closure`;
  return `The next run (${ukTime(next.publish_time)}) landed ${when}, too late for this auction.`;
}

export function revisionNote(brief: BriefResponse): string | null {
  const { revision_gwh: revision } = brief.energy;
  if (revision == null || !brief.previous_run) return null;
  if (Math.abs(revision) < 0.5) {
    return `Unchanged from the ${ukTime(brief.previous_run)} run.`;
  }
  const direction = revision > 0 ? 'up' : 'down';
  return `Revised ${direction} ${gwh(Math.abs(revision))} from the ${ukTime(brief.previous_run)} run.`;
}
