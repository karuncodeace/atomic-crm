import { useEffect, useState } from "react";

/** Where a document is while it is being made (AxiCore: docProgress in src/web/api.js). */
export type Progress = {
  steps: string[];
  step: number;
  state: "prepare" | "write" | "wait" | "check";
  label: string;
  started_at: string;
  expected_s: number;
  attempt: number;
  backup: boolean;
  hold_until?: string;
};

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
const about = (s: number) =>
  s < 90 ? `${Math.round(s / 10) * 10} s` : `${Math.round(s / 60)} min`;

/**
 * Where a SWOT, brochure or proposal is while it is being made (owner, 2026-11-14): three steps (research, writing,
 * the check), the current one filling with the time spent against how long that kind usually takes in AxiCore.
 * The time moves every second between the panel's 15-second refreshes.
 */
export const DocProgress = ({ progress: p }: { progress: Progress }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const spent = Math.max(0, (now - Date.parse(p.started_at)) / 1000);
  // how full the current step is: writing against the usual time; the short steps against a minute or so
  const full =
    p.state === "wait"
      ? 0.05
      : Math.min(
          0.95,
          spent /
            (p.state === "write"
              ? p.expected_s
              : p.state === "check"
                ? 45
                : 90),
        );
  const late = p.state === "write" && spent > p.expected_s * 1.15;
  const detail =
    p.state === "wait" && p.hold_until
      ? `until ${new Date(p.hold_until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : p.state === "write"
        ? late
          ? `${clock(spent)} · taking longer than usual (about ${about(p.expected_s)})`
          : `${clock(spent)} of about ${about(p.expected_s)}`
        : clock(spent);
  return (
    <div className="mt-1.5" aria-live="polite">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-label={`${p.label}: step ${p.step + 1} of ${p.steps.length}`}
        aria-valuemin={0}
        aria-valuemax={p.steps.length}
        aria-valuenow={p.step + full}
      >
        {p.steps.map((name, i) => (
          <div key={name} className="grow" title={name}>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                  i === p.step && p.state === "wait"
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}
                style={{
                  width: `${i < p.step ? 100 : i === p.step ? Math.max(4, full * 100) : 0}%`,
                }}
              />
            </div>
            <div
              className={`mt-0.5 text-[10px] ${i === p.step ? "text-foreground" : "text-muted-foreground"}`}
            >
              {name}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {p.label} · {detail}
      </p>
    </div>
  );
};
