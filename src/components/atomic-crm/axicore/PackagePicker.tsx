import { useCallback, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { WEBSITE_PACKAGES, type WebsitePackage } from "./packages";

/** The package choices as a grid of cards (used in the popup and inside the call-outcome dialog). */
export const PackageChoices = ({
  value,
  onChange,
}: {
  value: WebsitePackage | null;
  onChange: (value: WebsitePackage) => void;
}) => (
  <div
    role="radiogroup"
    aria-label="Website package"
    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
  >
    {WEBSITE_PACKAGES.map((p) => {
      const selected = value === p.value;
      return (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(p.value)}
          className={cn(
            "relative rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            selected
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:bg-accent",
          )}
        >
          <span className="block pr-5 text-sm font-semibold">{p.label}</span>
          <span
            className={cn(
              "mt-0.5 block text-xs",
              selected ? "text-background/70" : "text-muted-foreground",
            )}
          >
            {p.hint}
          </span>
          {selected ? (
            <Check className="absolute top-2.5 right-2.5 size-4" />
          ) : null}
        </button>
      );
    })}
  </div>
);

/**
 * `ask()` opens the popup and resolves with the chosen package, or null when it is cancelled.
 * Render `dialog` once in the component that calls `ask`.
 */
export function usePackagePicker(): {
  ask: (current?: WebsitePackage | null) => Promise<WebsitePackage | null>;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<WebsitePackage | null>(null);
  const resolver = useRef<((v: WebsitePackage | null) => void) | null>(null);

  const finish = useCallback((result: WebsitePackage | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  }, []);

  const ask = useCallback((current?: WebsitePackage | null) => {
    setValue(current ?? null);
    setOpen(true);
    return new Promise<WebsitePackage | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <Dialog open={open} onOpenChange={(next) => (next ? null : finish(null))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Which website does the client want?</DialogTitle>
          <DialogDescription>
            AxiCore uses this to pick the brochure design for the lead.
          </DialogDescription>
        </DialogHeader>
        <PackageChoices value={value} onChange={setValue} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => finish(null)}>
            Cancel
          </Button>
          <Button type="button" disabled={!value} onClick={() => finish(value)}>
            Mark as interested
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ask, dialog };
}
