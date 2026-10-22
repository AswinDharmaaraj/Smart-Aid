import React, { useState } from "react";
import { Star, MessageSquare, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/adminAuth";
import {
  submitFeedback,
  type FeedbackCategory,
  type FeedbackCreate,
} from "@/lib/feedbackService";

interface FeedbackFormProps {
  sessionId?: number | null;
  className?: string;
  onSuccess?: () => void;
}

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "guidance_clarity", label: "Guidance Clarity" },
  { value: "hospital_locator", label: "Hospital Locator" },
  { value: "triage_accuracy", label: "Triage Assessment" },
  { value: "system_usability", label: "System Usability" },
  { value: "general", label: "General Feedback" },
];

export function FeedbackForm({ sessionId, className = "", onSuccess }: FeedbackFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory>("guidance_clarity");
  const [comments, setComments] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating < 1 || rating > 5) {
      setError("Please select a rating between 1 and 5 stars.");
      return;
    }

    if (contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail.trim())) {
        setError("Please enter a valid email address or leave the field blank.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = getAdminToken();
      const payload: FeedbackCreate = {
        session_id: sessionId ?? null,
        rating,
        category,
        comments: comments.trim() || null,
        contact_email: contactEmail.trim() || null,
      };

      await submitFeedback(payload, token);
      setSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className={`rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-foreground">
          Thank you for your feedback!
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
          Your response helps improve first-aid guidance clarity and emergency navigation.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border border-border bg-card p-6 shadow-xs ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <MessageSquare className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">How was your experience?</h3>
          <p className="text-xs text-muted-foreground">
            Help us improve our first-aid instructions and emergency guidance.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Rating Stars */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Rating <span className="text-destructive">*</span>
          </label>
          <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label="First aid rating from 1 to 5 stars"
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-surface focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`size-6 transition-all ${
                      active
                        ? "fill-amber-400 text-amber-500 scale-110"
                        : "text-muted-foreground/40 hover:text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              {rating > 0 ? `${rating} of 5 stars` : "Select rating"}
            </span>
          </div>
        </div>

        {/* Category Selector */}
        <div>
          <label htmlFor="feedback-category" className="block text-xs font-semibold text-foreground mb-1.5">
            Feedback Category
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Comments Field */}
        <div>
          <label htmlFor="feedback-comments" className="block text-xs font-semibold text-foreground mb-1.5">
            Observations & Suggestions <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="feedback-comments"
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            maxLength={2000}
            placeholder="Share what worked well or what instructions were difficult to follow..."
            className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary resize-y"
          />
        </div>

        {/* Contact Email Field */}
        <div>
          <label htmlFor="feedback-email" className="block text-xs font-semibold text-foreground mb-1.5">
            Contact Email <span className="text-muted-foreground font-normal">(optional, for follow-up)</span>
          </label>
          <input
            id="feedback-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button & Advisory Notice */}
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] text-muted-foreground leading-tight">
            Feedback is anonymous by default and used exclusively for usability enhancement.
          </p>

          <Button
            type="submit"
            disabled={submitting || rating === 0}
            className="rounded-xl px-5 h-10 text-xs font-semibold gap-2 shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Submitting…</span>
              </>
            ) : (
              <span>Submit Feedback</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
