import { useState } from "react";
import {
  Mail,
  Phone,
  Linkedin,
  Github,
  FileText,
  CheckCircle2,
  AlertCircle,
  MessageSquareMore,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StatusBadge, getStatusStyle } from "./StatusBadge.jsx";

export default function CandidateDetailsView({
  candidates,
  selectedIdx,
  onSelectCandidate,
  onUpdateResumeField,
  config,
}) {
  const [showRawText, setShowRawText] = useState(false);

  if (!candidates || candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-slate-800">No candidate reports available</p>
        <p className="mt-1 text-xs text-slate-500">
          Upload resumes and configure a job description to view rankings and candidate reports.
        </p>
      </div>
    );
  }

  const selected = candidates.find((c) => c.idx === selectedIdx) || candidates[0];
  const style = getStatusStyle(selected.status);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Candidate Details & Ranking</h2>
        <p className="text-sm text-slate-500">
          Full ranked leaderboard paired with explainable AI insights, skill matches, and interview questions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Ranked Leaderboard */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs lg:col-span-4 overflow-hidden flex flex-col max-h-[820px]">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Ranked Leaderboard ({candidates.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto">
            {candidates.map((c) => {
              const active = c.idx === selected.idx;
              const barStyle = getStatusStyle(c.status);
              return (
                <button
                  key={c.idx}
                  type="button"
                  onClick={() => {
                    onSelectCandidate(c.idx);
                    setShowRawText(false);
                  }}
                  className={`w-full p-4 text-left transition ${
                    active ? "bg-blue-50/70 ring-1 ring-inset ring-blue-500/30" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        #{c.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{c.candidate}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {c.experience.toFixed(1)} yrs · {c.education}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {c.final_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="relative h-1.5 flex-1 rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${barStyle.bar}`}
                        style={{ width: `${Math.min(100, c.final_score)}%` }}
                      />
                      <div
                        className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-700"
                        style={{ left: `${Math.min(100, config.cutoff)}%` }}
                      />
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Inspector */}
        <div className="space-y-5 lg:col-span-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                    Rank #{selected.rank}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900">{selected.candidate}</h3>
                  <StatusBadge status={selected.status} size="md" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                  {selected.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" /> {selected.email}
                    </span>
                  )}
                  {selected.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> {selected.phone}
                    </span>
                  )}
                  {selected.linkedin && (
                    <span className="inline-flex items-center gap-1.5">
                      <Linkedin className="h-3.5 w-3.5 text-slate-400" /> {selected.linkedin}
                    </span>
                  )}
                  {selected.github_profile && (
                    <span className="inline-flex items-center gap-1.5">
                      <Github className="h-3.5 w-3.5 text-slate-400" /> {selected.github_profile}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <FileText className="h-3.5 w-3.5" /> {selected.file} ({selected.words} words)
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  HR Decision
                </span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  {["Auto", "Shortlist", "Reject"].map((decision) => {
                    const active = selected.hr_decision === decision;
                    return (
                      <button
                        key={decision}
                        type="button"
                        onClick={() => onUpdateResumeField(selected.idx, "hr_decision", decision)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          active
                            ? decision === "Shortlist"
                              ? "bg-emerald-600 text-white"
                              : decision === "Reject"
                              ? "bg-rose-600 text-white"
                              : "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {decision}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4-Metric Score Strip */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
                <p className="text-[11px] font-medium text-slate-500">Final Score</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${style.text}`}>
                  {selected.final_score.toFixed(1)}
                </p>
                <p className="text-[11px] text-slate-400">Cutoff {config.cutoff}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
                <p className="text-[11px] font-medium text-slate-500">JD Fit Score</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {selected.rule_score != null ? `${selected.rule_score.toFixed(0)}%` : "n/a"}
                </p>
                <p className="text-[11px] text-slate-400">Weighted rules</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
                <p className="text-[11px] font-medium text-slate-500">ML Probability</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {selected.model_prob != null ? `${Math.round(selected.model_prob * 100)}%` : "n/a"}
                </p>
                <p className="text-[11px] text-slate-400">Gradient Boosting</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
                <p className="text-[11px] font-medium text-slate-500">Skills Match</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {selected.skills_pct != null
                    ? `${selected.matched.length}/${selected.matched.length + selected.missing.length}`
                    : "n/a"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {selected.experience.toFixed(1)} yrs · {selected.education}
                </p>
              </div>
            </div>

            {/* In Favour vs Gaps */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  In Favour
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                  {selected.good.length ? (
                    selected.good.map((g, i) => <li key={i}>• {g}</li>)
                  ) : (
                    <li className="text-slate-400">Nothing stands out yet.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-800">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  Gaps & Risks
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                  {selected.gaps.length ? (
                    selected.gaps.map((g, i) => <li key={i}>• {g}</li>)
                  ) : (
                    <li className="text-emerald-700">No gaps against the stated requirements.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Skills Matched & Missing */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Skills Found ({selected.matched.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.matched.length ? (
                    selected.matched.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/20"
                      >
                        {s.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Skills Not Found ({selected.missing.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.missing.length ? (
                    selected.missing.map((s) => {
                      const isMust = selected.must_missing.some((m) => m.id === s.id);
                      return (
                        <span
                          key={s.id}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${
                            isMust
                              ? "bg-amber-50 text-amber-900 ring-amber-400/50"
                              : "bg-rose-50 text-rose-800 ring-rose-600/20"
                          }`}
                        >
                          {s.label}
                          {isMust ? " (Must-have)" : ""}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-emerald-700">All required skills present!</span>
                  )}
                </div>
              </div>
            </div>

            {/* Interview Questions & Flags */}
            {selected.interview_questions?.length > 0 && (
              <div className="mt-6 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <MessageSquareMore className="h-4 w-4 text-blue-600" />
                  Suggested Interview Questions
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                  {selected.interview_questions.map((q, i) => (
                    <li key={i}>• {q}</li>
                  ))}
                </ul>
              </div>
            )}

            {selected.flags?.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                  <ShieldAlert className="h-3.5 w-3.5" /> Audit Notes:
                </span>
                {selected.flags.map((flag, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}

            {/* Collapsible Extracted Resume Text */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowRawText((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {showRawText ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showRawText ? "Hide extracted resume text" : "View extracted resume text"}
              </button>
              {showRawText && (
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
                  {selected.text}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
