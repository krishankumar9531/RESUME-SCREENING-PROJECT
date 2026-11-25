import { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Plus,
  X,
  Star,
  SlidersHorizontal,
  Trash2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

export default function UploadView({
  jdText,
  onChangeJdText,
  onUseSampleJd,
  onDetectJd,
  requirements,
  onChangeRequirements,
  parsedResumes,
  uploadErrors,
  uploading,
  onUploadFiles,
  onRemoveResume,
  onClearResumes,
  onLoadDemo,
  demoLoading,
  config,
  defaultConfig,
  onChangeConfig,
  modelInfo,
  onAddSkillToken,
  onNavigate,
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [skillInput, setSkillInput] = useState("");

  const eduOptions = modelInfo?.required_education_options || [
    "Any",
    "High School",
    "Bachelors",
    "Masters",
    "PhD",
  ];

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    const raw = skillInput.trim();
    if (!raw) return;
    await onAddSkillToken(raw);
    setSkillInput("");
  };

  const toggleMustHave = (skillId) => {
    const exists = requirements.must.includes(skillId);
    const nextMust = exists
      ? requirements.must.filter((s) => s !== skillId)
      : [...requirements.must, skillId];
    onChangeRequirements({ ...requirements, must: nextMust });
  };

  const removeSkill = (skillId) => {
    onChangeRequirements({
      ...requirements,
      skills: requirements.skills.filter((s) => s.id !== skillId),
      must: requirements.must.filter((s) => s !== skillId),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Job Description & Resume Upload</h2>
          <p className="text-sm text-slate-500">
            Configure job requirements, upload candidate resumes (PDF, DOCX, TXT), and tune scoring weights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {demoLoading ? "Loading..." : "Load Demo JD + 7 PDFs"}
          </button>
          {parsedResumes.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("shortlist")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              View Shortlist ({parsedResumes.length})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Job Description & Requirements */}
        <div className="space-y-5 xl:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">1. Job Description</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onUseSampleJd}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Use Sample JD
                </button>
                <button
                  type="button"
                  onClick={() => onDetectJd(jdText)}
                  className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Re-detect Requirements
                </button>
              </div>
            </div>

            <textarea
              value={jdText}
              onChange={(e) => onChangeJdText(e.target.value)}
              rows={7}
              placeholder="Paste the job description including required skills, years of experience, and education..."
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />

            <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Minimum Experience (years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={requirements.exp}
                    onChange={(e) =>
                      onChangeRequirements({
                        ...requirements,
                        exp: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Minimum Education
                  </label>
                  <select
                    value={requirements.edu_rank}
                    onChange={(e) =>
                      onChangeRequirements({
                        ...requirements,
                        edu_rank: Number(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    {eduOptions.map((opt, idx) => (
                      <option key={opt} value={idx}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Required Skills ({requirements.skills.length})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Click star to mark as Must-Have
                  </span>
                </div>

                <form onSubmit={handleAddSkill} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    placeholder="Add skill (e.g. Python, k8s, FastAPI)..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  {requirements.skills.length === 0 ? (
                    <p className="text-xs text-amber-600">
                      No skills detected yet. Paste a JD or add skills manually above.
                    </p>
                  ) : (
                    requirements.skills.map((skill) => {
                      const isMust = requirements.must.includes(skill.id);
                      return (
                        <span
                          key={skill.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition ${
                            isMust
                              ? "bg-amber-50 text-amber-900 ring-amber-400/50"
                              : "bg-slate-100 text-slate-700 ring-slate-200"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleMustHave(skill.id)}
                            title={isMust ? "Remove Must-Have" : "Mark as Must-Have"}
                            className={`${
                              isMust ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
                            }`}
                          >
                            <Star className={`h-3.5 w-3.5 ${isMust ? "fill-amber-400" : ""}`} />
                          </button>
                          {skill.label}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill.id)}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label={`Remove ${skill.label}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Resume Dropzone & Rules */}
        <div className="space-y-5 xl:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">2. Upload Candidate Resumes</h3>
              {parsedResumes.length > 0 && (
                <button
                  type="button"
                  onClick={onClearResumes}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                dragActive
                  ? "border-blue-500 bg-blue-50/70"
                  : "border-slate-200 bg-slate-50/60 hover:border-blue-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onUploadFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {uploading ? "Parsing resumes with PyMuPDF / python-docx..." : "Drop resumes here or click to browse"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Supports PDF, DOCX, TXT, and MD files (batch upload supported)
              </p>
            </div>

            {uploadErrors.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadErrors.map((err, i) => (
                  <div
                    key={`${err.filename}-${i}`}
                    className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      <strong>{err.filename}:</strong> {err.error}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {parsedResumes.length > 0 && (
              <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
                {parsedResumes.map((r, idx) => (
                  <div
                    key={`${r.filename}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">{r.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {r.filename} · {r.experience} yrs · {r.education} · {r.projects} projects
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveResume(idx)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 hover:text-rose-600"
                      aria-label={`Remove ${r.filename}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Screening Rules & Weights */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">3. Screening Rules & Weights</h3>
              </div>
              <button
                type="button"
                onClick={() => onChangeConfig(defaultConfig)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SliderControl
                label="Shortlist Cutoff"
                value={config.cutoff}
                min={0}
                max={100}
                onChange={(v) => onChangeConfig({ ...config, cutoff: v })}
              />
              <SliderControl
                label="Review Band"
                value={config.band}
                min={0}
                max={30}
                suffix=" pts"
                onChange={(v) => onChangeConfig({ ...config, band: v })}
              />
              <SliderControl
                label="Skills Weight"
                value={config.w_skill}
                min={0}
                max={100}
                onChange={(v) => onChangeConfig({ ...config, w_skill: v })}
              />
              <SliderControl
                label="Experience Weight"
                value={config.w_exp}
                min={0}
                max={100}
                onChange={(v) => onChangeConfig({ ...config, w_exp: v })}
              />
              <SliderControl
                label="Education Weight"
                value={config.w_edu}
                min={0}
                max={100}
                onChange={(v) => onChangeConfig({ ...config, w_edu: v })}
              />
              <SliderControl
                label="ML Model Influence"
                value={config.ml_weight}
                min={0}
                max={100}
                suffix="%"
                disabled={!modelInfo?.model_loaded}
                onChange={(v) => onChangeConfig({ ...config, ml_weight: v })}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.strict_must}
                  onChange={(e) => onChangeConfig({ ...config, strict_must: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Missing a must-have skill caps status at Review
              </label>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Default GitHub activity:</span>
                <input
                  type="number"
                  min={0}
                  max={842}
                  value={config.github_default}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      github_default: Math.max(0, Math.min(842, Number(e.target.value) || 0)),
                    })
                  }
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderControl({ label, value, min, max, onChange, suffix = "", disabled = false }) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900 tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
      />
    </div>
  );
}
