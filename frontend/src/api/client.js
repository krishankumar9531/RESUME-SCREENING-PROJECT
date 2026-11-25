const API_BASE = "";
let onUnauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorizedHandler = fn;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/") && onUnauthorizedHandler) {
      onUnauthorizedHandler();
    }
    let detail = `Request failed (${response.status})`;
    try {
      const err = await response.json();
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(detail);
  }
  return response;
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Auth check failed (${res.status})`);
  const data = await res.json();
  return data.user;
}

export async function loginHr(email, password) {
  const res = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function registerHr(payload) {
  const res = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function logoutHr() {
  const res = await request("/api/auth/logout", { method: "POST" });
  return res.json();
}

export async function fetchModelInfo() {
  const res = await request("/api/model/info");
  return res.json();
}

export async function parseJobDescription(jdText) {
  const res = await request("/api/jd/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText }),
  });
  return res.json();
}

export async function canonicalizeSkills(skills) {
  const res = await request("/api/jd/canonicalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skills),
  });
  return res.json();
}

export async function parseResumeFiles(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await request("/api/resumes/parse", {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function loadDemoWorkspace() {
  const res = await request("/api/demo/load");
  return res.json();
}

export async function screenCandidates(payload) {
  const res = await request("/api/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function predictSingleProfile(profile) {
  const res = await request("/api/model/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return res.json();
}

export async function predictBatchCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await request("/api/model/batch-csv", {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function downloadScreeningCsv(payload, shortlistOnly = false) {
  const res = await request("/api/export/csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, shortlist_only: shortlistOnly }),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = shortlistOnly ? "shortlisted_candidates.csv" : "resume_screening_report.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
