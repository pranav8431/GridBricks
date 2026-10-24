import { screen } from '@testing-library/react';

import { renderWithProviders } from '../test/render';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('exposes label, value and detail as one named article', () => {
    renderWithProviders(<StatTile label="Bias" value="+1.75 GW" detail="Desk would be short" />);
    const tile = screen.getByRole('article', { name: 'Bias' });
    expect(tile).toHaveTextContent('+1.75 GW');
    expect(tile).toHaveTextContent('Desk would be short');
  });

  it('offers its hint to assistive technology', () => {
    renderWithProviders(<StatTile label="MAE" value="2.02 GW" hint="Average size of the error" />);
    expect(screen.getByLabelText('Average size of the error')).toBeInTheDocument();
  });
});
