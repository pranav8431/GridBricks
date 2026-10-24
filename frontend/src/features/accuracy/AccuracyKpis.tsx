import { SimpleGrid } from '@mantine/core';
import {
  IconArrowsDiff,
  IconChartBar,
  IconPercentage,
  IconRuler2,
  IconScale,
  IconTarget,
} from '@tabler/icons-react';

import type { AccuracyResponse } from '../../api/client';
import { StatTile } from '../../components/StatTile';
import { gw, pct, signedGw } from '../../lib/format';
import { improvement } from './insights';

export function AccuracyKpis({ accuracy }: { accuracy: AccuracyResponse }) {
  const { published, adjusted } = accuracy;
  const gain = adjusted ? improvement(published.mae_mw, adjusted.mae_mw) : null;
  const direction =
    published.bias_mw > 0
      ? 'Forecast too high on average: the desk would be short'
      : 'Forecast too low on average: the desk would be long';
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
      <StatTile
        label="Mean absolute error"
        icon={<IconRuler2 size={18} />}
        value={gw(published.mae_mw, 2)}
        tone={gain !== null && gain > 0 ? 'good' : 'neutral'}
        detail={
          adjusted && gain !== null
            ? `${gw(adjusted.mae_mw, 2)} after adjustment (${pct(-gain)})`
            : undefined
        }
        hint="Average size of the hourly forecast error at decision time, over every hourly product in the period."
      />
      <StatTile
        label="Bias"
        icon={<IconScale size={18} />}
        value={signedGw(published.bias_mw, 2)}
        tone="bad"
        detail={direction}
        hint="Mean of forecast − actual. Positive means less wind arrived than forecast."
      />
      <StatTile
        label="Root mean square error"
        icon={<IconChartBar size={18} />}
        value={gw(published.rmse_mw, 2)}
        detail="Penalises large misses more heavily"
      />
      <StatTile
        label="90% of hours within"
        icon={<IconArrowsDiff size={18} />}
        value={`±${gw(published.abs_error_p90_mw)}`}
        detail={`Worst hour ${gw(published.max_abs_error_mw)}`}
        hint="90th percentile of the absolute hourly error."
      />
      <StatTile
        label="Normalised MAE"
        icon={<IconPercentage size={18} />}
        value={pct(published.nmae_pct / 100, 1)}
        detail="Of mean wind output"
      />
      <StatTile
        label="Likely-range coverage"
        icon={<IconTarget size={18} />}
        accent="var(--gb-adjusted)"
        value={pct(accuracy.band_coverage, 1)}
        tone={
          accuracy.band_coverage != null &&
          Math.abs(accuracy.band_coverage - accuracy.band_target) <= 0.05
            ? 'good'
            : 'neutral'
        }
        detail={`Target ${pct(accuracy.band_target)} · average width ${gw(accuracy.mean_band_width_mw)}`}
        hint="Share of hours where the actual outturn landed inside the P10–P90 range shown at decision time. Close to 80% means the range is honest."
      />
    </SimpleGrid>
  );
}
