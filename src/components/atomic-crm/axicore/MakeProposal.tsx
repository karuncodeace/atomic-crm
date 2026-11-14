import { Button } from "@/components/ui/button";

/**
 * "Make proposal" in the Documents panel (owner, 2026-11-14): hidden while a proposal is being made, and
 * "Make a new proposal" once one exists. Admins and managers only (the panel checks can_propose).
 */
export const MakeProposal = ({
  hasProposal,
  working,
  starting,
  onMake,
}: {
  hasProposal: boolean;
  working: boolean;
  starting: boolean;
  onMake: () => void;
}) => {
  if (working) return null;
  return (
    <div className="mt-2 border-t pt-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-full text-xs"
        disabled={starting}
        onClick={onMake}
      >
        {starting
          ? "Starting…"
          : hasProposal
            ? "Make a new proposal"
            : "Make proposal"}
      </Button>
    </div>
  );
};
