import { useMemo } from 'react';

import type { EvolutionResponse } from '../../api/client';
import { EChart } from '../../components/EChart';
import { useChartTokens } from '../../lib/chartTheme';
import { evolutionOption } from './chartOptions';

export function EvolutionChart({
  evolution,
  reveal,
}: {
  evolution: EvolutionResponse;
  reveal: boolean;
}) {
  const t = useChartTokens();
  const option = useMemo(() => evolutionOption(evolution, reveal, t), [evolution, reveal, t]);
  return (
    <EChart
      option={option}
      height={300}
      label={`How ${evolution.runs.length} forecast runs for delivery on ${evolution.delivery_date} evolved before and after the decision.`}
    />
  );
}
