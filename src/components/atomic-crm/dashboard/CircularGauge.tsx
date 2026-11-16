const SIZE = 184;
const STROKE = 14;
const RADIUS = SIZE / 2 - STROKE / 2 - 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MARKERS = [0, 25, 50, 75];

/**
 * Yellow progress ring with the percentage in the middle and 0/25/50/75
 * markers around it. `value` is clamped to 0..100 for the arc, but the label
 * shows the real number (a team can go past its target).
 */
export const CircularGauge = ({
  value,
  label,
}: {
  value: number;
  label: string;
}) => {
  const clamped = Math.min(Math.max(value, 0), 100);
  const center = SIZE / 2;
  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`${label}: ${value}%`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          className="stroke-card"
          strokeWidth={STROKE}
        />
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          transform={`rotate(-90 ${center} ${center})`}
        />
        {MARKERS.map((marker) => {
          const angle = (marker / 100) * 2 * Math.PI - Math.PI / 2;
          const distance = RADIUS + STROKE / 2 + 9;
          return (
            <text
              key={marker}
              x={center + Math.cos(angle) * distance}
              y={center + Math.sin(angle) * distance}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px] font-medium"
            >
              {marker}%
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
          {value}%
        </span>
        <span className="mt-1 max-w-24 text-center text-[11px] leading-tight text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
};
