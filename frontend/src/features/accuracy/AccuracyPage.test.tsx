import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { renderWithProviders } from '../../test/render';
import { server } from '../../test/server';
import { AccuracyPage } from './AccuracyPage';

vi.mock('../../components/EChart', () => ({
  EChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AccuracyPage', () => {
  it('leads with the monthly verdict and the headline metrics', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/accuracy" element={<AccuracyPage />} />
      </Routes>,
      { route: '/accuracy' },
    );
    expect(await screen.findByText(/overstated wind by 15%/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Mean absolute error' })).toHaveTextContent(
      '2.02 GW',
    );
    expect(screen.getByRole('article', { name: 'Likely-range coverage' })).toHaveTextContent(
      '80.1%',
    );
    expect(screen.getByText(/cuts it by 39%/)).toBeInTheDocument();
  });

  it('compares all three auctions and links the worst days to their brief', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/accuracy" element={<AccuracyPage />} />
      </Routes>,
      { route: '/accuracy' },
    );
    await screen.findByText(/overstated wind/);
    const comparison = screen.getByText('Value of waiting versus correcting').closest('div')
      ?.parentElement as HTMLElement;
    expect(within(comparison).getByText('N2EX · 09:50')).toBeInTheDocument();
    const worst = screen.getAllByRole('link', { name: 'Wed 28 Jan 2026' })[0];
    expect(worst).toHaveAttribute('href', '/brief?date=2026-01-27&reveal=1');
  });

  it('downloads the daily table as CSV', async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => 'blob:daily');
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWithProviders(
      <Routes>
        <Route path="/accuracy" element={<AccuracyPage />} />
      </Routes>,
      { route: '/accuracy' },
    );
    await screen.findByText(/overstated wind/);
    await user.click(screen.getByRole('button', { name: 'CSV' }));
    expect(created).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
