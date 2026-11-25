import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Sliders,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Sparkles,
} from "lucide-react";
import { FeatureImportanceChart } from "./Charts.jsx";
import { predictBatchCsv, predictSingleProfile } from "../api/client.js";

export default function AnalysisView({
  parsedResumes,
  onUpdateResumeField,
  candidates,
  modelInfo,
}) {
  const eduLevels = modelInfo?.education_levels || [
    "Unknown",
    "High School",
    "Bachelors",
    "Masters",
    "PhD",
  ];
  const hrDecisions = modelInfo?.hr_decisions || ["Auto", "Shortlist", "Reject"];
  const medians = modelInfo?.data_summary?.medians || {};

  // What-If Playground state
  const [probe, setProbe] = useState({
    years_experience: Math.round(medians.years_experience ?? 5),
    skills_match_score: Math.round(medians.skills_match_score ?? 74),
    education_level: "Bachelors",
    project_count: Math.round(medians.project_count ?? 10),
    resume_length: Math.round(medians.resume_length ?? 574),
    github_activity: Math.round(medians.github_activity ?? 321),
  });
  const [probeResult, setProbeResult] = useState(null);
  const [probeLoading, setProbeLoading] = useState(false);

  // Batch CSV scoring state
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    if (!modelInfo?.model_loaded) return;
    const timer = setTimeout(async () => {
      setProbeLoading(true);
      try {
        const res = await predictSingleProfile(probe);
        setProbeResult(res);
      } catch {
        setProbeResult(null);
      } finally {
        setProbeLoading(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [probe, modelInfo?.model_loaded]);

  const handleBatchCsv = async (file) => {
    if (!file) return;
    setBatchError("");
    setBatchLoading(true);
    try {
      const res = await predictBatchCsv(file);
      setBatchResult(res);
    } catch (err) {
      setBatchError(err.message);
      setBatchResult(null);
    } finally {
      setBatchLoading(false);
    }
  };

  const downloadBatchCsv = () => {
    if (!batchResult?.csv_content) return;
    const blob = new Blob([batchResult.csv_content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scored_candidates.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const candidateByIdx = new Map((candidates || []).map((c) => [c.idx, c]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AI Resume Analysis & ML Model Telemetry</h2>
        <p className="text-sm text-slate-500">
          Review and edit AI-extracted resume attributes, inspect model feature weights, and simulate predictions.
        </p>
      </div>

      {/* Editable Extracted Attributes Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Extracted Resume Intelligence (Editable)
            </h3>
            <p className="text-xs text-slate-500">
              Free-form PDF/DOCX extraction is heuristic. Edit any value below to immediately recalculate candidate scores.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {parsedResumes.length} resume{parsedResumes.length === 1 ? "" : "s"}
          </span>
        </div>

        {parsedResumes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
            No resumes parsed yet. Upload resumes or load the demo workspace in the Resume Upload tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Candidate</th>
                  <th className="py-2.5 px-2">Exp (yrs)</th>
                  <th className="py-2.5 px-2">Education</th>
                  <th className="py-2.5 px-2">Projects</th>
                  <th className="py-2.5 px-2">GitHub Activity</th>
                  <th className="py-2.5 px-2">HR Override</th>
                  <th className="py-2.5 pl-2">Extraction Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedResumes.map((r, idx) => {
                  const scored = candidateByIdx.get(idx);
                  return (
                    <tr key={`${r.filename}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => onUpdateResumeField(idx, "name", e.target.value)}
                          className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                        />
                        <div className="mt-0.5 text-[11px] text-slate-400 truncate max-w-44">
                          {r.filename} ({r.words} words)
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min="0"
                          max="40"
                          step="0.5"
                          value={r.experience}
                          onChange={(e) =>
                            onUpdateResumeField(idx, "experience", parseFloat(e.target.value) || 0)
                          }
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800"
                        />
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          src: {r.experience_source}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          value={r.education}
                          onChange={(e) => onUpdateResumeField(idx, "education", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                        >
                          {eduLevels.map((lv) => (
                            <option key={lv} value={lv}>
                              {lv}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="1"
                          value={r.projects}
                          onChange={(e) =>
                            onUpdateResumeField(idx, "projects", parseInt(e.target.value, 10) || 0)
                          }
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min="0"
                          max="842"
                          placeholder="Default"
                          value={r.github_activity ?? ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            onUpdateResumeField(idx, "github_activity", val);
                          }}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          value={r.hr_decision || "Auto"}
                          onChange={(e) => onUpdateResumeField(idx, "hr_decision", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                        >
                          {hrDecisions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 pl-2">
                        {scored?.flags?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {scored.flags.map((flag, fi) => (
                              <span
                                key={fi}
                                className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Clean extraction
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ML Model Performance & Feature Importance + What-If Simulator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-6 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Trained Gradient Boosting Classifier
                </h3>
                <p className="text-xs text-slate-500">
                  {modelInfo?.source || "Model status"} · scikit-learn{" "}
                  {modelInfo?.scikit_learn_version}
                </p>
              </div>
            </div>
            {modelInfo?.model_loaded ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                Active
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Unavailable
              </span>
            )}
          </div>

          {modelInfo?.notice && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{modelInfo.notice}</span>
            </div>
          )}

          {modelInfo?.metrics && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Hold-out evaluation (20% stratified split of {modelInfo.data_summary?.rows?.toLocaleString()}{" "}
                candidates)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(modelInfo.metrics).map(([metric, val]) => (
                  <div key={metric} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                    <p className="text-[11px] font-medium text-slate-500">{metric}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {(val * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Feature Importances
            </h4>
            <FeatureImportanceChart importances={modelInfo?.importances || []} />
          </div>
        </div>

        {/* Interactive What-If Simulator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">ML What-If Predictor</h3>
                <p className="text-xs text-slate-500">
                  Adjust candidate features to test live model shortlist probability
                </p>
              </div>
            </div>
            <Sparkles className="h-4 w-4 text-blue-500" />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-300">Predicted Shortlist Probability</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {probeResult ? `${(probeResult.shortlist_probability * 100).toFixed(1)}%` : "—"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  probeResult?.prediction === "Shortlisted"
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                    : "bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30"
                }`}
              >
                {probeLoading ? "Scoring..." : probeResult?.prediction || "Unavailable"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProbeSlider
              label="Years Experience"
              value={probe.years_experience}
              min={0}
              max={15}
              onChange={(v) => setProbe({ ...probe, years_experience: v })}
            />
            <ProbeSlider
              label="Skills Match %"
              value={probe.skills_match_score}
              min={0}
              max={100}
              onChange={(v) => setProbe({ ...probe, skills_match_score: v })}
            />
            <div>
              <label className="block text-xs font-medium text-slate-700">Education Level</label>
              <select
                value={probe.education_level}
                onChange={(e) => setProbe({ ...probe, education_level: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
              >
                {eduLevels
                  .filter((e) => e !== "Unknown")
                  .map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
              </select>
            </div>
            <ProbeSlider
              label="Project Count"
              value={probe.project_count}
              min={0}
              max={25}
              onChange={(v) => setProbe({ ...probe, project_count: v })}
            />
            <ProbeSlider
              label="Resume Length (words)"
              value={probe.resume_length}
              min={150}
              max={900}
              onChange={(v) => setProbe({ ...probe, resume_length: v })}
            />
            <ProbeSlider
              label="GitHub Activity"
              value={probe.github_activity}
              min={0}
              max={842}
              onChange={(v) => setProbe({ ...probe, github_activity: v })}
            />
          </div>
        </div>
      </div>

      {/* Batch Structured CSV Scoring */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Batch Score Structured CSV</h3>
            <p className="text-xs text-slate-500">
              Upload any CSV containing: {(modelInfo?.feature_columns || []).join(", ")}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            <Upload className="h-3.5 w-3.5" />
            {batchLoading ? "Scoring CSV..." : "Upload CSV to Score"}
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                if (e.target.files?.[0]) handleBatchCsv(e.target.files[0]);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        </div>

        {batchError && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">
            {batchError}
          </div>
        )}

        {batchResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap gap-6 text-xs">
                <span>
                  <strong>Rows scored:</strong> {batchResult.total_rows.toLocaleString()}
                </span>
                <span>
                  <strong>Predicted Yes:</strong> {batchResult.shortlisted_count.toLocaleString()} (
                  {(batchResult.shortlist_rate * 100).toFixed(1)}%)
                </span>
              </div>
              <button
                type="button"
                onClick={downloadBatchCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" /> Download Scored CSV
              </button>
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    {Object.keys(batchResult.preview[0] || {}).map((col) => (
                      <th key={col} className="border-b border-slate-200 px-3 py-2">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchResult.preview.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                          {val === null ? "—" : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProbeSlider({ label, value, min, max, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
      />
    </div>
  );
}
