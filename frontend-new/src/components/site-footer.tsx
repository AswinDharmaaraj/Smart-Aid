import { Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="font-display text-lg font-semibold">SmartAid AI</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            An intelligent QR-based first aid decision support system with AI emergency risk assessment. Built as an
            MCA major project by Aswin P D.
          </p>
        </div>
        <nav aria-label="Emergency flow" className="text-sm">
          <p className="font-medium">Emergency flow</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li><Link to="/scan" className="hover:text-foreground">QR scan entry</Link></li>
            <li><Link to="/assessment" className="hover:text-foreground">Emergency assessment</Link></li>
            <li><Link to="/symptoms" className="hover:text-foreground">Symptom input</Link></li>
            <li><Link to="/result" className="hover:text-foreground">Severity result</Link></li>
            <li><Link to="/report" className="hover:text-foreground">Emergency report</Link></li>
          </ul>
        </nav>
        <nav aria-label="Resources" className="text-sm">
          <p className="font-medium">Resources</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li><Link to="/offline" className="hover:text-foreground">Offline guide</Link></li>
            <li><Link to="/hospitals" className="hover:text-foreground">Nearby hospitals</Link></li>
            <li><Link to="/flow" className="hover:text-foreground">Sitemap &amp; user flow</Link></li>
            <li><Link to="/faq" className="hover:text-foreground">Help &amp; FAQ</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>SmartAid AI does not replace professional medical care. In a life-threatening emergency, call your local emergency number first.</p>
          <a href="tel:112" className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 font-medium text-foreground">
            <Phone className="size-3.5" aria-hidden="true" /> Emergency 112
          </a>
        </div>
      </div>
    </footer>
  );
}
