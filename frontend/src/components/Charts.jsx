import { useState } from "react";

export function PipelineDonutChart({ shortlisted = 0, review = 0, rejected = 0 }) {
  const total = shortlisted + review + rejected;
  const segments = [
    { label: "Shortlisted", value: shortlisted, color: "#10b981", bg: "bg-emerald-500" },
    { label: "Needs Review", value: review, color: "#f59e0b", bg: "bg-amber-500" },
    { label: "Not Shortlisted", value: rejected, color: "#f43f5e", bg: "bg-rose-500" },
  ];

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
      <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="18"
          />
          {total > 0 &&
            segments.map((seg) => {
              if (seg.value === 0) return null;
              const dash = (seg.value / total) * circumference;
              const strokeDasharray = `${dash} ${circumference - dash}`;
              const strokeDashoffset = -offset;
              offset += dash;
              return (
                <circle
                  key={seg.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="18"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-slate-900 tabular-nums">{total}</span>
          <span className="text-[11px] font-medium text-slate-500">Candidates</span>
        </div>
      </div>

      <div className="w-full flex-1 space-y-3">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={seg.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.bg}`} />
                  <span className="font-medium text-slate-700">{seg.label}</span>
                </div>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {seg.value} <span className="font-normal text-slate-400">({pct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${seg.bg} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScoreComparisonChart({ candidates = [], cutoff = 60 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const top = candidates.slice(0, 7);

  if (top.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-slate-400">
        No candidate scores to visualize yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" /> Final Score
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-indigo-400" /> JD Fit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-400" /> ML Prob %
          </span>
        </div>
        <span className="font-medium text-slate-600">Cutoff line: {cutoff}</span>
      </div>

      <div className="space-y-3 pt-1">
        {top.map((c) => {
          const modelPct = c.model_prob != null ? Math.round(c.model_prob * 100) : 0;
          const jdPct = c.rule_score != null ? Math.round(c.rule_score) : 0;
          const isHovered = hoveredIdx === c.idx;
          const cutoffLeft = `${Math.min(Math.max(cutoff, 0), 100)}%`;
          return (
            <div
              key={c.idx}
              onMouseEnter={() => setHoveredIdx(c.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="group relative flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-slate-50"
            >
              <div className="w-25 shrink-0 truncate text-xs font-medium text-slate-700" title={c.candidate}>
                #{c.rank} {c.candidate}
              </div>
              <div className="relative flex-1 space-y-1">
                <div
                  className="pointer-events-none absolute -top-1 -bottom-1 z-10 border-l-2 border-dashed border-slate-700/70"
                  style={{ left: cutoffLeft }}
                />
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, c.final_score)}%` }}
                  />
                </div>
                <div className="flex gap-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, jdPct)}%` }}
                    />
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, modelPct)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="w-11 shrink-0 text-right text-xs font-bold text-slate-800 tabular-nums">
                {c.final_score.toFixed(1)}
              </div>

              {isHovered && (
                <div className="pointer-events-none absolute -top-9 right-12 z-20 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
                  Final {c.final_score.toFixed(1)} · JD {jdPct}% · ML {modelPct}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SkillCoverageChart({ skillCoverage = [] }) {
  if (skillCoverage.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        Add required skills in Job Description to see talent pool coverage.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {skillCoverage.slice(0, 10).map((item) => (
        <div key={item.id} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-700">{item.label}</span>
              {item.is_must && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  Must-have
                </span>
              )}
            </div>
            <span className="font-semibold text-slate-700 tabular-nums">
              {item.matched}/{item.total} ({item.pct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                item.pct >= 70 ? "bg-emerald-500" : item.pct >= 40 ? "bg-blue-500" : "bg-rose-400"
              }`}
              style={{ width: `${item.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const FEATURE_LABELS = {
  skills_match_score: "Skills Match Score",
  years_experience: "Years of Experience",
  project_count: "Project Count",
  resume_length: "Resume Length (words)",
  github_activity: "GitHub Activity",
  education_level: "Education Level",
};

export function FeatureImportanceChart({ importances = [] }) {
  if (!importances || importances.length === 0) {
    return <p className="text-sm text-slate-400">Feature importances unavailable.</p>;
  }
  const maxVal = Math.max(...importances.map((i) => i.importance), 0.01);

  return (
    <div className="space-y-3">
      {importances.map((item) => {
        const pct = Math.round(item.importance * 1000) / 10;
        const barWidth = Math.max(4, (item.importance / maxVal) * 100);
        return (
          <div key={item.feature} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">
                {FEATURE_LABELS[item.feature] || item.feature}
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
