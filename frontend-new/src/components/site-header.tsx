import { Link } from "@tanstack/react-router";
import { Menu, ShieldPlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/scan", label: "Start" },
  { to: "/history", label: "History" },
  { to: "/offline", label: "Offline guide" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "Help" },
  { to: "/admin/login", label: "Admin" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldPlus className="size-5" aria-hidden="true" />
          </span>
          <span className="truncate font-display text-lg font-semibold tracking-tight">SmartAid AI</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
          <Button asChild size="sm" className="ml-2">
            <Link to="/assessment">Get help now</Link>
          </Button>
        </nav>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open ? (
        <nav aria-label="Mobile" className="border-t border-border bg-background md:hidden">
          <div className="container-page flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild size="lg" className="my-2">
              <Link to="/assessment" onClick={() => setOpen(false)}>
                Get help now
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
