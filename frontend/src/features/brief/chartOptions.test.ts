import { LIGHT } from '../../lib/chartTheme';
import { brief, evolution } from '../../test/fixtures';
import { deliveryLegend, deliveryOption, evolutionLegend, evolutionOption } from './chartOptions';

interface Series {
  name: string;
  lineStyle?: { color?: string; width?: number; type?: string };
}

const seriesOf = (option: object) => (option as { series: Series[] }).series;

describe('delivery chart', () => {
  it('hides the outturn until it is revealed', () => {
    expect(seriesOf(deliveryOption(brief, false, LIGHT)).map((s) => s.name)).not.toContain(
      'Actual outturn',
    );
    expect(seriesOf(deliveryOption(brief, true, LIGHT)).map((s) => s.name)).toContain(
      'Actual outturn',
    );
    expect(deliveryLegend(LIGHT, true)).toHaveLength(4);
  });

  it('keeps entity colours fixed', () => {
    const byName = new Map(seriesOf(deliveryOption(brief, true, LIGHT)).map((s) => [s.name, s]));
    expect(byName.get('Published forecast')?.lineStyle?.color).toBe(LIGHT.forecast);
    expect(byName.get('Actual outturn')?.lineStyle?.color).toBe(LIGHT.actual);
    expect(byName.get('Error-adjusted (P50)')?.lineStyle?.type).toBe('dashed');
  });

  it('builds a tooltip that leads with values', () => {
    const option = deliveryOption(brief, true, LIGHT) as unknown as {
      tooltip: { formatter: (p: unknown) => string };
    };
    const hour = Date.parse(brief.hours[10]?.start_time ?? '');
    const html = option.tooltip.formatter([{ axisValue: hour }]);
    expect(html).toContain('Published forecast');
    expect(html).toContain('Actual outturn');
    expect(html).toMatch(/\d+\.\d GW/);
  });
});

describe('evolution chart', () => {
  it('emphasises the decision run and dashes runs published after the decision', () => {
    const series = seriesOf(evolutionOption(evolution, false, LIGHT));
    const decision = evolution.runs.findIndex((r) => r.is_decision_run);
    const late = evolution.runs.findIndex((r) => !r.available_at_decision);
    expect(series[decision]?.lineStyle).toMatchObject({ color: LIGHT.forecast, width: 2.5 });
    expect(series[late]?.lineStyle).toMatchObject({ color: LIGHT.context, type: 'dashed' });
    expect(evolutionLegend(LIGHT, evolution, false)[0]?.label).toContain('07:30');
  });
});
