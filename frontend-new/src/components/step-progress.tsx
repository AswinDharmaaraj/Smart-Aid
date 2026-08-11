import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const FLOW_STEPS = [
  { to: "/assessment", label: "Emergency" },
  { to: "/symptoms", label: "Symptoms" },
  { to: "/result", label: "Severity" },
  { to: "/guidance", label: "First aid" },
  { to: "/report", label: "Report" },
] as const;

export function StepProgress({ current }: { current: number }) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-1.5">
        {FLOW_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.to} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  done ? "bg-primary" : active ? "bg-primary/60" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 truncate text-[11px]",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}
                {done ? (
                  <Link to={step.to} className="truncate hover:text-foreground">
                    {step.label}
                  </Link>
                ) : (
                  <span className="truncate">{step.label}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only">{`Step ${current + 1} of ${FLOW_STEPS.length}`}</p>
    </nav>
  );
}
