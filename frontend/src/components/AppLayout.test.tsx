import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { LocationProbe } from '../test/LocationProbe';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';
import { AppLayout } from './AppLayout';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderShell = (route = '/brief') =>
  renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="*" element={<LocationProbe />} />
      </Route>
    </Routes>,
    { route },
  );

describe('AppLayout', () => {
  it('marks the current page in the navigation', () => {
    renderShell('/accuracy');
    expect(screen.getByRole('link', { name: 'Forecast accuracy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Day-ahead brief' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('carries the selected gate into every navigation link', () => {
    renderShell('/brief?gate=n2ex');
    expect(screen.getByRole('link', { name: 'Methodology & data' })).toHaveAttribute(
      'href',
      '/methodology?gate=n2ex',
    );
  });

  it('changing the decision time updates the URL', async () => {
    const user = userEvent.setup();
    renderShell('/brief?date=2026-01-14');
    await screen.findByText(/snapshot/);
    await user.click(screen.getByRole('textbox', { name: /Decision time/ }));
    await user.click(await screen.findByRole('option', { name: 'N2EX · 09:50' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/brief?date=2026-01-14&gate=n2ex'),
    );
  });

  it('a custom decision time shows a time input and sets the cutoff', async () => {
    const user = userEvent.setup();
    renderShell('/brief');
    await screen.findByText(/snapshot/);
    await user.click(screen.getByRole('textbox', { name: /Decision time/ }));
    await user.click(await screen.findByRole('option', { name: 'Custom decision time…' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('cutoff=09%3A20'));
    expect(screen.getByLabelText('Custom decision time, UK')).toBeInTheDocument();
  });

  it('shows the pilot scope and snapshot version', async () => {
    renderShell();
    expect(await screen.findByText('Decisions 1–31 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText(/snapshot a3daecfcd5c5/)).toBeInTheDocument();
  });
});
