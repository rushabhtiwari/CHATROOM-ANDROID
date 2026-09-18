/**
 * The cycle burndown.
 *
 * Ideal is a straight line from full scope to zero; actual is points still
 * open, and stops at today rather than running flat to the cycle's end — an
 * active sprint should not look like it stalled just because the future has not
 * happened yet.
 *
 * `recharts` is already in the console and used by the finance screens, so this
 * is the same chart library the rest of the app draws with.
 */

import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { BurndownPoint } from '@/modules/projects/selectors';

export const Burndown: React.FC<{ data: BurndownPoint[]; height?: number }> = ({
  data,
  height = 200,
}) => {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-muted">
        This cycle has no estimated work, so there is nothing to burn down.
      </p>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    label: format(parseISO(point.date), 'd MMM'),
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#EEF2F7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#75849A' }}
            axisLine={{ stroke: '#E4E9F0' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#75849A' }}
            axisLine={false}
            tickLine={false}
            width={44}
            label={{
              value: 'points',
              angle: -90,
              position: 'insideLeft',
              offset: 16,
              style: { fontSize: 10, fill: '#94A3B8' },
            }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 7,
              border: '1px solid #E4E9F0',
              boxShadow: '0 8px 28px -6px rgba(10,37,71,0.18)',
            }}
            // recharts types the value as string | number | array, so it is
            // narrowed here rather than asserted at the signature.
            formatter={(value, name) => [
              typeof value === 'number' ? `${value} pts` : '—',
              name === 'ideal' ? 'Ideal' : 'Remaining',
            ]}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#06477F"
            strokeWidth={2}
            fill="#06477F"
            fillOpacity={0.08}
            // Gaps rather than a line dropping to zero for days not yet reached.
            connectNulls={false}
            dot={false}
          />
          <Line
            type="linear"
            dataKey="ideal"
            stroke="#C7D2E0"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
