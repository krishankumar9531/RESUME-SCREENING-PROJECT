import { useState } from "react";
import {
  Sparkles,
  Mail,
  Lock,
  User,
  Briefcase,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { loginHr, registerHr } from "../api/client.js";

export default function LoginView({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [role, setRole] = useState("HR Recruiter");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await loginHr(email, password)
          : await registerHr({ name, email, password, role });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setMode("login");
    setEmail("hr@talentlens.ai");
    setPassword("Admin@123");
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-12">
      {/* Left Showcase Panel */}
      <div className="relative hidden overflow-hidden bg-slate-900 p-10 text-white lg:col-span-5 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">TalentLens AI</p>
            <p className="text-xs text-slate-400">Enterprise HR Screening Suite</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300 ring-1 ring-blue-400/25">
            <ShieldCheck className="h-3.5 w-3.5" /> HR Recruiter Portal
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Intelligent candidate shortlisting, backed by explainable ML.
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Sign in to upload resumes, configure role requirements, inspect Gradient Boosting
            predictions, and manage candidate shortlists securely.
          </p>

          <ul className="space-y-3 pt-2 text-sm text-slate-200">
            {[
              "Hybrid JD skill matching + scikit-learn ML probability",
              "PDF, DOCX & TXT batch parsing with inline field editing",
              "Interview question generation & one-click CSV exports",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          Decision-support platform · Protected HR workspace
        </p>
      </div>

      {/* Right Auth Form */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:col-span-7 lg:px-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">TalentLens AI</p>
              <p className="text-xs text-slate-500">HR Recruiter Portal</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                  mode === "login"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                HR Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                  mode === "register"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Create HR Account
              </button>
            </div>

            <div className="mt-6">
              <h2 className="text-xl font-bold text-slate-900">
                {mode === "login" ? "Welcome back, Recruiter" : "Create your HR account"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {mode === "login"
                  ? "Enter your HR credentials to access the screening dashboard."
                  : "Register a recruiter account to manage job openings and shortlists."}
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === "register" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                    <div className="relative mt-1.5">
                      <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Priya Sharma"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">HR Role / Title</label>
                    <div className="relative mt-1.5">
                      <Briefcase className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Talent Acquisition Lead"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Work Email</label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hr@talentlens.ai"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-10 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                  ? "Sign In to HR Dashboard"
                  : "Create Account & Sign In"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Demo Account Card */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                  Demo HR Credentials
                </div>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-600 ring-1 ring-slate-200 hover:bg-blue-50"
                >
                  Auto-fill
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Email: <code className="font-semibold text-slate-700">hr@talentlens.ai</code> ·
                Password: <code className="font-semibold text-slate-700">Admin@123</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
