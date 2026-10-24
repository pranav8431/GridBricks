import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/render';
import { ChartCard } from './ChartCard';

describe('ChartCard', () => {
  it('switches between the chart and its table twin', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChartCard
        title="Daily error"
        legend={[{ label: 'Published forecast', color: '#2a78d6', kind: 'line' }]}
        table={() => <table aria-label="daily table" />}
      >
        <div>the chart</div>
      </ChartCard>,
    );
    expect(screen.getByText('the chart')).toBeInTheDocument();
    expect(screen.getByText('Published forecast')).toBeInTheDocument();
    await user.click(screen.getByText('Table'));
    expect(screen.getByRole('table', { name: 'daily table' })).toBeInTheDocument();
    expect(screen.queryByText('the chart')).not.toBeInTheDocument();
    expect(screen.queryByText('Published forecast')).not.toBeInTheDocument();
  });

  it('has no view toggle when there is no table', () => {
    renderWithProviders(
      <ChartCard title="Plain">
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.queryByText('Table')).not.toBeInTheDocument();
  });
});
