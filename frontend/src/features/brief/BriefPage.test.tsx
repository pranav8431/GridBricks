import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';

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
      <Route path="/brief" element={<BriefPage />} />
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
});
