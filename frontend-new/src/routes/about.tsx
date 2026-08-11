import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Cpu, Database, GraduationCap, HeartPulse, QrCode, Sparkles, WifiOff } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SmartAid AI — Project Overview" },
      { name: "description", content: "SmartAid AI is an intelligent QR-based first aid decision support system with AI emergency risk assessment, built as an MCA major project." },
      { property: "og:title", content: "About SmartAid AI — Project Overview" },
      { property: "og:description", content: "Objectives, architecture, technology stack and social impact of the SmartAid AI project." },
    ],
  }),
  component: AboutPage,
});

const OBJECTIVES = [
  "Develop a QR-based emergency access system for instant first-aid assistance.",
  "Analyse user-entered symptoms using Artificial Intelligence.",
  "Predict the severity level of an emergency using Machine Learning.",
  "Provide personalised first-aid recommendations based on emergency and user profile.",
  "Explain the reason behind each recommendation using Explainable AI.",
  "Generate an emergency summary that can be shared with healthcare professionals.",
  "Provide offline access to essential first-aid guidance during network failures.",
];

const STACK = [
  { icon: Sparkles, title: "Frontend", items: ["React.js", "HTML5", "CSS3", "JavaScript"] },
  { icon: Cpu, title: "Backend", items: ["FastAPI (Python)"] },
  { icon: Brain, title: "Machine learning", items: ["Scikit-learn", "Random Forest / XGBoost", "Pandas", "NumPy"] },
  { icon: HeartPulse, title: "NLP", items: ["spaCy", "Transformers (optional)"] },
  { icon: Database, title: "Database", items: ["PostgreSQL / MySQL"] },
  { icon: QrCode, title: "Additional tools", items: ["QR code generator", "Text-to-speech", "Google Maps API (optional)"] },
];

const NOVEL = [
  "AI-based emergency severity prediction",
  "Natural language symptom understanding",
  "Explainable AI for transparent recommendations",
  "Personalised guidance by age, symptoms and emergency type",
  "Offline emergency assistance",
  "Automatic emergency report generation",
  "QR-based instant access without app installation",
];

function AboutPage() {
  return (
    <div className="pb-4">
      <section className="border-b border-border bg-surface">
        <div className="container-page py-16 md:py-20">
          <div className="max-w-3xl rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <GraduationCap className="size-3.5" aria-hidden="true" /> MCA major project · Aswin P D · Roll 18 · S3
            </span>
            <h1 className="mt-5 text-4xl font-semibold md:text-5xl">About SmartAid AI</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              An intelligent QR-based first aid decision support system with emergency risk assessment, spanning
              Artificial Intelligence, Machine Learning, Healthcare Informatics, Decision Support Systems and Web
              Application Development.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="problem">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 id="problem" className="text-2xl font-semibold md:text-3xl">The problem</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Burns, choking, fractures, snake bites, heart attacks and electric shocks all demand immediate first aid
              before professional help arrives. Most bystanders lack first-aid knowledge and panic, which leads to
              delayed or incorrect action. Existing first-aid apps only serve static information — they cannot judge
              how severe a situation is or tailor advice to the person involved.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">The proposed solution</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              A QR code placed in schools, offices, buses and factories opens a browser portal instantly. NLP extracts
              symptoms from natural language, a machine learning model grades severity as Low, Moderate, Urgent or
              Critical, and a decision support engine returns personalised steps, precautions, an explanation of the
              reasoning, a hospital recommendation and a structured report for clinicians.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-16" aria-labelledby="objectives">
        <div className="container-page">
          <h2 id="objectives" className="text-2xl font-semibold md:text-3xl">Objectives</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {OBJECTIVES.map((o, i) => (
              <li key={o} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="font-display text-sm font-semibold text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm leading-relaxed">{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="architecture">
        <h2 id="architecture" className="text-2xl font-semibold md:text-3xl">System architecture</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card p-6">
          <div className="mx-auto flex min-w-[18rem] max-w-md flex-col items-center gap-2 text-sm">
            {["QR code scan", "Emergency web portal", "Symptom input", "NLP symptom extraction", "ML severity prediction", "Decision support engine"].map((n) => (
              <div key={n} className="w-full">
                <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center font-medium">{n}</div>
                <div className="mx-auto h-4 w-px bg-border" aria-hidden="true" />
              </div>
            ))}
            <div className="grid w-full gap-2 sm:grid-cols-3">
              {["First aid guidance", "Explainable AI", "Emergency report"].map((n) => (
                <div key={n} className="rounded-xl border border-primary/30 bg-primary-soft px-3 py-3 text-center text-xs font-medium text-primary">
                  {n}
                </div>
              ))}
            </div>
            <div className="h-4 w-px bg-border" aria-hidden="true" />
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center font-medium">Hospital recommendation</div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-16" aria-labelledby="stack">
        <div className="container-page">
          <h2 id="stack" className="text-2xl font-semibold md:text-3xl">Technologies used</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((s) => (
              <div key={s.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 font-medium">{s.title}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="novel">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 id="novel" className="text-2xl font-semibold md:text-3xl">Novel features</h2>
            <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
              {NOVEL.map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">Social impact</h2>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              SmartAid improves emergency preparedness by giving immediate guidance in critical moments. It reduces
              delays in administering first aid, raises public awareness, supports educational institutions and
              workplaces, and lowers complications caused by incorrect first-aid practice. Because access is through a
              QR code, no installation is required — making it a low-cost platform for schools, workplaces, public
              institutions and community awareness programmes.
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <WifiOff className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Offline caching keeps the essential procedures usable during disasters and poor network conditions.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page pb-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center md:p-12">
          <h2 className="text-2xl font-semibold">See the whole journey</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            The sitemap, user flow diagram and design system are documented in the site itself.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/flow" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground">
              Sitemap &amp; user flow
            </Link>
            <Link to="/design-system" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium hover:bg-secondary">
              Design system
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
