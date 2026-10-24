import { screen } from '@testing-library/react';

import { brief } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { RunTimeline } from './RunTimeline';

describe('RunTimeline', () => {
  it('marks which runs landed before gate closure and which one was used', () => {
    renderWithProviders(
      <RunTimeline
        runs={brief.runs_on_decision_day}
        cutoff={brief.cutoff}
        decisionRun={brief.decision_run}
        gateLabel="Gate 09:20"
      />,
    );
    const runs = screen.getAllByRole('button');
    expect(runs).toHaveLength(8);
    expect(
      screen.getByRole('button', {
        name: /07:30 run, published 1 h 50 min before gate closure \(used/,
      }),
    ).toHaveAttribute('data-used', 'true');
    expect(
      screen.getByRole('button', { name: /09:30 run, published 10 min after gate closure/ }),
    ).toHaveAttribute('data-available', 'false');
    expect(screen.getByText('Gate 09:20')).toBeInTheDocument();
  });
});
