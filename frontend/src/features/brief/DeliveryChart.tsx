import { useMemo } from 'react';

import type { BriefResponse } from '../../api/client';
import { EChart } from '../../components/EChart';
import { useChartTokens } from '../../lib/chartTheme';
import { deliveryOption } from './chartOptions';

export function DeliveryChart({ brief, reveal }: { brief: BriefResponse; reveal: boolean }) {
  const t = useChartTokens();
  const option = useMemo(() => deliveryOption(brief, reveal, t), [brief, reveal, t]);
  return (
    <EChart
      option={option}
      height={340}
      label={`Hourly wind forecast for delivery on ${brief.delivery_date}, with the error-adjusted estimate and likely range${reveal ? ', and actual outturn' : ''}.`}
    />
  );
}
