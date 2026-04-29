import { useState, useEffect, useCallback, useRef } from "react";
import { api, StoredResume, ResumeMatch, AISummary, ResumeAnalysis } from "./api/apiClient";
import "./App.css";

type View = "dashboard" | "resumes" | "match" | "ai-summary";

interface MatchResponse { job_title: string; matches: ResumeMatch[]; total_found: number; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s >= 0.75 ? "var(--c-green)" : s >= 0.55 ? "var(--c-blue)" : s >= 0.35 ? "var(--c-amber)" : "var(--c-red)";

const recoCls = (r: string) =>
  ({ "Strong Match": "tag-green", "Good Match": "tag-blue", "Partial Match": "tag-amber", "Poor Match": "tag-red" }[r] || "tag-gray");

const fitCls = (f: string) =>
  ({ "Excellent": "tag-green", "Good": "tag-blue", "Fair": "tag-amber" }[f] || "tag-gray");

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "CV";
}
function avatarColor(id: string) {
  const c = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#ef4444"];
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % c.length;
  return c[h];
}
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function qualityColor(score: number) {
  if (score >= 8) return "var(--c-green)"; if (score >= 6) return "var(--c-blue)";
  if (score >= 4) return "var(--c-amber)"; return "var(--c-red)";
}

// ── Login ──────────────────────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState("admin"), [p, setP] = useState("admin123");
  const [err, setErr] = useState(""), [loading, setLoading] = useState(false);
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
          <div className="field-group"><label>Username</label>
            <input value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key==="Enter"&&submit()} /></div>
          <div className="field-group"><label>Password</label>
            <input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key==="Enter"&&submit()} /></div>
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
<<<<<<< HEAD
function Sidebar({ view, setView, resumeCount, onLogout, theme, setTheme }: {
  view: View; setView: (v: View) => void; resumeCount: number; onLogout: () => void;
  theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void;
}) {
=======
function Sidebar({ view, setView, resumeCount, onLogout }:
  { view: View; setView: (v: View) => void; resumeCount: number; onLogout: () => void }) {
>>>>>>> 0c418cb (updated ai workflow)
  const nav = [
    { id: "dashboard" as View, label: "Dashboard", icon: "⊞" },
    { id: "resumes" as View, label: "Resumes", icon: "☰", badge: resumeCount || undefined },
    { id: "match" as View, label: "Find Candidates", icon: "⊙" },
    { id: "ai-summary" as View, label: "AI Analysis", icon: "✦" },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand"><div className="brand-dot" /><span className="brand-name">RecruitAI</span></div>
        <nav className="sidebar-nav">
          {nav.map(n => (
            <button key={n.id} className={`nav-item ${view===n.id?"nav-active":""}`} onClick={() => setView(n.id)}>
              <span className="nav-ic">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
      </div>
<<<<<<< HEAD
      <div className="sidebar-bottom">
        <button className="sidebar-action" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          <span style={{ fontSize: "16px" }}>{theme === "light" ? "🌙" : "☀️"}</span> {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
        <button className="sidebar-action logout" onClick={onLogout}>
          <IconLogout /> Sign out
        </button>
      </div>
=======
      <button className="sidebar-logout" onClick={onLogout}>↩ Sign out</button>
>>>>>>> 0c418cb (updated ai workflow)
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
<<<<<<< HEAD
function Dashboard({ setView, setResumeTab, resumeCount, stats }: { setView: (v: View) => void; setResumeTab: (t: "all"|"shortlisted") => void; resumeCount: number; stats: any }) {
  const lib = api.getResumeLibrary();
  const recent = lib.slice(0, 4);

=======
function Dashboard({ setView, resumeCount, stats }:
  { setView: (v: View) => void; resumeCount: number; stats: any }) {
  const recent = api.getResumeLibrary().slice(0, 4);
>>>>>>> 0c418cb (updated ai workflow)
  return (
    <div className="page">
      <div className="page-head"><h2>Dashboard</h2><p>Your recruitment pipeline at a glance</p></div>
      <div className="dash-stats">
<<<<<<< HEAD
        <div className="dstat" onClick={() => { setResumeTab("all"); setView("resumes"); }} style={{ cursor: "pointer" }}>
          <div className="dstat-num">{resumeCount}</div>
          <div className="dstat-label">Resumes uploaded</div>
        </div>
        <div className="dstat" onClick={() => setView("match")} style={{ cursor: "pointer" }}>
          <div className="dstat-num">{stats?.jobs_indexed ?? 0}</div>
          <div className="dstat-label">Jobs indexed</div>
        </div>
        <div className="dstat">
          <div className="dstat-num">0</div>
          <div className="dstat-label">Candidates reviewed</div>
        </div>
        <div className="dstat" onClick={() => { setResumeTab("shortlisted"); setView("resumes"); }} style={{ cursor: "pointer" }}>
          <div className="dstat-num">{lib.filter(r => r.shortlisted).length}</div>
          <div className="dstat-label">Shortlisted</div>
=======
        <div className="dstat" onClick={() => setView("resumes")} style={{cursor:"pointer"}}>
          <div className="dstat-num">{resumeCount}</div><div className="dstat-label">Resumes uploaded</div>
>>>>>>> 0c418cb (updated ai workflow)
        </div>
        <div className="dstat"><div className="dstat-num">{stats?.jobs_indexed ?? 0}</div><div className="dstat-label">Jobs indexed</div></div>
        <div className="dstat"><div className="dstat-num">{resumeCount > 0 ? Math.round(resumeCount*0.7) : 0}</div><div className="dstat-label">Reviewed</div></div>
        <div className="dstat"><div className="dstat-num">{resumeCount > 0 ? Math.round(resumeCount*0.25) : 0}</div><div className="dstat-label">Shortlisted</div></div>
      </div>
      <div className="dash-actions">
        <button className="action-card" onClick={() => setView("resumes")}>
<<<<<<< HEAD
          <div className="action-icon ac-blue"><IconResumes /></div>
          <div className="action-text">
            <div className="action-title">Upload & View Resumes</div>
            <div className="action-sub">Upload PDFs, Word docs, browse your resume library</div>
          </div>
          <IconChevron />
=======
          <div className="action-icon ac-blue">☰</div>
          <div className="action-text"><div className="action-title">Upload & View Resumes</div><div className="action-sub">Upload PDFs, open and read any resume in your library</div></div>
          <span className="action-arrow">→</span>
>>>>>>> 0c418cb (updated ai workflow)
        </button>
        <button className="action-card" onClick={() => setView("match")}>
          <div className="action-icon ac-purple">⊙</div>
          <div className="action-text"><div className="action-title">Find Candidates for a Job</div><div className="action-sub">Paste a job description — get ranked candidates with AI assessments</div></div>
          <span className="action-arrow">→</span>
        </button>
        <button className="action-card" onClick={() => setView("ai-summary")}>
          <div className="action-icon ac-green">✦</div>
          <div className="action-text"><div className="action-title">AI Resume Analysis</div><div className="action-sub">Upload any resume — AI reads it and tells you skills, gaps, best roles, and what to do next</div></div>
          <span className="action-arrow">→</span>
        </button>
      </div>
      {recent.length > 0 && (
        <div className="dash-recent">
          <div className="section-title">Recently uploaded</div>
          {recent.map(r => (
            <div key={r.id} className="recent-row" onClick={() => setView("resumes")}>
              <div className="avatar sm" style={{background:avatarColor(r.id)}}>{initials(r.name)}</div>
              <div className="recent-info"><div className="recent-name">{r.name||r.filename}</div><div className="recent-meta">{r.category} · {timeAgo(r.uploadedAt)}</div></div>
              <span className="recent-arrow">→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resume Library ─────────────────────────────────────────────────────────────
<<<<<<< HEAD
function ResumesView({ onCountChange, initialTab = "all" }: { onCountChange: () => void; initialTab?: "all" | "shortlisted" }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
=======
function ResumesView({ onCountChange }: { onCountChange: () => void }) {
  const [file, setFile] = useState<File|null>(null);
>>>>>>> 0c418cb (updated ai workflow)
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const [lib, setLib] = useState<StoredResume[]>(api.getResumeLibrary());
  const [selected, setSelected] = useState<StoredResume|null>(null);
  const [search, setSearch] = useState("");
<<<<<<< HEAD
  const [tab, setTab] = useState<"all" | "shortlisted">(initialTab);
  const [bulkMsg, setBulkMsg] = useState("");
=======
>>>>>>> 0c418cb (updated ai workflow)
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshLib = () => { setLib(api.getResumeLibrary()); onCountChange(); };

<<<<<<< HEAD
  const handleFile = (f: File) => {
    const isDoc = f.name.endsWith(".doc") || f.name.endsWith(".docx") || f.type.includes("word");
    if (!f.type.includes("pdf") && !f.name.endsWith(".txt") && !isDoc) { setErr("Only PDF, TXT, DOC, or DOCX files"); return; }
    setFile(f);
  };
=======
  const handleFile = (f: File) => { setFile(f); setErr(""); setMsg(""); };
>>>>>>> 0c418cb (updated ai workflow)

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(""); setErr("");
    try {
      // Send PDF to backend — it extracts clean text via pypdf
      const res = await api.uploadResume(file);
<<<<<<< HEAD
      const id = res.id || `resume_${Date.now()}`;
      const nameGuess = file.name.replace(/\.(pdf|txt|doc|docx)$/i, "").replace(/[-_]/g, " ");
      api.addToLibrary({
        id, filename: file.name, name: nameGuess, category: "Uploaded",
        uploadedAt: new Date().toISOString(), preview: res.preview || "Preview not available.", metadata: {},
=======
      const nameGuess = file.name.replace(/\.(pdf|txt)$/i,"").replace(/[-_]/g," ");
      api.addToLibrary({
        id: res.id || `resume_${Date.now()}`,
        filename: file.name,
        name: nameGuess,
        category: "Uploaded",
        uploadedAt: new Date().toISOString(),
        preview: res.preview || "",       // clean, readable
        fullText: res.raw_text || "",     // full clean text for AI
        metadata: {},
>>>>>>> 0c418cb (updated ai workflow)
      });
      setMsg("Resume uploaded and indexed successfully.");
      setFile(null);
      refreshLib();
    } catch (e: any) { setErr(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleDelete = (id: string) => {
    api.removeFromLibrary(id);
    if (selected?.id === id) setSelected(null);
    refreshLib();
  };

<<<<<<< HEAD
  const handleBulk = async () => {
    setBulkMsg("Indexing…");
    try {
      const res = await api.bulkIngestResumes();
      setBulkMsg(`Done — ${res.count} resumes indexed.`);
    } catch (e: any) { setBulkMsg(e.message || "Failed"); }
  };

  const filtered = lib.filter(r => {
    if (tab === "shortlisted" && !r.shortlisted) return false;
    return r.name.toLowerCase().includes(search.toLowerCase()) ||
           r.filename.toLowerCase().includes(search.toLowerCase()) ||
           r.category.toLowerCase().includes(search.toLowerCase());
  });
=======
  const filtered = lib.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.filename.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );
>>>>>>> 0c418cb (updated ai workflow)

  return (
    <div className="page">
      <div className="page-head"><h2>Resumes</h2><p>Upload and manage your candidate resume library</p></div>

      <div className="upload-strip">
        <div className={`dropzone ${file?"dz-active":""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
<<<<<<< HEAD
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {file
            ? <><span className="dz-icon">📄</span><span className="dz-name">{file.name}</span><span className="dz-hint">Click to change</span></>
            : <><span className="dz-icon">↑</span><span className="dz-name">Drop a resume here or click to browse</span><span className="dz-hint">PDF, TXT, DOC, DOCX</span></>
          }
=======
          onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}>
          <input ref={inputRef} type="file" accept=".pdf,.txt" style={{display:"none"}}
            onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }} />
          {file
            ? <><span className="dz-icon">📄</span><span className="dz-name">{file.name}</span><span className="dz-hint">Click to change</span></>
            : <><span className="dz-icon">↑</span><span className="dz-name">Drop a resume here or click to browse</span><span className="dz-hint">PDF or TXT</span></>}
>>>>>>> 0c418cb (updated ai workflow)
        </div>
        <div className="upload-actions">
          {err && <div className="field-error">{err}</div>}
          {msg && <div className="field-success">{msg}</div>}
          <button className="btn-primary" onClick={handleUpload} disabled={!file||uploading}>
            {uploading ? "Uploading…" : "Upload Resume"}
          </button>
        </div>
      </div>

      <div className="library-header">
<<<<<<< HEAD
        <div className="section-title">
          {lib.length} resume{lib.length !== 1 ? "s" : ""} in library
        </div>
        {lib.length > 0 && (
          <div className="lib-filters" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div className="tab-group" style={{ display: "flex", gap: "8px" }}>
              <button className={`btn-ghost ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All Resumes</button>
              <button className={`btn-ghost ${tab === "shortlisted" ? "active" : ""}`} onClick={() => setTab("shortlisted")}>Shortlisted ({lib.filter(r => r.shortlisted).length})</button>
            </div>
            <input className="search-input" placeholder="Search by name or category…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}
=======
        <div className="section-title">{lib.length} resume{lib.length!==1?"s":""} in library</div>
        {lib.length > 0 && <input className="search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />}
>>>>>>> 0c418cb (updated ai workflow)
      </div>

      {lib.length === 0
        ? <div className="empty-lib"><div className="empty-icon">📋</div><p>No resumes yet — upload your first one above</p></div>
        : (
          <div className="lib-layout">
            <div className="lib-list">
              {filtered.map(r => (
                <div key={r.id} className={`lib-row ${selected?.id===r.id?"lib-row-active":""}`} onClick={() => setSelected(r)}>
                  <div className="avatar sm" style={{background:avatarColor(r.id)}}>{initials(r.name)}</div>
                  <div className="lib-info">
                    <div className="lib-name">{r.name||r.filename}</div>
                    <div className="lib-meta">{r.filename} · {timeAgo(r.uploadedAt)}</div>
                  </div>
                  <span className="lib-cat">{r.category}</span>
                  <button className="lib-del" onClick={e=>{e.stopPropagation();handleDelete(r.id)}} title="Remove">×</button>
                </div>
<<<<<<< HEAD
                <span className={`lib-cat cat-${r.category.toLowerCase().replace(/\s+/g, "-")}`}>{r.category}</span>
                <button 
                  className={`btn-ghost ${r.shortlisted ? "active" : ""}`} 
                  style={{ marginRight: "8px", padding: "4px 10px", fontSize: "0.8rem", border: r.shortlisted ? "1px solid var(--c-amber)" : "1px solid var(--border)", color: r.shortlisted ? "var(--c-amber)" : "inherit" }} 
                  onClick={e => { e.stopPropagation(); api.toggleShortlist(r.id); refreshLib(); }}
                >
                  {r.shortlisted ? "✓ Shortlisted" : "Shortlist"}
                </button>
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
=======
              ))}
              {filtered.length===0 && <div className="no-results">No results for "{search}"</div>}
>>>>>>> 0c418cb (updated ai workflow)
            </div>

            {selected && (
              <div className="lib-detail">
                <div className="detail-header">
                  <div className="avatar lg" style={{background:avatarColor(selected.id)}}>{initials(selected.name)}</div>
                  <div>
                    <div className="detail-name">{selected.name||selected.filename}</div>
                    <div className="detail-meta">{selected.filename}</div>
                    <div className="detail-meta">{selected.category} · {timeAgo(selected.uploadedAt)}</div>
                  </div>
                </div>
                <div className="detail-section-title">Resume content</div>
                <div className="detail-preview">
                  {selected.fullText || selected.preview || "No readable text found for this resume."}
                </div>
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
  const [title, setTitle] = useState(""), [jd, setJd] = useState("");
  const [topK, setTopK] = useState(10), [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse|null>(null), [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [summaries, setSummaries] = useState<Record<string,AISummary>>({});
  const [sumLoading, setSumLoading] = useState<string|null>(null);

  const run = async () => {
    if (!jd.trim()) { setErr("Please enter a job description"); return; }
    setLoading(true); setErr(""); setResult(null);
    try { setResult(await api.matchResumes(title||"Position", jd, topK)); }
    catch (e: any) { setErr(e.message||"Matching failed"); }
    finally { setLoading(false); }
  };

  const getSummary = async (m: ResumeMatch) => {
    if (summaries[m.id]) return;
    setSumLoading(m.id);
    try {
      const d = await api.getSummary(m.preview, jd, m.id);
      setSummaries(p => ({...p,[m.id]:d}));
    } catch {
      setSummaries(p => ({...p,[m.id]:{
        candidate_id:m.id,summary:"Analysis unavailable.",strengths:[],gaps:[],
        recommendation:"Unknown",fit_score:0,interview_questions:[],hiring_advice:""
      }}));
    } finally { setSumLoading(null); }
  };

  return (
    <div className="page">
      <div className="page-head"><h2>Find Candidates</h2><p>Paste a job description — get ranked candidates with AI assessments</p></div>
      <div className="match-layout">
        <div className="match-left">
          <div className="field-group"><label>Job title</label>
            <input className="input-field" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Senior Data Scientist" /></div>
          <div className="field-group"><label>Job description</label>
            <textarea className="textarea-field" rows={10} value={jd} onChange={e=>setJd(e.target.value)} placeholder="Paste the full job description here…" /></div>
          <div className="match-row">
            <div className="field-group" style={{flex:1}}><label>Show top</label>
              <select className="select-field" value={topK} onChange={e=>setTopK(+e.target.value)}>
                {[5,10,15,20].map(k=><option key={k} value={k}>{k} candidates</option>)}
              </select></div>
            <button className="btn-ghost" style={{alignSelf:"flex-end"}} onClick={()=>setJd(`Senior Software Engineer\n\nWe are looking for a skilled engineer with:\n- 4+ years backend engineering experience\n- Strong Python, REST APIs, microservices\n- Cloud experience (AWS / GCP)\n- Good communication and teamwork`)}>
              Use sample
            </button>
          </div>
          {err && <div className="field-error">{err}</div>}
          <button className="btn-primary w-full" onClick={run} disabled={loading}>
            {loading?"Searching…":"Find matching candidates"}
          </button>
        </div>

        <div className="match-right">
          {!result&&!loading && <div className="empty-state"><div className="empty-icon">⊙</div><p>Ranked candidates will appear here</p></div>}
          {loading && <div className="empty-state"><div className="loader"/><p>Scanning resumes…</p></div>}
          {result && (
            <>
              <div className="results-bar">
                <span className="results-count">{result.total_found} candidates</span>
                <span className="results-for">for "{result.job_title}"</span>
              </div>
              <div className="results-list">
                {result.matches.map((m, idx) => {
                  const isOpen = expanded===m.id;
                  const sum = summaries[m.id];
                  const pct = Math.round(m.score*100);
                  return (
                    <div key={m.id} className={`res-card ${isOpen?"res-open":""}`}>
                      <div className="res-top" onClick={()=>setExpanded(isOpen?null:m.id)}>
                        <span className="res-rank">#{idx+1}</span>
                        <div className="avatar sm" style={{background:avatarColor(m.id)}}>
                          {initials(m.metadata?.filename||m.id)}
                        </div>
                        <div className="res-info">
<<<<<<< HEAD
                          <div className="res-name">{m.metadata?.filename?.replace(/\.(pdf|txt|doc|docx)$/i,"") || m.id}</div>
                          <div className="res-cat">{m.category || "—"}</div>
=======
                          <div className="res-name">{(m.metadata?.filename||m.id).replace(/\.(pdf|txt)$/i,"")}</div>
                          <div className="res-cat">{m.category||"—"}</div>
>>>>>>> 0c418cb (updated ai workflow)
                        </div>
                        <div className="res-score">
                          <div className="score-pct" style={{color:scoreColor(m.score)}}>{pct}%</div>
                          <div className="score-track"><div className="score-fill" style={{width:`${pct}%`,background:scoreColor(m.score)}}/></div>
                        </div>
                        <span className="res-chevron">{isOpen?"▲":"▼"}</span>
                      </div>

                      {isOpen && (
                        <div className="res-detail">
                          <div className="res-preview">{m.preview||"No preview."}</div>
                          {sum ? (
                            <div className="ai-block">
                              <div className="ai-block-head">
                                <span className={`tag ${recoCls(sum.recommendation)}`}>{sum.recommendation}</span>
                                <span className="ai-score">{Math.round(sum.fit_score)}/100 fit</span>
                              </div>
                              <p className="ai-summary-text">{sum.summary}</p>
                              <div className="ai-cols">
                                <div>
                                  <div className="ai-col-title">✓ Strengths</div>
                                  {sum.strengths.map((s,i)=><div key={i} className="ai-item">{s}</div>)}
                                </div>
                                <div>
                                  <div className="ai-col-title">⚠ Gaps</div>
                                  {sum.gaps.map((g,i)=><div key={i} className="ai-item ai-gap">{g}</div>)}
                                </div>
                              </div>
                              {sum.interview_questions && sum.interview_questions.length > 0 && (
                                <div className="ai-interviews">
                                  <div className="ai-col-title" style={{marginBottom:6}}>💬 Interview questions to ask</div>
                                  {sum.interview_questions.map((q,i)=><div key={i} className="ai-q">Q{i+1}: {q}</div>)}
                                </div>
                              )}
                              {sum.hiring_advice && (
                                <div className="ai-advice">
                                  <span className="ai-col-title">📋 Hiring advice: </span>{sum.hiring_advice}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button className="btn-ai" onClick={()=>getSummary(m)} disabled={sumLoading===m.id}>
                              {sumLoading===m.id?<><span className="loader-sm"/>Generating AI assessment…</>:"✦ View AI Assessment"}
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
  const [file, setFile] = useState<File|null>(null);
  const [extracting, setExtracting] = useState(false);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis|null>(null);
  const [err, setErr] = useState("");
  const [fileReady, setFileReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

<<<<<<< HEAD
  const handleFile = async (f: File) => {
    setFile(f); setAnalysis(null); setErr(""); setRawText("Extracting text...");
    try {
      const res = await api.extractText(f);
      setRawText(res.text || "");
    } catch (e: any) {
      setErr("Failed to extract text from file");
      setRawText("");
    }
=======
  // When user picks a file, extract text via backend (not FileReader)
  const handleFile = async (f: File) => {
    setFile(f); setErr(""); setAnalysis(null); setRawText(""); setFileReady(false);
    setExtracting(true);
    try {
      const res = await api.extractTextFromFile(f);
      setRawText(res.text);
      setFileReady(true);
    } catch (e: any) {
      setErr(e.message || "Could not extract text from file");
    } finally { setExtracting(false); }
>>>>>>> 0c418cb (updated ai workflow)
  };

  const runAnalysis = async () => {
    if (!rawText.trim()) { setErr("Please upload a resume or paste text first"); return; }
    setLoading(true); setErr("");
    try { setAnalysis(await api.analyzeResume(rawText)); }
    catch (e: any) { setErr(e.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  const reset = () => { setAnalysis(null); setFile(null); setRawText(""); setFileReady(false); setErr(""); };

  const qScore = analysis?.resume_quality?.score ?? 0;

  return (
    <div className="page">
      <div className="page-head"><h2>AI Resume Analysis</h2>
        <p>Upload a resume — AI reads it and tells you what's there, what's missing, and what to do next</p>
      </div>

      {!analysis ? (
        <div className="ai-upload-area">
          <div className={`dropzone big ${file&&fileReady?"dz-active":""}`}
            onClick={() => inputRef.current?.click()}
<<<<<<< HEAD
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={inputRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file
              ? <><div className="dz-big-icon">📄</div><div className="dz-big-name">{file.name}</div><div className="dz-hint">Click to change file</div></>
              : <><div className="dz-big-icon">↑</div><div className="dz-big-name">Drop a resume here</div><div className="dz-hint">PDF, TXT, DOC, DOCX · Click to browse</div></>
=======
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
            <input ref={inputRef} type="file" accept=".pdf,.txt" style={{display:"none"}}
              onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
            {extracting
              ? <><div className="loader"/><div className="dz-big-name">Reading file…</div></>
              : file&&fileReady
                ? <><div className="dz-big-icon">✓</div><div className="dz-big-name">{file.name}</div><div className="dz-hint">Text extracted successfully · Click to change</div></>
                : <><div className="dz-big-icon">↑</div><div className="dz-big-name">Drop a resume here or click to browse</div><div className="dz-hint">PDF or TXT file</div></>
>>>>>>> 0c418cb (updated ai workflow)
            }
          </div>

          <div className="field-group">
            <label>Or paste resume text directly</label>
            <textarea className="textarea-field" rows={7}
              value={rawText} onChange={e=>setRawText(e.target.value)}
              placeholder="Paste plain resume text here if you don't have a PDF…" />
          </div>

          {err && <div className="field-error">{err}</div>}
          <button className="btn-primary w-full" onClick={runAnalysis}
            disabled={loading || extracting || !rawText.trim()}>
            {loading ? <><span className="loader-sm-w"/>Analysing resume…</> : "✦ Analyse Resume with AI"}
          </button>
          <p className="ai-hint">AI reads the full resume text and gives you a detailed, honest assessment — skills found, experience level, best-fit roles, gaps, and specific next steps.</p>
        </div>
      ) : (
        <div className="analysis-result">
          {/* Header card */}
          <div className="ar-header">
            <div className="avatar xl" style={{background:avatarColor(analysis.candidate_name)}}>
              {initials(analysis.candidate_name)}
            </div>
            <div className="ar-header-info">
              <div className="ar-name">{analysis.candidate_name}</div>
              <div className="ar-role">{analysis.current_or_recent_role}</div>
              <div className="ar-tags">
                <span className="tag tag-blue">{analysis.experience_level}</span>
                <span className="tag tag-gray">{analysis.years_experience}</span>
              </div>
            </div>
            <div className="ar-quality">
              <div className="quality-ring" style={{borderColor:qualityColor(qScore)}}>
                <div className="quality-num" style={{color:qualityColor(qScore)}}>{qScore}</div>
                <div className="quality-label">/ 10</div>
              </div>
              <div className="quality-text">Resume quality</div>
              <div className="quality-comment">{analysis.resume_quality?.comment}</div>
            </div>
            <button className="btn-ghost" style={{marginLeft:"auto",alignSelf:"flex-start"}} onClick={reset}>← Analyse another</button>
          </div>

          {/* Overview */}
          <div className="ar-card">
            <div className="ar-card-title">Overview</div>
            <p className="ar-summary">{analysis.summary}</p>
          </div>

          {/* Skills row */}
          <div className="ar-two-col">
            <div className="ar-card">
              <div className="ar-card-title">Skills identified in resume</div>
              {analysis.top_skills.length > 0
                ? <div className="skill-tags">{analysis.top_skills.map((s,i)=><span key={i} className="skill-tag">{s}</span>)}</div>
                : <span className="no-data">No specific skills detected</span>}
            </div>
            <div className="ar-card">
              <div className="ar-card-title">Skill gaps / what's missing</div>
              {analysis.skill_gaps.length > 0
                ? <div className="skill-tags">{analysis.skill_gaps.map((s,i)=><span key={i} className="skill-tag gap-tag">{s}</span>)}</div>
                : <span className="no-data">No obvious skill gaps detected</span>}
            </div>
          </div>

          {/* Strengths & Improvements */}
          <div className="ar-two-col">
            <div className="ar-card">
              <div className="ar-card-title">Strongest points</div>
              {analysis.strongest_points.map((s,i)=>(
                <div key={i} className="str-row"><span className="str-dot green-dot"/><span>{s}</span></div>
              ))}
            </div>
            <div className="ar-card">
              <div className="ar-card-title">Areas to improve</div>
              {analysis.areas_to_improve.map((a,i)=>(
                <div key={i} className="str-row"><span className="str-dot amber-dot"/><span>{a}</span></div>
              ))}
            </div>
          </div>

          {/* Best-fit roles */}
          <div className="ar-card">
            <div className="ar-card-title">Best-fit roles for this candidate</div>
            <div className="roles-list">
              {analysis.suggested_roles.map((r,i)=>(
                <div key={i} className="role-row">
                  <div className="role-num">{i+1}</div>
                  <div className="role-info">
                    <div className="role-name">{r.role}</div>
                    <div className="role-reason">{r.reason}</div>
                  </div>
                  <span className={`tag ${fitCls(r.fit)}`}>{r.fit}</span>
                </div>
              ))}
              {analysis.suggested_roles.length===0 && <span className="no-data">No role suggestions available</span>}
            </div>
          </div>

          {/* What to do next */}
          {analysis.what_to_do_next.length > 0 && (
            <div className="ar-card ar-next">
              <div className="ar-card-title">What to do next</div>
              {analysis.what_to_do_next.map((step,i)=>(
                <div key={i} className="next-row">
                  <div className="next-num">{i+1}</div>
                  <div className="next-text">{step}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("auth_token"));
  const [view, setView] = useState<View>("dashboard");
  const [resumeTab, setResumeTab] = useState<"all" | "shortlisted">("all");
  const [resumeCount, setResumeCount] = useState(api.getResumeLibrary().length);
  const [stats, setStats] = useState<any>(null);
  const [theme, setTheme] = useState<"light" | "dark">((localStorage.getItem("theme") as "light" | "dark") || "light");

  const refreshCount = useCallback(() => setResumeCount(api.getResumeLibrary().length), []);

<<<<<<< HEAD
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!authed) return;
    api.getStats().then(setStats).catch(() => {});
  }, [authed]);
=======
  useEffect(() => { if (authed) api.getStats().then(setStats).catch(()=>{}); }, [authed]);
>>>>>>> 0c418cb (updated ai workflow)

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  const handleLogout = () => { api.clearToken(); setAuthed(false); };

  return (
    <div className="shell">
<<<<<<< HEAD
      <Sidebar view={view} setView={setView} resumeCount={resumeCount} onLogout={() => { api.clearToken(); setAuthed(false); }} theme={theme} setTheme={setTheme} />
      <main className="content">
        {view === "dashboard"  && <Dashboard setView={setView} setResumeTab={setResumeTab} resumeCount={resumeCount} stats={stats} />}
        {view === "resumes"    && <ResumesView onCountChange={refreshCount} initialTab={resumeTab} />}
        {view === "match"      && <MatchView />}
        {view === "ai-summary" && <AISummaryView />}
=======
      <Sidebar view={view} setView={setView} resumeCount={resumeCount} onLogout={handleLogout} />
      <main className="content">
        {view==="dashboard"  && <Dashboard setView={setView} resumeCount={resumeCount} stats={stats} />}
        {view==="resumes"    && <ResumesView onCountChange={refreshCount} />}
        {view==="match"      && <MatchView />}
        {view==="ai-summary" && <AISummaryView />}
>>>>>>> 0c418cb (updated ai workflow)
      </main>
    </div>
  );
}
