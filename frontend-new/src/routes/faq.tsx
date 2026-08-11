import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — SmartAid AI" },
      { name: "description", content: "How SmartAid AI works, what its severity levels mean, privacy of your data, and what to do when the network is down." },
      { property: "og:title", content: "Help & FAQ — SmartAid AI" },
      { property: "og:description", content: "Answers to common questions about SmartAid AI emergency guidance." },
    ],
  }),
  component: FaqPage,
});

const FAQS = [
  {
    q: "Is SmartAid AI a replacement for calling emergency services?",
    a: "No. SmartAid is decision support for the minutes before professional help arrives. If the person is unresponsive, not breathing or bleeding heavily, call your local emergency number first and use SmartAid while you wait.",
  },
  {
    q: "What do the four severity levels mean?",
    a: "Low means self-care first aid is appropriate. Moderate means apply first aid and arrange a medical review the same day. Urgent means begin first aid and reach a hospital as soon as possible. Critical means call emergency services immediately.",
  },
  {
    q: "How does the AI understand what I type?",
    a: "An NLP pipeline extracts clinically relevant symptom terms from your free-text description, matches them to an emergency category, and passes them with your rapid-check answers to a machine learning classifier trained on triage data.",
  },
  {
    q: "Why does SmartAid explain its recommendations?",
    a: "Trust matters in an emergency. Every result lists the factors that raised the risk score and how strongly each contributed, so you can sanity-check the advice rather than following it blindly.",
  },
  {
    q: "Do I need to install an app or create an account?",
    a: "No. Scanning the QR code opens the portal in your browser. There is no login, and the assessment is stored only for the duration of your session.",
  },
  {
    q: "What happens if there is no internet?",
    a: "The offline guide keeps essential first-aid procedures cached on the device. Severity prediction, hospital recommendations and report sharing resume automatically once you are back online.",
  },
  {
    q: "Where does the first aid content come from?",
    a: "Content follows the American Heart Association CPR & ECC guidelines, the WHO emergency care system framework and the IFRC international first aid guidelines.",
  },
  {
    q: "Who can see my emergency report?",
    a: "Only you, until you download or share it. Reports are generated on the device from your session and are not published anywhere automatically.",
  },
];

function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="container-flow py-12 md:py-16">
      <div className="rise">
        <h1 className="text-3xl font-semibold md:text-4xl">Help &amp; FAQ</h1>
        <p className="mt-2 text-muted-foreground">Everything you might want to know before an emergency happens.</p>
      </div>

      <div className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {FAQS.map((f, i) => {
          const expanded = open === i;
          return (
            <div key={f.q}>
              <h2>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium transition-colors hover:bg-secondary/60"
                >
                  <span className="min-w-0">{f.q}</span>
                  <span className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-45" : ""}`} aria-hidden="true">
                    +
                  </span>
                </button>
              </h2>
              {expanded ? <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <p className="font-medium">Still stuck?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a fresh assessment, read the offline guide, or review how the whole system fits together.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/assessment" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
            Start assessment
          </Link>
          <Link to="/offline" className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary">
            Offline guide
          </Link>
          <Link to="/flow" className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary">
            User flow
          </Link>
        </div>
      </div>
    </div>
  );
}
