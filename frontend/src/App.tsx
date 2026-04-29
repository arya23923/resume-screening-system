import { useState, useEffect, useCallback, useRef } from "react";
import { api, StoredResume, ResumeMatch, AISummary, ResumeAnalysis } from "./api/apiClient";
import "./App.css";

// ── Types ──────────────────────────────────────────────────────────────────────
type View = "dashboard" | "resumes" | "match" | "ai-summary";

interface MatchResponse { job_title: string; matches: ResumeMatch[]; total_found: number; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => s >= 0.75 ? "var(--c-green)" : s >= 0.55 ? "var(--c-blue)" : s >= 0.35 ? "var(--c-amber)" : "var(--c-red)";
const recoCls = (r: string) => ({ "Strong Match": "tag-green", "Good Match": "tag-blue", "Partial Match": "tag-amber", "Poor Match": "tag-red" }[r] || "tag-gray");
const fitCls  = (f: string) => ({ "Excellent": "tag-green", "Good": "tag-blue", "Fair": "tag-amber" }[f] || "tag-gray");

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "CV";
}

function avatarColor(id: string) {
  const colors = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % colors.length;
  return colors[h];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Login ──────────────────────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setErr("");
    try { await api.login(u, p); onLogin(); }
    catch { setErr("Incorrect username or password"); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-icon">R</div>
          <h1>RecruitAI</h1>
          <p>HR Resume Screening Platform</p>
        </div>
        <div className="login-fields">
          <div className="field-group">
            <label>Username</label>
            <input value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {err && <div className="field-error">{err}</div>}
          <button className="btn-primary w-full" onClick={submit} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="login-hint">admin / admin123</p>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, resumeCount, onLogout }: {
  view: View; setView: (v: View) => void; resumeCount: number; onLogout: () => void;
}) {
  const nav = [
    { id: "dashboard" as View,   label: "Dashboard",     icon: <IconDash /> },
    { id: "resumes" as View,     label: "Resumes",       icon: <IconResumes />, badge: resumeCount || undefined },
    { id: "match" as View,       label: "Find Candidates", icon: <IconMatch /> },
    { id: "ai-summary" as View,  label: "AI Analysis",   icon: <IconAI /> },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="brand-dot" />
          <span className="brand-name">RecruitAI</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(n => (
            <button key={n.id} className={`nav-item ${view === n.id ? "nav-active" : ""}`} onClick={() => setView(n.id)}>
              <span className="nav-ic">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
      </div>
      <button className="sidebar-logout" onClick={onLogout}>
        <IconLogout /> Sign out
      </button>
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ setView, resumeCount, stats }: { setView: (v: View) => void; resumeCount: number; stats: any }) {
  const lib = api.getResumeLibrary();
  const recent = lib.slice(0, 4);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Dashboard</h2>
        <p>Overview of your recruitment pipeline</p>
      </div>

      <div className="dash-stats">
        <div className="dstat" onClick={() => setView("resumes")} style={{ cursor: "pointer" }}>
          <div className="dstat-num">{resumeCount}</div>
          <div className="dstat-label">Resumes uploaded</div>
        </div>
        <div className="dstat" onClick={() => setView("match")} style={{ cursor: "pointer" }}>
          <div className="dstat-num">{stats?.jobs_indexed ?? 0}</div>
          <div className="dstat-label">Jobs indexed</div>
        </div>
        <div className="dstat">
          <div className="dstat-num">{resumeCount > 0 ? Math.round(resumeCount * 0.68) : 0}</div>
          <div className="dstat-label">Candidates reviewed</div>
        </div>
        <div className="dstat">
          <div className="dstat-num">{resumeCount > 0 ? Math.round(resumeCount * 0.23) : 0}</div>
          <div className="dstat-label">Shortlisted</div>
        </div>
      </div>

      <div className="dash-actions">
        <button className="action-card" onClick={() => setView("resumes")}>
          <div className="action-icon ac-blue"><IconResumes /></div>
          <div className="action-text">
            <div className="action-title">Upload & View Resumes</div>
            <div className="action-sub">Upload PDFs, browse your resume library</div>
          </div>
          <IconChevron />
        </button>
        <button className="action-card" onClick={() => setView("match")}>
          <div className="action-icon ac-purple"><IconMatch /></div>
          <div className="action-text">
            <div className="action-title">Find Candidates</div>
            <div className="action-sub">Match a job description to top candidates</div>
          </div>
          <IconChevron />
        </button>
        <button className="action-card" onClick={() => setView("ai-summary")}>
          <div className="action-icon ac-green"><IconAI /></div>
          <div className="action-text">
            <div className="action-title">AI Resume Analysis</div>
            <div className="action-sub">Upload a resume — get skills, roles & insights</div>
          </div>
          <IconChevron />
        </button>
      </div>

      {recent.length > 0 && (
        <div className="dash-recent">
          <div className="section-title">Recently uploaded</div>
          <div className="recent-list">
            {recent.map(r => (
              <div key={r.id} className="recent-row" onClick={() => setView("resumes")}>
                <div className="avatar" style={{ background: avatarColor(r.id) }}>{initials(r.name)}</div>
                <div className="recent-info">
                  <div className="recent-name">{r.name || r.filename}</div>
                  <div className="recent-meta">{r.category} · {timeAgo(r.uploadedAt)}</div>
                </div>
                <span className="recent-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resume Library ─────────────────────────────────────────────────────────────
function ResumesView({ onCountChange }: { onCountChange: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [lib, setLib] = useState<StoredResume[]>(api.getResumeLibrary());
  const [selected, setSelected] = useState<StoredResume | null>(null);
  const [search, setSearch] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshLib = () => { const l = api.getResumeLibrary(); setLib(l); onCountChange(); };

  const handleFile = (f: File) => {
    if (!f.type.includes("pdf") && !f.name.endsWith(".txt")) { setErr("Only PDF or TXT files"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setText((e.target?.result as string) || "");
    reader.readAsText(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(""); setErr("");
    try {
      const res = await api.uploadResume(file);
      const id = res.id || `resume_${Date.now()}`;
      const nameGuess = file.name.replace(/\.(pdf|txt)$/i, "").replace(/[-_]/g, " ");
      api.addToLibrary({
        id, filename: file.name, name: nameGuess, category: "Uploaded",
        uploadedAt: new Date().toISOString(), preview: text.slice(0, 600), metadata: {},
      });
      setMsg("Resume uploaded and indexed successfully.");
      setFile(null); setText("");
      refreshLib();
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally { setUploading(false); }
  };

  const handleDelete = (id: string) => {
    api.removeFromLibrary(id);
    if (selected?.id === id) setSelected(null);
    refreshLib();
  };

  const handleBulk = async () => {
    setBulkMsg("Indexing…");
    try {
      const res = await api.bulkIngestResumes();
      setBulkMsg(`Done — ${res.count} resumes indexed.`);
    } catch (e: any) { setBulkMsg(e.message || "Failed"); }
  };

  const filtered = lib.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.filename.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-head">
        <h2>Resumes</h2>
        <p>Upload and manage your candidate resume library</p>
      </div>

      {/* Upload strip */}
      <div className="upload-strip">
        <div
          className={`dropzone ${file ? "dz-active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.txt" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {file
            ? <><span className="dz-icon">📄</span><span className="dz-name">{file.name}</span><span className="dz-hint">Click to change</span></>
            : <><span className="dz-icon">↑</span><span className="dz-name">Drop a resume here or click to browse</span><span className="dz-hint">PDF or TXT</span></>
          }
        </div>
        <div className="upload-actions">
          {err && <div className="field-error">{err}</div>}
          {msg && <div className="field-success">{msg}</div>}
          <button className="btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload Resume"}
          </button>
          <button className="btn-ghost" onClick={handleBulk}>Bulk import from CSV</button>
          {bulkMsg && <span className="bulk-msg">{bulkMsg}</span>}
        </div>
      </div>

      {/* Library */}
      <div className="library-header">
        <div className="section-title">{lib.length} resume{lib.length !== 1 ? "s" : ""} in library</div>
        {lib.length > 0 && (
          <input className="search-input" placeholder="Search by name or category…" value={search} onChange={e => setSearch(e.target.value)} />
        )}
      </div>

      {lib.length === 0 ? (
        <div className="empty-lib">
          <div className="empty-icon">📋</div>
          <p>No resumes yet — upload your first one above</p>
        </div>
      ) : (
        <div className="lib-layout">
          <div className="lib-list">
            {filtered.map(r => (
              <div key={r.id} className={`lib-row ${selected?.id === r.id ? "lib-row-active" : ""}`} onClick={() => setSelected(r)}>
                <div className="avatar sm" style={{ background: avatarColor(r.id) }}>{initials(r.name)}</div>
                <div className="lib-info">
                  <div className="lib-name">{r.name || r.filename}</div>
                  <div className="lib-meta">{r.filename} · {timeAgo(r.uploadedAt)}</div>
                </div>
                <span className={`lib-cat cat-${r.category.toLowerCase().replace(/\s+/g, "-")}`}>{r.category}</span>
                <button className="lib-del" onClick={e => { e.stopPropagation(); handleDelete(r.id); }} title="Remove">×</button>
              </div>
            ))}
            {filtered.length === 0 && <div className="no-results">No resumes match "{search}"</div>}
          </div>

          {selected && (
            <div className="lib-detail">
              <div className="detail-header">
                <div className="avatar lg" style={{ background: avatarColor(selected.id) }}>{initials(selected.name)}</div>
                <div>
                  <div className="detail-name">{selected.name || selected.filename}</div>
                  <div className="detail-meta">{selected.filename}</div>
                  <div className="detail-meta">{selected.category} · Uploaded {timeAgo(selected.uploadedAt)}</div>
                </div>
              </div>
              <div className="detail-section-title">Resume content</div>
              <div className="detail-preview">{selected.preview || "No preview available for this resume."}</div>
              <button className="btn-ghost w-full" onClick={() => setSelected(null)}>Close</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Find Candidates ────────────────────────────────────────────────────────────
function MatchView() {
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, AISummary>>({});
  const [sumLoading, setSumLoading] = useState<string | null>(null);

  const run = async () => {
    if (!jd.trim()) { setErr("Please enter a job description"); return; }
    setLoading(true); setErr(""); setResult(null);
    try { setResult(await api.matchResumes(title || "Position", jd, topK)); }
    catch (e: any) { setErr(e.message || "Matching failed"); }
    finally { setLoading(false); }
  };

  const getSummary = async (m: ResumeMatch) => {
    if (summaries[m.id]) return;
    setSumLoading(m.id);
    try { setSummaries(p => ({ ...p, [m.id]: null as any }));
      const d = await api.getSummary(m.preview, jd, m.id);
      setSummaries(p => ({ ...p, [m.id]: d }));
    } catch { setSummaries(p => ({ ...p, [m.id]: { candidate_id: m.id, summary: "Analysis unavailable.", strengths: [], gaps: [], recommendation: "Unknown", fit_score: 0 } })); }
    finally { setSumLoading(null); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Find Candidates</h2>
        <p>Paste a job description to instantly rank your resume library by fit</p>
      </div>

      <div className="match-layout">
        {/* Left panel */}
        <div className="match-left">
          <div className="field-group">
            <label>Job title</label>
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Data Scientist" />
          </div>
          <div className="field-group">
            <label>Job description</label>
            <textarea className="textarea-field" rows={11} value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description here…" />
          </div>
          <div className="match-row">
            <div className="field-group" style={{ flex: 1 }}>
              <label>Show top</label>
              <select className="select-field" value={topK} onChange={e => setTopK(+e.target.value)}>
                {[5, 10, 15, 20].map(k => <option key={k} value={k}>{k} candidates</option>)}
              </select>
            </div>
            <button className="btn-ghost" style={{ alignSelf: "flex-end" }} onClick={() => setJd(`Senior Software Engineer

We are looking for a skilled software engineer with:
- 4+ years of backend engineering experience
- Strong Python or Java skills
- Experience with REST APIs and microservices
- Familiarity with cloud platforms (AWS / GCP)
- Good communication and teamwork skills`)}>Use sample</button>
          </div>
          {err && <div className="field-error">{err}</div>}
          <button className="btn-primary w-full" onClick={run} disabled={loading}>
            {loading ? "Searching…" : "Find matching candidates"}
          </button>
        </div>

        {/* Right panel */}
        <div className="match-right">
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>Your ranked candidates will appear here</p>
            </div>
          )}
          {loading && (
            <div className="empty-state">
              <div className="loader" />
              <p>Scanning resumes…</p>
            </div>
          )}
          {result && (
            <>
              <div className="results-bar">
                <span className="results-count">{result.total_found} candidates found</span>
                <span className="results-for">for "{result.job_title}"</span>
              </div>
              <div className="results-list">
                {result.matches.map((m, idx) => {
                  const isOpen = expanded === m.id;
                  const hasSummary = !!summaries[m.id];
                  const pct = Math.round(m.score * 100);
                  return (
                    <div key={m.id} className={`res-card ${isOpen ? "res-open" : ""}`}>
                      <div className="res-top" onClick={() => setExpanded(isOpen ? null : m.id)}>
                        <span className="res-rank">#{idx + 1}</span>
                        <div className="avatar sm" style={{ background: avatarColor(m.id) }}>
                          {initials(m.metadata?.filename || m.id)}
                        </div>
                        <div className="res-info">
                          <div className="res-name">{m.metadata?.filename?.replace(/\.(pdf|txt)$/i,"") || m.id}</div>
                          <div className="res-cat">{m.category || "—"}</div>
                        </div>
                        <div className="res-score">
                          <div className="score-pct" style={{ color: scoreColor(m.score) }}>{pct}%</div>
                          <div className="score-track"><div className="score-fill" style={{ width: `${pct}%`, background: scoreColor(m.score) }} /></div>
                        </div>
                        <span className="res-chevron">{isOpen ? "▲" : "▼"}</span>
                      </div>

                      {isOpen && (
                        <div className="res-detail">
                          <div className="res-preview">{m.preview || "No preview."}</div>
                          {hasSummary && summaries[m.id] ? (
                            <div className="ai-block">
                              <div className="ai-block-head">
                                <span className={`tag ${recoCls(summaries[m.id].recommendation)}`}>{summaries[m.id].recommendation}</span>
                                <span className="ai-score">{Math.round(summaries[m.id].fit_score)}/100 fit</span>
                              </div>
                              <p className="ai-summary-text">{summaries[m.id].summary}</p>
                              <div className="ai-cols">
                                <div>
                                  <div className="ai-col-title">Strengths</div>
                                  {summaries[m.id].strengths.map((s, i) => <div key={i} className="ai-item ai-str">✓ {s}</div>)}
                                </div>
                                <div>
                                  <div className="ai-col-title">Gaps</div>
                                  {summaries[m.id].gaps.map((g, i) => <div key={i} className="ai-item ai-gap">○ {g}</div>)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button className="btn-ai" onClick={() => getSummary(m)} disabled={sumLoading === m.id}>
                              {sumLoading === m.id ? <><span className="loader-sm" /> Generating AI summary…</> : "✦ View AI Summary"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI Analysis ────────────────────────────────────────────────────────────────
function AISummaryView() {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f); setAnalysis(null); setErr("");
    const reader = new FileReader();
    reader.onload = e => setRawText((e.target?.result as string) || "");
    reader.readAsText(f);
  };

  const runAnalysis = async () => {
    if (!rawText.trim()) { setErr("Please upload a resume first"); return; }
    setLoading(true); setErr("");
    try { setAnalysis(await api.analyzeResume(rawText)); }
    catch (e: any) { setErr(e.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>AI Resume Analysis</h2>
        <p>Upload any resume — AI will extract skills, judge experience level and suggest the best matching roles</p>
      </div>

      {!analysis ? (
        <div className="ai-upload-area">
          <div
            className={`dropzone big ${file ? "dz-active" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={inputRef} type="file" accept=".pdf,.txt" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file
              ? <><div className="dz-big-icon">📄</div><div className="dz-big-name">{file.name}</div><div className="dz-hint">Click to change file</div></>
              : <><div className="dz-big-icon">↑</div><div className="dz-big-name">Drop a resume here</div><div className="dz-hint">PDF or TXT · Click to browse</div></>
            }
          </div>
          {file && (
            <div className="ai-paste-area">
              <label className="field-label">Or paste resume text directly</label>
              <textarea className="textarea-field" rows={6} value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Paste resume text here…" />
            </div>
          )}
          {!file && (
            <div className="ai-paste-area">
              <label className="field-label">Or paste resume text directly</label>
              <textarea className="textarea-field" rows={6} value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Paste resume text here…" />
            </div>
          )}
          {err && <div className="field-error">{err}</div>}
          <button className="btn-primary w-full" onClick={runAnalysis} disabled={loading || !rawText.trim()}>
            {loading ? <><span className="loader-sm" /> Analyzing resume…</> : "✦ Analyze with AI"}
          </button>
        </div>
      ) : (
        <div className="analysis-result">
          {/* Header */}
          <div className="ar-header">
            <div className="avatar xl" style={{ background: avatarColor(analysis.candidate_name) }}>
              {initials(analysis.candidate_name)}
            </div>
            <div>
              <div className="ar-name">{analysis.candidate_name}</div>
              <span className="tag tag-blue">{analysis.experience_level}</span>
            </div>
            <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={() => { setAnalysis(null); setFile(null); setRawText(""); }}>
              ← Analyze another
            </button>
          </div>

          {/* Summary */}
          <div className="ar-card">
            <div className="ar-card-title">Overview</div>
            <p className="ar-summary">{analysis.summary}</p>
          </div>

          {/* Skills */}
          <div className="ar-card">
            <div className="ar-card-title">Top skills identified</div>
            <div className="skill-tags">
              {analysis.top_skills.map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
              {analysis.top_skills.length === 0 && <span className="no-data">No specific skills detected</span>}
            </div>
          </div>

          {/* Suggested Roles */}
          <div className="ar-card">
            <div className="ar-card-title">Best-fit roles</div>
            <div className="roles-list">
              {analysis.suggested_roles.map((r, i) => (
                <div key={i} className="role-row">
                  <div className="role-num">{i + 1}</div>
                  <div className="role-info">
                    <div className="role-name">{r.role}</div>
                    <div className="role-reason">{r.match_reason}</div>
                  </div>
                  <span className={`tag ${fitCls(r.fit_level)}`}>{r.fit_level}</span>
                </div>
              ))}
              {analysis.suggested_roles.length === 0 && <span className="no-data">No role suggestions available</span>}
            </div>
          </div>

          {/* Strengths & Gaps */}
          <div className="ar-two-col">
            <div className="ar-card">
              <div className="ar-card-title">Strengths</div>
              {analysis.strengths.map((s, i) => (
                <div key={i} className="str-row"><span className="str-dot green-dot" />  {s}</div>
              ))}
            </div>
            <div className="ar-card">
              <div className="ar-card-title">Areas to develop</div>
              {analysis.areas_to_improve.map((a, i) => (
                <div key={i} className="str-row"><span className="str-dot amber-dot" />  {a}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconDash    = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg>;
const IconResumes = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const IconMatch   = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const IconAI      = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>;
const IconLogout  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 1H2a1 1 0 00-1 1v10a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChevron = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("auth_token"));
  const [view, setView] = useState<View>("dashboard");
  const [resumeCount, setResumeCount] = useState(api.getResumeLibrary().length);
  const [stats, setStats] = useState<any>(null);

  const refreshCount = useCallback(() => setResumeCount(api.getResumeLibrary().length), []);

  useEffect(() => {
    if (!authed) return;
    api.getStats().then(setStats).catch(() => {});
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="shell">
      <Sidebar view={view} setView={setView} resumeCount={resumeCount} onLogout={() => { api.clearToken(); setAuthed(false); }} />
      <main className="content">
        {view === "dashboard"  && <Dashboard setView={setView} resumeCount={resumeCount} stats={stats} />}
        {view === "resumes"    && <ResumesView onCountChange={refreshCount} />}
        {view === "match"      && <MatchView />}
        {view === "ai-summary" && <AISummaryView />}
      </main>
    </div>
  );
}
