import { SEVERITY_META, type SeverityLevel } from "@/lib/smartaid";
import { cn } from "@/lib/utils";

const STYLES: Record<SeverityLevel, string> = {
  Low: "bg-low-soft text-low border-low/30",
  Moderate: "bg-moderate-soft text-moderate border-moderate/30",
  Urgent: "bg-urgent-soft text-urgent border-urgent/30",
  Critical: "bg-critical-soft text-critical border-critical/30",
};

export function SeverityBadge({ level, className }: { level: SeverityLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        STYLES[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {SEVERITY_META[level].headline}
    </span>
  );
}
