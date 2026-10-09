import type { Report, Row } from '../lib';
import { Panel, text } from './shared';

type Series = { field: string; label: string; color: string };

function ComparisonChart({
  title,
  note,
  rows,
  series,
  unit,
  maximum,
}: {
  title: string;
  note: string;
  rows: Row[];
  series: Series[];
  unit: string;
  maximum?: number;
}) {
  const values = rows.map((row) => series.map(({ field }) => Number(row[field] || 0)));
  const totals = values.map((row) => row.reduce((sum, value) => sum + value, 0));
  const scale = maximum ?? Math.max(1, Math.ceil(Math.max(0, ...totals)));
  const format = (value: number) =>
    `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${unit === '%' ? '%' : unit === 'days' ? 'd' : ''}`;

  return (
    <Panel title={title} note={note}>
      {rows.length ? (
        <div
          className="comparison-chart"
          role="img"
          aria-label={`${title}. ${rows.map((row, index) => `${text(row.name)}: ${series.map((item, i) => `${item.label} ${format(values[index][i])}`).join(', ')}`).join('; ')}`}
        >
          <div className="chart-legend" aria-hidden="true">
            {series.map((item) => (
              <span key={item.field}>
                <i style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <div className="comparison-rows" aria-hidden="true">
            {rows.map((row, index) => (
              <div className="comparison-row" key={text(row.name)}>
                <span className="chart-category">{text(row.name)}</span>
                <div className="comparison-track">
                  {series.map((item, seriesIndex) => (
                    <span
                      key={item.field}
                      style={{
                        width: `${(values[index][seriesIndex] / scale) * 100}%`,
                        background: item.color,
                      }}
                      title={`${item.label}: ${format(values[index][seriesIndex])}`}
                    />
                  ))}
                </div>
                <strong className="chart-value">{format(totals[index])}</strong>
              </div>
            ))}
          </div>
          <div className="chart-axis" aria-hidden="true">
            <span>0</span>
            <span>{format(scale / 2)}</span>
            <span>{format(scale)}</span>
          </div>
          <p className="chart-unit">
            {unit === '%'
              ? 'Percent of eligible cases'
              : unit === 'days'
                ? 'Working days'
                : unit === 'queries'
                  ? 'Query events'
                  : 'Number of cases'}
          </p>
        </div>
      ) : (
        <p className="empty-state">No matching cases to chart.</p>
      )}
    </Panel>
  );
}

export function PerformanceCharts({
  report,
  dimension,
  mofslOnly = false,
}: {
  report: Report;
  dimension: string;
  mofslOnly?: boolean;
}) {
  return (
    <div className="performance-charts">
      <ComparisonChart
        title="Case volume"
        note={`Open, closed and exception cases by ${dimension}.`}
        rows={report.groups}
        unit="cases"
        series={[
          { field: 'open', label: 'Open', color: 'var(--blue)' },
          { field: 'closed', label: 'Closed', color: 'var(--green)' },
          { field: 'exceptions', label: 'Exceptions', color: 'var(--amber)' },
        ]}
      />
      <ComparisonChart
        title="Right first time"
        note="Rejected and cancelled cases are excluded."
        rows={report.groups}
        unit="%"
        maximum={100}
        series={[{ field: 'rftPercent', label: 'RFT rate', color: 'var(--green)' }]}
      />
      <ComparisonChart
        title="Average net TAT"
        note="Query hold is deducted; rejected and cancelled cases are excluded."
        rows={report.groups}
        unit="days"
        series={[{ field: 'averageNetTat', label: 'Average net TAT', color: 'var(--blue)' }]}
      />
      <ComparisonChart
        title="Queries by stage"
        note="Repeat queries count as separate events."
        rows={report.groups}
        unit="queries"
        series={[
          { field: 'stage1Queries', label: 'Stage 1', color: 'var(--blue)' },
          { field: 'stage3Queries', label: 'Stage 3', color: 'var(--amber)' },
          { field: 'stage5Queries', label: 'Stage 5', color: 'var(--red)' },
        ].filter((item) => !mofslOnly || item.field === 'stage5Queries')}
      />
    </div>
  );
}
