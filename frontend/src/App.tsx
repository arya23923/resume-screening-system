import { useState, useEffect, useCallback, useRef } from "react";
import {
  api,
  StoredResume,
  ResumeMatch,
  AISummary,
  ResumeAnalysis,
} from "./api/apiClient";
import "./App.css";

type View = "dashboard" | "resumes" | "match" | "ai-summary";

interface MatchResponse {
  job_title: string;
  matches: ResumeMatch[];
  total_found: number;
}

// ───────────────── Helpers ─────────────────
const scoreColor = (s: number) =>
  s >= 0.75
    ? "var(--c-green)"
    : s >= 0.55
    ? "var(--c-blue)"
    : s >= 0.35
    ? "var(--c-amber)"
    : "var(--c-red)";

const fitCls = (f: string) =>
  ({ Excellent: "tag-green", Good: "tag-blue", Fair: "tag-amber" }[
    f
  ] || "tag-gray");

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "CV"
  );
}

function avatarColor(id: string) {
  const c = [
    "#6366f1",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#ef4444",
  ];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % c.length;
  return c[h];
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function qualityColor(score: number) {
  if (score >= 8) return "var(--c-green)";
  if (score >= 6) return "var(--c-blue)";
  if (score >= 4) return "var(--c-amber)";
  return "var(--c-red)";
}

// ───────────────── Login ─────────────────
function Login({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setErr("");
    try {
      await api.login(u, p);
      onLogin();
    } catch {
      setErr("Incorrect username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <h1>RecruitAI</h1>
        <p>HR Resume Screening Platform</p>

        <input value={u} onChange={(e) => setU(e.target.value)} />
        <input
          type="password"
          value={p}
          onChange={(e) => setP(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {err && <div className="field-error">{err}</div>}

        <button onClick={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </div>
  );
}

// ───────────────── Sidebar ─────────────────
function Sidebar({
  view,
  setView,
  resumeCount,
  onLogout,
  theme,
  setTheme,
}: {
  view: View;
  setView: (v: View) => void;
  resumeCount: number;
  onLogout: () => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}) {
  const nav = [
    { id: "dashboard" as View, label: "Dashboard" },
    { id: "resumes" as View, label: "Resumes", badge: resumeCount },
    { id: "match" as View, label: "Find Candidates" },
    { id: "ai-summary" as View, label: "AI Analysis" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-name">RecruitAI</div>

      {nav.map((n) => (
        <button
          key={n.id}
          className={view === n.id ? "nav-active" : ""}
          onClick={() => setView(n.id)}
        >
          {n.label} {n.badge ? `(${n.badge})` : ""}
        </button>
      ))}

      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? "🌙 Dark Mode" : "☀ Light Mode"}
      </button>

      <button onClick={onLogout}>Sign out</button>
    </aside>
  );
}

// ───────────────── Dashboard ─────────────────
function Dashboard({
  setView,
  setResumeTab,
  resumeCount,
  stats,
}: {
  setView: (v: View) => void;
  setResumeTab: (t: "all" | "shortlisted") => void;
  resumeCount: number;
  stats: any;
}) {
  const lib = api.getResumeLibrary();

  return (
    <div className="page">
      <h2>Dashboard</h2>

      <div className="dash-stats">
        <div onClick={() => { setResumeTab("all"); setView("resumes"); }}>
          Resumes: {resumeCount}
        </div>

        <div onClick={() => setView("match")}>
          Jobs Indexed: {stats?.jobs_indexed ?? 0}
        </div>

        <div>
          Reviewed: 0
        </div>

        <div onClick={() => { setResumeTab("shortlisted"); setView("resumes"); }}>
          Shortlisted: {lib.filter((r) => r.shortlisted).length}
        </div>
      </div>
    </div>
  );
}

// ───────────────── Resume Library ─────────────────
function ResumesView({
  onCountChange,
  initialTab = "all",
}: {
  onCountChange: () => void;
  initialTab?: "all" | "shortlisted";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [lib, setLib] = useState<StoredResume[]>(api.getResumeLibrary());
  const [selected, setSelected] = useState<StoredResume | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "shortlisted">(initialTab);

  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setLib(api.getResumeLibrary());
    onCountChange();
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      const res = await api.uploadResume(file);

      api.addToLibrary({
        id: res.id,
        filename: file.name,
        name: file.name.replace(/\.(pdf|txt|doc|docx)$/i, ""),
        category: "Uploaded",
        uploadedAt: new Date().toISOString(),
        preview: res.preview,
        fullText: res.raw_text,
        metadata: {},
      });

      setMsg("Uploaded successfully");
      setFile(null);
      refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  };

  const filtered = lib.filter((r) => {
    if (tab === "shortlisted" && !r.shortlisted) return false;

    return (
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.filename.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="page">
      <h2>Resumes</h2>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        hidden
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button onClick={() => inputRef.current?.click()}>
        Choose Resume
      </button>

      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? "Uploading..." : "Upload"}
      </button>

      {msg && <div>{msg}</div>}
      {err && <div>{err}</div>}

      <button onClick={() => setTab("all")}>All</button>
      <button onClick={() => setTab("shortlisted")}>Shortlisted</button>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search"
      />

      {filtered.map((r) => (
        <div key={r.id} onClick={() => setSelected(r)}>
          {r.name} - {timeAgo(r.uploadedAt)}
        </div>
      ))}

      {selected && (
        <div>
          <h3>{selected.name}</h3>
          <pre>{selected.fullText || selected.preview}</pre>
        </div>
      )}
    </div>
  );
}

// ───────────────── AI Analysis ─────────────────
function AISummaryView() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.analyzeResume(rawText);
      setAnalysis(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h2>AI Resume Analysis</h2>

      {!analysis ? (
        <>
          <textarea
            rows={10}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <button onClick={run} disabled={loading}>
            {loading ? "Analysing..." : "Analyse"}
          </button>
        </>
      ) : (
        <div>
          <h3>{analysis.candidate_name}</h3>
          <p>{analysis.summary}</p>
          <p>
            Score:{" "}
            <span style={{ color: qualityColor(analysis.resume_quality.score) }}>
              {analysis.resume_quality.score}/10
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// ───────────────── Root ─────────────────
export default function App() {
  const [authed, setAuthed] = useState(
    !!localStorage.getItem("auth_token")
  );
  const [view, setView] = useState<View>("dashboard");
  const [resumeTab, setResumeTab] = useState<"all" | "shortlisted">("all");
  const [resumeCount, setResumeCount] = useState(
    api.getResumeLibrary().length
  );
  const [stats, setStats] = useState<any>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("theme") as any) || "light"
  );

  const refreshCount = useCallback(() => {
    setResumeCount(api.getResumeLibrary().length);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (authed) api.getStats().then(setStats).catch(() => {});
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const logout = () => {
    api.clearToken();
    setAuthed(false);
  };

  return (
    <div className="shell">
      <Sidebar
        view={view}
        setView={setView}
        resumeCount={resumeCount}
        onLogout={logout}
        theme={theme}
        setTheme={setTheme}
      />

      <main className="content">
        {view === "dashboard" && (
          <Dashboard
            setView={setView}
            setResumeTab={setResumeTab}
            resumeCount={resumeCount}
            stats={stats}
          />
        )}

        {view === "resumes" && (
          <ResumesView
            onCountChange={refreshCount}
            initialTab={resumeTab}
          />
        )}

        {view === "ai-summary" && <AISummaryView />}
      </main>
    </div>
  );
}