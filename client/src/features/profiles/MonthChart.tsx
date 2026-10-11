// ============================================================================
// MonthChart.tsx: LISTENING TIME FOR EACH MONTH OF A YEAR
//
// One column per month (one series, so no legend: the title says what it is).
// Hovering a column shows its exact time; "Show as table" gives the numbers.
// ============================================================================

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { YearInRecords } from '@vinyl/shared';
import { chartColors, useColorScheme } from '../stats/chart-colors';
import { formatListening, formatMonth } from '../stats/format';
import { busiestMonth } from './year';

type Months = YearInRecords['months'];

export function MonthChart({ months }: { months: Months }) {
  const [asTable, setAsTable] = useState(false);
  const colors = chartColors(useColorScheme());
  const rows = months.map((m) => ({
    ...m,
    label: formatMonth(m.month),
    hours: m.listeningSeconds / 3600,
  }));

  return (
    <section className="stats-card" aria-label="Listening by month">
      <div className="card-header">
        <h2>Listening by month</h2>
        <button type="button" className="button button-small" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">Listening time by month</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Listening time</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{formatMonth(m.month, true)}</th>
                  <td>{m.listeningSeconds ? formatListening(m.listeningSeconds) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-frame" role="img" aria-label={describe(months)}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
                tick={{ fill: colors.axis, fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
                tick={{ fill: colors.axis, fontSize: 12 }}
                tickFormatter={(hours: number) => `${hours} h`}
              />
              <Tooltip
                cursor={{ fill: colors.hover }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !row) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-title">{formatMonth(row.month, true)}</div>
                      <strong>{formatListening(row.listeningSeconds)}</strong>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="hours"
                name="Listening time"
                fill={colors.series[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/** A one-sentence summary for screen readers. */
function describe(months: Months): string {
  const busiest = busiestMonth(months);
  return busiest
    ? `Listening time for each month. Busiest: ${formatMonth(busiest.month, true)}, ${formatListening(busiest.listeningSeconds)}.`
    : 'No listening this year.';
}
