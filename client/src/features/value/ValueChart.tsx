// ============================================================================
// ValueChart.tsx: THE COLLECTION'S VALUE OVER TIME
//
// One line (so no legend: the title says what it is), with a point for every
// day prices were looked up. Hovering shows that day's exact value; "Show as
// table" gives the same numbers as a table.
// ============================================================================

import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CollectionValue } from '@vinyl/shared';
import { chartColors, useColorScheme } from '../stats/chart-colors';
import { formatPrice } from '../streaming/format';
import { formatDay } from './format';

type History = CollectionValue['history'];

export function ValueChart({ history, currency }: { history: History; currency: string }) {
  const [asTable, setAsTable] = useState(false);
  const colors = chartColors(useColorScheme());
  const line = colors.series[0];
  const rows = history.map((point) => ({ ...point, label: formatDay(point.date) }));

  return (
    <section className="stats-card" aria-label="Value over time">
      <div className="card-header">
        <h2>Value over time</h2>
        <button type="button" className="button button-small" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">Collection value by day</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Value</th>
                <th scope="col">Records priced</th>
              </tr>
            </thead>
            <tbody>
              {/* Newest first: the latest value is what people look for. */}
              {[...history].reverse().map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatDay(point.date, true)}</th>
                  <td>{formatPrice(point.value, currency)}</td>
                  <td>{point.pricedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-frame" role="img" aria-label={describe(history, currency)}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
                tick={{ fill: colors.axis, fontSize: 12 }}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: colors.axis, fontSize: 12 }}
                tickFormatter={(value: number) => formatPrice(value, currency, true)}
              />
              <Tooltip
                cursor={{ stroke: colors.axis, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !row) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-title">{formatDay(row.date, true)}</div>
                      <strong>{formatPrice(row.value, currency)}</strong>
                      <div className="muted">
                        {row.pricedCount} {row.pricedCount === 1 ? 'record' : 'records'} priced
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Collection value"
                stroke={line}
                strokeWidth={2}
                // A light wash under the line, not a solid block.
                fill={line}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/** A one-sentence summary for screen readers. */
function describe(history: History, currency: string): string {
  const first = history[0];
  const last = history.at(-1);
  if (!first || !last) return 'No value history yet.';
  return `Collection value from ${formatDay(first.date, true)} to ${formatDay(last.date, true)}: ${formatPrice(first.value, currency)} to ${formatPrice(last.value, currency)}.`;
}
