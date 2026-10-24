import { brief } from '../test/fixtures';
import { briefHeadline, nextRunNote, revisionNote } from './headline';

describe('brief headline', () => {
  it('names the run, its age and the energy figures', () => {
    const text = briefHeadline(brief);
    expect(text).toContain('At 09:20 on Wed 14 Jan, the newest forecast was the 07:30 run');
    expect(text).toContain('published 1 h 50 min earlier');
    expect(text).toContain('286 GWh');
    expect(text).toMatch(/expect about 251 GWh, most likely between 195 GWh and 317 GWh/);
  });

  it('explains when no run was available', () => {
    const text = briefHeadline({ ...brief, decision_run: null, decision_run_age_minutes: null });
    expect(text).toBe('No wind forecast had been published before 09:20 on Wed 14 Jan.');
  });

  it('points out the run that just missed the gate', () => {
    expect(nextRunNote(brief)).toBe(
      'The next run (09:30) landed 10 min after gate closure, too late for this auction.',
    );
  });

  it('describes revisions without doubling the sign', () => {
    expect(revisionNote(brief)).toBe('Unchanged from the 04:30 run.');
    const revised = { ...brief, energy: { ...brief.energy, revision_gwh: -12.4 } };
    expect(revisionNote(revised)).toBe('Revised down 12 GWh from the 04:30 run.');
  });
});
