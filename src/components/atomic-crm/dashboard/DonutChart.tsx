import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** CSS colour, usually a token: "var(--stage-new)". */
  color: string;
}

const SIZE = 220;
const RADIUS = 82;
const STROKE = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Gap between segments, in px along the ring. */
const GAP = 3;

/**
 * Donut with depth: each segment has a light-to-dark gradient, the ring sits
 * on a soft drop shadow over a recessed track, and the segments sweep in one
 * after the other on first render. Hovering (or focusing) a segment enlarges
 * it and shows its numbers in the centre.
 */
export const DonutChart = ({
  segments,
  total,
  centerLabel,
  ariaLabel,
  active,
  onActiveChange,
}: {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
  ariaLabel: string;
  /** Highlighted segment key (controlled, shared with the legend). */
  active: string | null;
  onActiveChange: (key: string | null) => void;
}) => {
  const id = useId().replace(/:/g, "");
  const [drawn, setDrawn] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    // after the entrance sweep, hover changes apply without stagger
    const timer = setTimeout(() => setSettled(true), 1600);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  const visible = segments.filter((segment) => segment.value > 0);
  const sum = visible.reduce((acc, segment) => acc + segment.value, 0);
  const activeSegment = visible.find((segment) => segment.key === active);

  let offset = 0;
  const arcs = visible.map((segment, index) => {
    const share = sum > 0 ? segment.value / sum : 0;
    const gap = visible.length > 1 ? GAP : 0;
    const length = Math.max(share * CIRCUMFERENCE - gap, 0.5);
    const arc = { segment, index, length, start: offset };
    offset += share * CIRCUMFERENCE;
    return arc;
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90 overflow-visible"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <filter
            id={`${id}-shadow`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="5"
              floodColor="rgb(31 27 20)"
              floodOpacity="0.16"
            />
          </filter>
          {visible.map((segment) => (
            <linearGradient
              key={segment.key}
              id={`${id}-${segment.key}`}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0%"
                style={{
                  stopColor: `color-mix(in oklab, ${segment.color} 78%, white)`,
                }}
              />
              <stop offset="55%" style={{ stopColor: segment.color }} />
              <stop
                offset="100%"
                style={{
                  stopColor: `color-mix(in oklab, ${segment.color} 80%, black)`,
                }}
              />
            </linearGradient>
          ))}
        </defs>

        {/* recessed track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS - STROKE / 2 + 0.5}
          fill="none"
          stroke="rgb(31 27 20 / 0.06)"
          strokeWidth={1}
        />

        <g filter={`url(#${id}-shadow)`}>
          {arcs.map(({ segment, index, length, start }) => {
            const isActive = segment.key === active;
            const isDimmed = active !== null && !isActive;
            return (
              <circle
                key={segment.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={`url(#${id}-${segment.key})`}
                strokeLinecap="butt"
                strokeDashoffset={-start}
                tabIndex={0}
                aria-label={`${segment.label}: ${segment.value}`}
                onMouseEnter={() => onActiveChange(segment.key)}
                onMouseLeave={() => onActiveChange(null)}
                onFocus={() => onActiveChange(segment.key)}
                onBlur={() => onActiveChange(null)}
                className={cn(
                  "cursor-pointer outline-none transition-[stroke-dasharray,stroke-width,opacity] duration-700 ease-out motion-reduce:transition-none",
                  isDimmed && "opacity-45",
                )}
                style={{
                  // as styles (not attributes) so CSS transitions animate them
                  strokeDasharray: `${drawn ? length : 0} ${CIRCUMFERENCE}`,
                  strokeWidth: isActive ? STROKE + 8 : STROKE,
                  transitionDelay: settled ? "0ms" : `${index * 120}ms`,
                }}
              />
            );
          })}
        </g>

        {/* glossy highlight on the outer edge */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS + STROKE / 2 - 1.5}
          fill="none"
          stroke="rgb(255 255 255 / 0.35)"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {activeSegment ? (
          <>
            <span className="text-[28px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
              {activeSegment.value.toLocaleString()}
            </span>
            <span className="mt-1 max-w-[7rem] truncate text-xs font-medium text-foreground">
              {activeSegment.label}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {total > 0
                ? `${Math.round((activeSegment.value / total) * 100)}%`
                : "0%"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[32px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
              {total.toLocaleString()}
            </span>
            <span className="mt-1.5 text-xs text-muted-foreground">
              {centerLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
