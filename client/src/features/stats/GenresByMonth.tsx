// ============================================================================
// GenresByMonth.tsx: THE "GENRES BY MONTH" CHART
//
// One column per month, split into colored parts by genre, so you can see how
// your listening shifts over time. Hover a column for the exact numbers.
// "Show as table" gives the same numbers as a table (easier to read exactly,
// and readable without relying on color).
//
// Drawn with Recharts, a React chart library: <BarChart> holds the data, and
// each <Bar> is one genre stacked on top of the previous ones.
// ============================================================================

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Stats } from '@vinyl/shared';
import { chartColors, OTHER, useColorScheme, useStableSlots } from './chart-colors';
import { formatListening, formatMonth } from './format';

type Data = Stats['genresByMonth'];

/** One column of the chart: the month, plus hours per genre as s0, s1, s2... */
type Row = { month: string; label: string } & Record<string, number | string>;

export function GenresByMonth({ data }: { data: Data }) {
  const [asTable, setAsTable] = useState(false);
  const scheme = useColorScheme();
  const colors = chartColors(scheme);
  const slots = useStableSlots(data.genres.map((g) => g.name));
  const colorOf = (name: string) =>
    name === OTHER ? colors.other : (colors.series[slots.get(name) ?? 0] ?? colors.other);

  // Show the year on January, and on the first month if the chart spans years.
  const spansYears = new Set(data.months.map((m) => m.slice(0, 4))).size > 1;
  const rows: Row[] = data.months.map((month, i) => {
    const row: Row = {
      month,
      label: formatMonth(month, spansYears && (i === 0 || month.endsWith('-01'))),
    };
    data.genres.forEach((genre, g) => {
      row[`s${g}`] = (genre.seconds[i] ?? 0) / 3600; // the chart's scale is hours
    });
    return row;
  });

  /** The highest genre with time in this month: only its top corners get rounded. */
  const topSeries = (row: Row) =>
    data.genres.reduce((top, _genre, g) => (Number(row[`s${g}`]) > 0 ? g : top), -1);

  return (
    <section className="stats-card" aria-label="Genres by month">
      <div className="card-header">
        <h2>Genres by month</h2>
        <button type="button" className="button button-small" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>

      {/* The legend: a colored square + the name (the text itself stays in normal ink). */}
      <ul className="chart-legend" aria-label="Genres">
        {data.genres.map((genre) => (
          <li key={genre.name}>
            <span className="legend-swatch" style={{ background: colorOf(genre.name) }} />
            {genre.name}
          </li>
        ))}
      </ul>

      {asTable ? (
        <GenresTable data={data} />
      ) : (
        <div className="chart-frame" role="img" aria-label={describe(data)}>
          <ResponsiveContainer width="100%" height={280}>
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
                content={({ active, payload }) => (
                  <ChartTooltip active={active} payload={payload} data={data} colorOf={colorOf} />
                )}
              />
              {data.genres.map((genre, g) => (
                <Bar
                  key={genre.name}
                  dataKey={`s${g}`}
                  name={genre.name}
                  stackId="genres"
                  fill={colorOf(genre.name)}
                  // A thin line in the background color leaves a small gap between parts.
                  stroke={colors.surface}
                  strokeWidth={1}
                  maxBarSize={24}
                  isAnimationActive={false}
                  shape={(props: unknown) => {
                    const p = props as React.ComponentProps<typeof Rectangle> & { payload: Row };
                    const radius: [number, number, number, number] =
                      topSeries(p.payload) === g ? [4, 4, 0, 0] : [0, 0, 0, 0];
                    return <Rectangle {...p} radius={radius} />;
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

type TooltipProps = {
  /** True while the pointer is over a month. */
  active?: boolean;
  /** Recharts' info about the hovered month; we only need its row. */
  payload?: readonly { payload?: unknown }[];
  data: Data;
  colorOf: (name: string) => string;
};

/** The box shown when you hover a month: every genre's time, the value first. */
function ChartTooltip({ active, payload, data, colorOf }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const month = (payload[0]?.payload as Row | undefined)?.month;
  const index = month ? data.months.indexOf(month) : -1;
  if (index < 0) return null;
  const total = data.genres.reduce((sum, g) => sum + (g.seconds[index] ?? 0), 0);

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatMonth(data.months[index] ?? '', true)}</div>
      {[...data.genres].reverse().map((genre) => {
        const seconds = genre.seconds[index] ?? 0;
        if (seconds === 0) return null;
        return (
          <div key={genre.name} className="chart-tooltip-row">
            <span className="line-key" style={{ background: colorOf(genre.name) }} />
            <strong>{formatListening(seconds)}</strong>
            <span className="muted">{genre.name}</span>
          </div>
        );
      })}
      <div className="chart-tooltip-total">
        <strong>{formatListening(total)}</strong> <span className="muted">total</span>
      </div>
    </div>
  );
}

/** The same numbers as a table: a row per month, a column per genre. */
function GenresTable({ data }: { data: Data }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Listening time per genre, by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {data.genres.map((g) => (
              <th key={g.name} scope="col">
                {g.name}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.months.map((month, i) => (
            <tr key={month}>
              <th scope="row">{formatMonth(month, true)}</th>
              {data.genres.map((g) => (
                <td key={g.name}>{g.seconds[i] ? formatListening(g.seconds[i] ?? 0) : '–'}</td>
              ))}
              <td>
                {formatListening(data.genres.reduce((sum, g) => sum + (g.seconds[i] ?? 0), 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A one-sentence summary for screen readers. */
function describe(data: Data): string {
  const totals = data.genres.map((g) => ({
    name: g.name,
    seconds: g.seconds.reduce((a, b) => a + b, 0),
  }));
  const top = totals[0];
  return top
    ? `Listening time by genre over ${data.months.length} months. Most listened: ${top.name}, ${formatListening(top.seconds)}.`
    : 'No listening in this period.';
}
