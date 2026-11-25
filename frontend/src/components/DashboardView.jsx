import {
  Users,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Sparkles,
  UploadCloud,
  ArrowRight,
  Award,
  Briefcase,
} from "lucide-react";
import { PipelineDonutChart, ScoreComparisonChart, SkillCoverageChart } from "./Charts.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

export default function DashboardView({
  summary,
  candidates,
  config,
  requirements,
  onNavigate,
  onLoadDemo,
  demoLoading,
  onInspectCandidate,
}) {
  const hasCandidates = candidates && candidates.length > 0;

  if (!hasCandidates) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xs sm:p-10">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-50 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/15">
              <Sparkles className="h-3.5 w-3.5" /> AI-Powered Talent Screening
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Screen resumes faster with transparent JD fit + ML scoring
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Paste your job description, upload PDF, DOCX, or TXT resumes, and let our scikit-learn
              Gradient Boosting pipeline and skill extractor rank every candidate with explainable
              reasons, skill gap analysis, and interview prompts.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLoadDemo}
                disabled={demoLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {demoLoading ? "Loading sample workspace..." : "Load Sample JD & 7 Resumes"}
              </button>
              <button
                type="button"
                onClick={() => onNavigate("upload")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <UploadCloud className="h-4 w-4 text-slate-500" />
                Upload Custom Resumes
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              title: "1. Configure JD & Resumes",
              body: "Extract required skills, experience, and education from any job description and parse multi-format resumes.",
              tab: "upload",
            },
            {
              title: "2. Inspect AI & ML Signals",
              body: "Review parsed fields inline, inspect Gradient Boosting feature weights, or test What-If profiles.",
              tab: "analysis",
            },
            {
              title: "3. Shortlist & Interview",
              body: "Filter candidates, apply HR overrides, inspect tailored interview questions, and export CSV shortlists.",
              tab: "shortlist",
            },
          ].map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => onNavigate(card.tab)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition hover:border-blue-300 hover:shadow-md"
            >
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                {card.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{card.body}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const shortlistRate = summary.total > 0 ? Math.round((summary.shortlisted / summary.total) * 100) : 0;

  const kpis = [
    {
      label: "Total Screened",
      value: summary.total,
      sub: `${requirements.skills.length} target skills`,
      icon: Users,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "Shortlisted",
      value: summary.shortlisted,
      sub: `${shortlistRate}% pass rate (cutoff ${config.cutoff})`,
      icon: CheckCircle2,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Needs Review",
      value: summary.review,
      sub: `Within ${config.band} pts of cutoff`,
      icon: Clock3,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      label: "Median Match Score",
      value: summary.median_score.toFixed(1),
      sub: `Avg skill match ${summary.avg_skill_match}%`,
      icon: TrendingUp,
      accent: "bg-indigo-50 text-indigo-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Executive HR Dashboard</h2>
          <p className="text-sm text-slate-500">
            Live overview of candidate pipeline, score distribution, and required skill supply.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate("upload")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <UploadCloud className="h-4 w-4 text-slate-500" />
            Add More Resumes
          </button>
          <button
            type="button"
            onClick={() => onNavigate("shortlist")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            Open Shortlist Pipeline
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {kpi.value}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 ${kpi.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Shortlisting Pipeline</h3>
              <p className="text-xs text-slate-500">Decision breakdown across uploaded resumes</p>
            </div>
          </div>
          <PipelineDonutChart
            shortlisted={summary.shortlisted}
            review={summary.review}
            rejected={summary.rejected}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Top Ranked Score Breakdown</h3>
              <p className="text-xs text-slate-500">
                Blended Final Score vs JD Fit and ML Shortlist Probability
              </p>
            </div>
          </div>
          <ScoreComparisonChart candidates={candidates} cutoff={config.cutoff} />
        </div>
      </div>

      {/* Skill Coverage & Top Candidates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Required Skills Supply</h3>
              <p className="text-xs text-slate-500">Pool coverage for each JD requirement</p>
            </div>
          </div>
          <SkillCoverageChart skillCoverage={summary.skill_coverage} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Leading Candidates</h3>
                <p className="text-xs text-slate-500">Click any candidate to inspect full AI report</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("details")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View all ({candidates.length})
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {candidates.slice(0, 5).map((c) => (
              <button
                key={c.idx}
                type="button"
                onClick={() => onInspectCandidate(c.idx)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-slate-50/80 px-2 rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                    #{c.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.candidate}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.experience.toFixed(1)} yrs · {c.education} ·{" "}
                      {c.skills_pct != null ? `${Math.round(c.skills_pct)}% skills` : "No JD skills"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {c.final_score.toFixed(1)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      ML {c.model_prob != null ? `${Math.round(c.model_prob * 100)}%` : "n/a"}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
