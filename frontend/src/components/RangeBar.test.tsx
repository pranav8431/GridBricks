import { screen } from '@testing-library/react';

import { renderWithProviders } from '../test/render';
import { RangeBar } from './RangeBar';

describe('RangeBar', () => {
  it('summarises every value for screen readers', () => {
    renderWithProviders(<RangeBar forecast={468} p10={340} p50={392} p90={430} actual={347} />);
    expect(
      screen.getByRole('img', {
        name: 'Published forecast 468 GWh, error-adjusted 392 GWh, likely range 340 GWh to 430 GWh, actual 347 GWh',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Likely range')).toBeInTheDocument();
  });

  it('zooms the scale to the values instead of starting at zero', () => {
    renderWithProviders(<RangeBar forecast={468} p10={340} p50={392} p90={430} />);
    expect(screen.getByText('300 GWh')).toBeInTheDocument();
    expect(screen.getByText('500 GWh')).toBeInTheDocument();
  });

  it('omits the band and actual when they are unknown', () => {
    renderWithProviders(<RangeBar forecast={300} p10={null} p50={null} p90={null} />);
    expect(screen.queryByText('Likely range')).not.toBeInTheDocument();
    expect(screen.queryByText('Actual')).not.toBeInTheDocument();
  });
});
