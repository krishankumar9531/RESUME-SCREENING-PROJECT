import {
  LayoutDashboard,
  UploadCloud,
  BrainCircuit,
  ListChecks,
  UserCheck,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "HR Dashboard", icon: LayoutDashboard, desc: "Pipeline KPIs & charts" },
  { id: "upload", label: "Resume Upload", icon: UploadCloud, desc: "JD setup & file parsing" },
  { id: "analysis", label: "AI Resume Analysis", icon: BrainCircuit, desc: "Extraction & ML insights" },
  { id: "shortlist", label: "Candidate Shortlisting", icon: ListChecks, desc: "Filter, override & export" },
  { id: "details", label: "Candidate Details", icon: UserCheck, desc: "Rankings & deep reports" },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  summary,
  parsedCount,
  modelInfo,
  cutoff,
  user,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) {
  const badgeFor = (id) => {
    if (id === "upload" && parsedCount > 0) return `${parsedCount}`;
    if (id === "shortlist" && summary?.shortlisted > 0) return `${summary.shortlisted}`;
    if (id === "details" && summary?.total > 0) return `${summary.total}`;
    return null;
  };

  const content = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">TalentLens AI</p>
            <p className="text-[11px] font-medium text-slate-400">HR Screening Suite</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Workspace
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const badge = badgeFor(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all ${
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-4.5 w-4.5 shrink-0 ${
                    active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{item.label}</div>
                  <div
                    className={`truncate text-[11px] ${
                      active ? "text-blue-100" : "text-slate-500 group-hover:text-slate-400"
                    }`}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>
              {badge && (
                <span
                  className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-800 p-4">
        <div className="rounded-xl bg-slate-800/70 p-3.5 ring-1 ring-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">ML Engine</span>
            {modelInfo?.model_loaded ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Rule-only
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-[11px] text-slate-400">
            {modelInfo?.source || "Connecting to FastAPI..."}
          </p>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-700/70 pt-2 text-[11px] text-slate-400">
            <span>Cutoff threshold</span>
            <span className="font-semibold text-slate-200">{cutoff} / 100</span>
          </div>
        </div>

        {user && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/40 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("") || "HR"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                <p className="truncate text-[10px] text-slate-400">{user.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-68">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-72 max-w-[85vw]">{content}</div>
        </div>
      )}
    </>
  );
}
