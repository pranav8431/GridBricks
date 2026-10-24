import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/render';
import { server } from '../../test/server';
import { MethodologyPage } from './MethodologyPage';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MethodologyPage', () => {
  it('explains the method and shows provenance and data quality', async () => {
    renderWithProviders(<MethodologyPage />);
    expect(await screen.findByText(/actual ≈ a \+ b × forecast/)).toBeInTheDocument();
    expect(screen.getByText('WINDFOR', { selector: 'td' })).toBeInTheDocument();
    expect(await screen.findByText(/2,208 of 2,208 half-hours present/)).toBeInTheDocument();
    expect(screen.getByText(/Off-schedule forecast run published 12:25/)).toBeInTheDocument();
  });
});
