import { useMemo, useState } from "react";
import { Search, Download, ArrowUpDown, ExternalLink, Filter } from "lucide-react";
import { StatusBadge, getStatusStyle } from "./StatusBadge.jsx";

export default function ShortlistView({
  candidates,
  summary,
  config,
  onUpdateResumeField,
  onInspectCandidate,
  onExportCsv,
}) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [eduFilter, setEduFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("final_score");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (candidates || []).filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (eduFilter !== "All" && c.education !== eduFilter) return false;
      if (q) {
        const haystack = [
          c.candidate,
          c.file,
          c.email,
          c.education,
          ...(c.matched || []).map((s) => s.label),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "rule_score") return (b.rule_score ?? -1) - (a.rule_score ?? -1);
      if (sortBy === "model_prob") return (b.model_prob ?? -1) - (a.model_prob ?? -1);
      if (sortBy === "experience") return b.experience - a.experience;
      if (sortBy === "skills_pct") return (b.skills_pct ?? -1) - (a.skills_pct ?? -1);
      return b.final_score - a.final_score;
    });
  }, [candidates, statusFilter, eduFilter, search, sortBy]);

  if (!candidates || candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-slate-800">No candidates to shortlist yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Upload resumes or load the demo workspace in Resume Upload to generate the shortlist.
        </p>
      </div>
    );
  }

  const tabs = [
    { label: "All", count: summary.total },
    { label: "Shortlisted", count: summary.shortlisted },
    { label: "Review", count: summary.review },
    { label: "Not shortlisted", count: summary.rejected },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Candidate Shortlisting Pipeline</h2>
          <p className="text-sm text-slate-500">
            Filter candidates, apply HR overrides, and export shortlisted talent reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onExportCsv(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Full Report CSV
          </button>
          <button
            type="button"
            onClick={() => onExportCsv(true)}
            disabled={summary.shortlisted === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Shortlisted Only ({summary.shortlisted})
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setStatusFilter(tab.label)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === tab.label
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === tab.label ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, skill, email..."
                className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={eduFilter}
                onChange={(e) => setEduFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="All">All Education</option>
                <option value="PhD">PhD</option>
                <option value="Masters">Masters</option>
                <option value="Bachelors">Bachelors</option>
                <option value="High School">High School</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="final_score">Sort: Final Score</option>
                <option value="rule_score">Sort: JD Fit</option>
                <option value="model_prob">Sort: ML Probability</option>
                <option value="skills_pct">Sort: Skill Match %</option>
                <option value="experience">Sort: Experience</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Cards List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No candidates match the current filters.
          </div>
        ) : (
          filtered.map((c) => {
            const style = getStatusStyle(c.status);
            const barWidth = Math.max(0, Math.min(100, c.final_score));
            return (
              <div
                key={c.idx}
                className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/70 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-start gap-4 min-w-0 lg:w-80">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                    #{c.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onInspectCandidate(c.idx)}
                        className="truncate text-sm font-bold text-slate-900 hover:text-blue-600"
                      >
                        {c.candidate}
                      </button>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {c.email || c.file}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {c.experience.toFixed(1)} yrs exp · {c.education} · {c.projects} projects
                    </p>
                  </div>
                </div>

                {/* Score Meter */}
                <div className="flex-1 max-w-md space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 tabular-nums">
                      Score {c.final_score.toFixed(1)}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>JD Fit: {c.rule_score != null ? `${Math.round(c.rule_score)}%` : "n/a"}</span>
                      <span>ML: {c.model_prob != null ? `${Math.round(c.model_prob * 100)}%` : "n/a"}</span>
                      <span>
                        Skills:{" "}
                        {c.skills_pct != null
                          ? `${c.matched.length}/${c.matched.length + c.missing.length}`
                          : "n/a"}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div
                      className="absolute -top-1 -bottom-1 w-0.5 bg-slate-800"
                      style={{ left: `${Math.min(100, Math.max(0, config.cutoff))}%` }}
                      title={`Cutoff: ${config.cutoff}`}
                    />
                  </div>
                  {c.must_missing.length > 0 && (
                    <p className="text-[11px] font-medium text-amber-700">
                      Missing must-have: {c.must_missing.map((s) => s.label).join(", ")}
                    </p>
                  )}
                </div>

                {/* HR Override & Inspect */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1">
                    {["Auto", "Shortlist", "Reject"].map((decision) => {
                      const active = c.hr_decision === decision;
                      return (
                        <button
                          key={decision}
                          type="button"
                          onClick={() => onUpdateResumeField(c.idx, "hr_decision", decision)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            active
                              ? decision === "Shortlist"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : decision === "Reject"
                                ? "bg-rose-600 text-white shadow-xs"
                                : "bg-white text-slate-900 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {decision}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => onInspectCandidate(c.idx)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-600"
                  >
                    Report <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
