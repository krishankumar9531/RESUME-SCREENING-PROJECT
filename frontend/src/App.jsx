import { useCallback, useEffect, useState } from "react";
import { Menu, Sparkles, RefreshCw, LogOut } from "lucide-react";
import {
  canonicalizeSkills,
  downloadScreeningCsv,
  fetchCurrentUser,
  fetchModelInfo,
  loadDemoWorkspace,
  logoutHr,
  parseJobDescription,
  parseResumeFiles,
  screenCandidates,
  setUnauthorizedHandler,
} from "./api/client.js";
import LoginView from "./components/LoginView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DashboardView from "./components/DashboardView.jsx";
import UploadView from "./components/UploadView.jsx";
import AnalysisView from "./components/AnalysisView.jsx";
import ShortlistView from "./components/ShortlistView.jsx";
import CandidateDetailsView from "./components/CandidateDetailsView.jsx";

const DEFAULT_CONFIG = {
  cutoff: 60,
  band: 10,
  strict_must: true,
  w_skill: 50,
  w_exp: 30,
  w_edu: 20,
  ml_weight: 30,
  github_default: 321,
};

const EMPTY_REQUIREMENTS = {
  skills: [],
  must: [],
  exp: 0,
  edu_rank: 0,
};

const EMPTY_SCREENING_RESULT = {
  candidates: [],
  summary: {
    total: 0,
    shortlisted: 0,
    review: 0,
    rejected: 0,
    median_score: 0,
    avg_score: 0,
    avg_skill_match: 0,
    skill_coverage: [],
  },
};

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [modelInfo, setModelInfo] = useState(null);
  const [jdText, setJdText] = useState("");
  const [requirements, setRequirements] = useState(EMPTY_REQUIREMENTS);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [parsedResumes, setParsedResumes] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const [screeningResult, setScreeningResult] = useState(EMPTY_SCREENING_RESULT);
  const [scoring, setScoring] = useState(false);
  const [apiError, setApiError] = useState("");
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);

  const resetSessionState = useCallback(() => {
    setUser(null);
    setActiveTab("dashboard");
    setMobileOpen(false);
    setModelInfo(null);
    setJdText("");
    setRequirements(EMPTY_REQUIREMENTS);
    setConfig(DEFAULT_CONFIG);
    setParsedResumes([]);
    setUploadErrors([]);
    setScreeningResult(EMPTY_SCREENING_RESULT);
    setApiError("");
    setSelectedCandidateIdx(0);
  }, []);

  // Check HR session on mount
  useEffect(() => {
    setUnauthorizedHandler(resetSessionState);
    fetchCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthChecking(false));
    return () => setUnauthorizedHandler(null);
  }, [resetSessionState]);

  // Load model metadata once authenticated
  useEffect(() => {
    if (!user) return;
    fetchModelInfo()
      .then((info) => {
        setModelInfo(info);
        if (info.default_config) {
          setConfig({
            ...info.default_config,
            ml_weight: info.model_loaded ? info.default_config.ml_weight : 0,
          });
        }
      })
      .catch((err) => setApiError(err.message));
  }, [user]);

  // Re-score whenever resumes, requirements, or config change
  useEffect(() => {
    if (!user || parsedResumes.length === 0) {
      setScreeningResult(EMPTY_SCREENING_RESULT);
      return;
    }

    const timer = setTimeout(async () => {
      setScoring(true);
      setApiError("");
      try {
        const res = await screenCandidates({
          candidates: parsedResumes,
          requirements: {
            skills: requirements.skills.map((s) => s.id),
            must: requirements.must,
            exp: requirements.exp,
            edu_rank: requirements.edu_rank,
          },
          config,
        });
        setScreeningResult(res);
      } catch (err) {
        setApiError(err.message);
      } finally {
        setScoring(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [parsedResumes, requirements, config]);

  const handleDetectJd = useCallback(async (text) => {
    setApiError("");
    try {
      const parsed = await parseJobDescription(text);
      setRequirements((prev) => ({
        skills: parsed.skills || [],
        must: prev.must.filter((m) => (parsed.skills || []).some((s) => s.id === m)),
        exp: parsed.experience ?? 0,
        edu_rank: parsed.edu_rank ?? 0,
      }));
    } catch (err) {
      setApiError(err.message);
    }
  }, []);

  const handleJdTextChange = (nextText) => {
    setJdText(nextText);
    if (!nextText.trim()) {
      setRequirements(EMPTY_REQUIREMENTS);
    }
  };

  // Auto-detect JD requirements after brief typing pause
  useEffect(() => {
    if (!user || !jdText.trim()) return;
    const timer = setTimeout(() => {
      handleDetectJd(jdText);
    }, 450);
    return () => clearTimeout(timer);
  }, [user, jdText, handleDetectJd]);

  const handleUseSampleJd = async () => {
    const sample = modelInfo?.sample_jd || "";
    if (!sample) return;
    setJdText(sample);
    await handleDetectJd(sample);
  };

  const handleAddSkillToken = async (rawToken) => {
    const tokens = rawToken
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    try {
      const res = await canonicalizeSkills(tokens);
      setRequirements((prev) => {
        const existing = new Set(prev.skills.map((s) => s.id));
        const added = (res.skills || []).filter((s) => !existing.has(s.id));
        return { ...prev, skills: [...prev.skills, ...added] };
      });
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleUploadFiles = async (files) => {
    setUploading(true);
    setApiError("");
    try {
      const res = await parseResumeFiles(files);
      setUploadErrors(res.failed || []);
      if (res.parsed?.length) {
        setParsedResumes((prev) => [...prev, ...res.parsed]);
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setApiError("");
    try {
      const demo = await loadDemoWorkspace();
      setJdText(demo.jd_text);
      setRequirements({
        skills: demo.requirements.skills || [],
        must: demo.requirements.must || [],
        exp: demo.requirements.exp ?? 0,
        edu_rank: demo.requirements.edu_rank ?? 0,
      });
      setParsedResumes(demo.parsed || []);
      setUploadErrors(demo.failed || []);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleUpdateResumeField = (idx, field, value) => {
    setParsedResumes((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveResume = (idx) => {
    setParsedResumes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    window.scrollTo(0, 0);
  };

  const handleInspectCandidate = (idx) => {
    setSelectedCandidateIdx(idx);
    handleSelectTab("details");
  };

  const handleExportCsv = async (shortlistOnly) => {
    try {
      await downloadScreeningCsv(
        {
          candidates: parsedResumes,
          requirements: {
            skills: requirements.skills.map((s) => s.id),
            must: requirements.must,
            exp: requirements.exp,
            edu_rank: requirements.edu_rank,
          },
          config,
        },
        shortlistOnly
      );
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutHr();
    } catch {
      // ignore network errors on logout
    }
    resetSessionState();
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          Verifying HR session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onAuthenticated={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        summary={screeningResult.summary}
        parsedCount={parsedResumes.length}
        modelInfo={modelInfo}
        cutoff={config.cutoff}
        user={user}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="lg:pl-68">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
                  Resume Screening & Candidate Shortlisting
                </h1>
                <p className="hidden text-xs text-slate-500 sm:block">
                  Hybrid JD Fit + scikit-learn Gradient Boosting decision support
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {scoring && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Scoring...
                </span>
              )}
              <button
                type="button"
                onClick={handleLoadDemo}
                disabled={demoLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                {demoLoading ? "Loading..." : "Load Demo"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {apiError && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              Backend error: {apiError}
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardView
              summary={screeningResult.summary}
              candidates={screeningResult.candidates}
              config={config}
              requirements={requirements}
              onNavigate={handleSelectTab}
              onLoadDemo={handleLoadDemo}
              demoLoading={demoLoading}
              onInspectCandidate={handleInspectCandidate}
            />
          )}

          {activeTab === "upload" && (
            <UploadView
              jdText={jdText}
              onChangeJdText={handleJdTextChange}
              onUseSampleJd={handleUseSampleJd}
              onDetectJd={handleDetectJd}
              requirements={requirements}
              onChangeRequirements={setRequirements}
              parsedResumes={parsedResumes}
              uploadErrors={uploadErrors}
              uploading={uploading}
              onUploadFiles={handleUploadFiles}
              onRemoveResume={handleRemoveResume}
              onClearResumes={() => {
                setParsedResumes([]);
                setUploadErrors([]);
              }}
              onLoadDemo={handleLoadDemo}
              demoLoading={demoLoading}
              config={config}
              defaultConfig={modelInfo?.default_config || DEFAULT_CONFIG}
              onChangeConfig={setConfig}
              modelInfo={modelInfo}
              onAddSkillToken={handleAddSkillToken}
              onNavigate={handleSelectTab}
            />
          )}

          {activeTab === "analysis" && (
            <AnalysisView
              parsedResumes={parsedResumes}
              onUpdateResumeField={handleUpdateResumeField}
              candidates={screeningResult.candidates}
              modelInfo={modelInfo}
            />
          )}

          {activeTab === "shortlist" && (
            <ShortlistView
              candidates={screeningResult.candidates}
              summary={screeningResult.summary}
              config={config}
              onUpdateResumeField={handleUpdateResumeField}
              onInspectCandidate={handleInspectCandidate}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === "details" && (
            <CandidateDetailsView
              candidates={screeningResult.candidates}
              selectedIdx={selectedCandidateIdx}
              onSelectCandidate={setSelectedCandidateIdx}
              onUpdateResumeField={handleUpdateResumeField}
              config={config}
            />
          )}
        </main>
      </div>
    </div>
  );
}
