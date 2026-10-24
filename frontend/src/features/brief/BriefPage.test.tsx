import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';

import { LocationProbe } from '../../test/LocationProbe';
import { renderWithProviders } from '../../test/render';
import { server } from '../../test/server';
import { BriefPage } from './BriefPage';

vi.mock('../../components/EChart', () => ({
  EChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderBrief = () =>
  renderWithProviders(
    <Routes>
      <Route
        path="/brief"
        element={
          <>
            <BriefPage />
            <LocationProbe />
          </>
        }
      />
    </Routes>,
    { route: '/brief?date=2026-01-14' },
  );

describe('BriefPage', () => {
  it('shows what the desk could see at gate closure', async () => {
    renderBrief();
    expect(await screen.findByTestId('brief-headline')).toHaveTextContent('the 07:30 run');
    expect(screen.getByRole('article', { name: 'Published forecast' })).toHaveTextContent(
      '286 GWh',
    );
    expect(screen.getByRole('article', { name: 'Forecast run used' })).toHaveTextContent('07:30');
    expect(screen.queryByRole('article', { name: 'Actual outturn' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/v1/brief.csv?decision_date=2026-01-14&gate=epex_hourly'),
    );
  });

  it('reveals the outturn on request', async () => {
    const user = userEvent.setup();
    renderBrief();
    await screen.findByTestId('brief-headline');
    await user.click(screen.getByRole('switch', { name: /Reveal what actually happened/ }));
    expect(await screen.findByRole('article', { name: 'Actual outturn' })).toHaveTextContent('GWh');
  });

  it('shows API problems with a retry action', async () => {
    server.use(
      http.get('*/api/v1/brief', () =>
        HttpResponse.json(
          { title: 'Outside pilot scope', detail: 'Decision date is outside the pilot scope.' },
          { status: 422 },
        ),
      ),
    );
    renderBrief();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Outside pilot scope');
    expect(alert).toHaveTextContent('Decision date is outside the pilot scope.');
  });

  it('keyboard shortcuts step through days and toggle the outturn', async () => {
    const user = userEvent.setup();
    renderBrief();
    await screen.findByTestId('brief-headline');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('location')).toHaveTextContent('date=2026-01-15');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByTestId('location')).toHaveTextContent('date=2026-01-13');
    await user.keyboard('r');
    expect(screen.getByTestId('location')).toHaveTextContent('reveal=1');
  });

  it('shows the run-to-run revision panel once both views have loaded', async () => {
    renderBrief();
    expect(await screen.findByText('What changed since the previous run')).toBeInTheDocument();
    expect(screen.getByText('Stable since last run')).toBeInTheDocument();
    expect(screen.getByTestId('revision-facts')).toHaveTextContent('Revision over the day');
  });
});
