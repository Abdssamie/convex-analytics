import { S } from "./constants";
import { formatDate, formatNumber } from "./helpers";
import type { TimeseriesPoint } from "./types";

export function TrendChart({
  data,
  metric,
  color,
  height = 220,
  interval,
  emptyLabel,
}: {
  data: TimeseriesPoint[];
  metric: Extract<keyof TimeseriesPoint, "visitors" | "sessions" | "pageviews" | "events">;
  color: string;
  height?: number;
  interval: "hour" | "day";
  emptyLabel?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: S.textMut,
          fontSize: 13,
        }}
      >
        {emptyLabel ?? "No data"}
      </div>
    );
  }

  const W = 760;
  const H = height;
  const PAD = { top: 20, right: 14, bottom: 34, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d[metric] as number);
  const maxVal = Math.max(...values, 1);
  const n = data.length;
  const baselineY = PAD.top + chartH;
  const stepX = n > 1 ? chartW / (n - 1) : 0;
  const points = data.map((point, index) => {
    const value = point[metric] as number;
    const x = n === 1 ? PAD.left + chartW / 2 : PAD.left + index * stepX;
    const y = baselineY - (value / maxVal) * chartH;
    return { x, y, value, bucketStart: point.bucketStart };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = [
    `M ${points[0]?.x ?? PAD.left} ${baselineY}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? PAD.left} ${baselineY}`,
    "Z",
  ].join(" ");
  const labelIdxs = Array.from(
    new Set([0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1]),
  );
  const ticks = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      style={{
        display: "block",
        background:
          "linear-gradient(180deg, rgba(246,248,251,0.7) 0%, rgba(255,255,255,0.2) 100%)",
        borderRadius: 16,
      }}
    >
      {ticks.map((f) => {
        const y = PAD.top + chartH * (1 - f);
        return (
          <line
            key={f}
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke={S.border}
            strokeWidth="1"
          />
        );
      })}

      {ticks.map((f) => {
        const value = maxVal * f;
        const y = PAD.top + chartH * (1 - f) + 4;
        return (
          <text
            key={f}
            x={PAD.left - 8}
            y={y}
            textAnchor="end"
            fontSize="10"
            fill={S.textMut}
          >
            {formatNumber(value)}
          </text>
        );
      })}

      <path d={areaPath} fill={color} opacity="0.14" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={n <= 2 ? 4 : 3}
          fill={S.card}
          stroke={color}
          strokeWidth="2"
        >
          <title>
            {formatDate(point.bucketStart, interval)}: {formatNumber(point.value)}
          </title>
        </circle>
      ))}

      {labelIdxs.map((i) => (
        <text
          key={i}
          x={points[i]?.x ?? PAD.left}
          y={H - 4}
          textAnchor="middle"
          fontSize="10"
          fill={S.textMut}
        >
          {formatDate(data[i].bucketStart, interval)}
        </text>
      ))}
    </svg>
  );
}
