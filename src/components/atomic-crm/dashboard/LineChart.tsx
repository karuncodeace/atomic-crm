import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface LinePoint {
  label: string;
  value: number;
  /** Tooltip text; defaults to the value. */
  display?: string;
}

const WIDTH = 600;
const HEIGHT = 200;
const PAD_TOP = 12;
const GRID_LINES = 4;

/** Axis top split into 4 even, round ticks (1/2/5 x 10^n each), optionally capped. */
const axisMax = (value: number, cap?: number): number => {
  const raw = Math.max(value, 1) / GRID_LINES;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const tick =
    ([1, 2, 5, 10].find((s) => s * magnitude >= raw) ?? 10) * magnitude;
  const max = tick * GRID_LINES;
  return cap !== undefined && max > cap ? cap : max;
};

/** Smooth curve through the points (Catmull-Rom as cubic Béziers), kept inside the box. */
const smoothPath = (xy: [number, number][]): string => {
  if (xy.length === 0) return "";
  if (xy.length === 1) return `M${xy[0][0]},${xy[0][1]}`;
  const clampY = (y: number) => Math.min(Math.max(y, PAD_TOP), HEIGHT);
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
};

/**
 * Minimal yellow line chart: soft area fill, 4 hairline grid lines, month
 * labels, and a tooltip on hover / focus for each point.
 */
export const LineChart = ({
  points,
  ariaLabel,
  formatAxis = (value) => value.toLocaleString(),
  maxValue,
}: {
  points: LinePoint[];
  ariaLabel: string;
  formatAxis?: (value: number) => string;
  /** Upper bound for the axis (e.g. 100 for percentages). */
  maxValue?: number;
}) => {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = axisMax(
    Math.max(...points.map((point) => point.value), 0),
    maxValue,
  );
  const step = points.length > 1 ? WIDTH / (points.length - 1) : 0;
  const xy = points.map(
    (point, index) =>
      [index * step, HEIGHT - (point.value / max) * (HEIGHT - PAD_TOP)] as [
        number,
        number,
      ],
  );
  const line = smoothPath(xy);
  const area = xy.length
    ? `${line} L${xy[xy.length - 1][0]},${HEIGHT} L0,${HEIGHT} Z`
    : "";

  return (
    <div className="flex gap-3">
      <div
        className="relative h-[200px] min-w-8 text-right text-[11px] tabular-nums text-muted-foreground"
        aria-hidden
      >
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
          <span
            key={i}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: PAD_TOP + ((HEIGHT - PAD_TOP) / GRID_LINES) * i }}
          >
            {formatAxis(Math.round(max - (max / GRID_LINES) * i))}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="relative h-[200px]"
          role="img"
          aria-label={ariaLabel}
          onMouseLeave={() => setActive(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
              const y = PAD_TOP + ((HEIGHT - PAD_TOP) / GRID_LINES) * i;
              return (
                <line
                  key={i}
                  x1={0}
                  x2={WIDTH}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeDasharray={i === GRID_LINES ? undefined : "3 4"}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {points.map((point, index) => {
            const left = `${(xy[index][0] / WIDTH) * 100}%`;
            const top = `${(xy[index][1] / HEIGHT) * 100}%`;
            const isActive = active === index;
            return (
              <button
                key={point.label}
                type="button"
                aria-label={`${point.label}: ${point.display ?? point.value}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="absolute top-0 h-full -translate-x-1/2 outline-none"
                style={{ left, width: `${100 / Math.max(points.length, 1)}%` }}
              >
                <span
                  className={cn(
                    "absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-brand shadow-sm transition-transform",
                    isActive ? "scale-125" : "scale-0",
                  )}
                  style={{ top }}
                />
                {isActive ? (
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background shadow-md"
                    style={{ top }}
                  >
                    <span className="block text-[10px] font-normal opacity-70">
                      {point.label}
                    </span>
                    {point.display ?? point.value.toLocaleString()}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div
          className="relative mt-2 h-4 text-[11px] text-muted-foreground"
          aria-hidden
        >
          {points.map((point, index) => (
            <span
              key={point.label}
              className={cn(
                "absolute -translate-x-1/2 whitespace-nowrap",
                index === 0 && "translate-x-0",
                index === points.length - 1 && "-translate-x-full",
              )}
              style={{ left: `${(xy[index][0] / WIDTH) * 100}%` }}
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
