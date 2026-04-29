import { useState, useEffect, useCallback, useRef } from "react";
import { api, StoredResume, ResumeMatch, AISummary, ResumeAnalysis, Shortlist, ShortlistedCandidate } from "./api/apiClient";
import "./App.css";

type View = "dashboard" | "resumes" | "match" | "ai-summary" | "shortlist";

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
function Sidebar({ view, setView, resumeCount, onLogout }:
  { view: View; setView: (v: View) => void; resumeCount: number; onLogout: () => void }) {
  const nav = [
    { id: "dashboard" as View, label: "Dashboard", icon: "⊞" },
    { id: "resumes" as View, label: "Resumes", icon: "☰", badge: resumeCount || undefined },
    { id: "match" as View, label: "Find Candidates", icon: "⊙" },
    { id: "shortlist" as View, label: "Shortlists", icon: "★" },
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
      <button className="sidebar-logout" onClick={onLogout}>↩ Sign out</button>
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ setView, resumeCount, stats, slStats }:
  { setView: (v: View) => void; resumeCount: number; stats: any; slStats: any }) {
  const recent = api.getResumeLibrary().slice(0, 4);
  return (
    <div className="page">
      <div className="page-head"><h2>Dashboard</h2><p>Your recruitment pipeline at a glance</p></div>
      <div className="dash-stats">
        <div className="dstat" onClick={() => setView("resumes")} style={{cursor:"pointer"}}>
          <div className="dstat-num">{resumeCount}</div><div className="dstat-label">Resumes uploaded</div>
        </div>
        <div className="dstat"><div className="dstat-num">{stats?.jobs_indexed ?? 0}</div><div className="dstat-label">Jobs indexed</div></div>
        <div className="dstat"><div className="dstat-num">{resumeCount > 0 ? Math.round(resumeCount*0.7) : 0}</div><div className="dstat-label">Reviewed</div></div>
        <div className="dstat" onClick={() => setView("resumes")} style={{cursor:"pointer"}}><div className="dstat-num">{getLocalShortlisted().length}</div><div className="dstat-label">Shortlisted</div></div>
      </div>
      <div className="dash-actions">
        <button className="action-card" onClick={() => setView("resumes")}>
          <div className="action-icon ac-blue">☰</div>
          <div className="action-text"><div className="action-title">Upload & View Resumes</div><div className="action-sub">Upload PDFs, open and read any resume in your library</div></div>
          <span className="action-arrow">→</span>
        </button>
        <button className="action-card" onClick={() => setView("match")}>
          <div className="action-icon ac-purple">⊙</div>
          <div className="action-text"><div className="action-title">Find Candidates for a Job</div><div className="action-sub">Paste a job description — get ranked candidates with AI assessments</div></div>
          <span className="action-arrow">→</span>
        </button>
        <button className="action-card" onClick={() => setView("shortlist")}>
          <div className="action-icon ac-amber">★</div>
          <div className="action-text"><div className="action-title">Shortlists</div><div className="action-sub">Track shortlisted candidates — set statuses, add notes, manage your hiring pipeline</div></div>
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
// ── helpers for local shortlist store ──────────────────────────────────────
function getLocalShortlisted(): string[] {
  try { return JSON.parse(localStorage.getItem("shortlisted_ids") || "[]"); } catch { return []; }
}
function saveLocalShortlisted(ids: string[]) {
  localStorage.setItem("shortlisted_ids", JSON.stringify(ids));
}

function ResumesView({ onCountChange }: { onCountChange: () => void }) {
  const [file, setFile] = useState<File|null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const [lib, setLib] = useState<StoredResume[]>(api.getResumeLibrary());
  const [selected, setSelected] = useState<StoredResume|null>(null);
  const [search, setSearch] = useState("");
  const [shortlistedIds, setShortlistedIds] = useState<string[]>(getLocalShortlisted());
  const [filterShortlisted, setFilterShortlisted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshLib = () => { setLib(api.getResumeLibrary()); onCountChange(); };

  const handleFile = (f: File) => { setFile(f); setErr(""); setMsg(""); };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(""); setErr("");
    try {
      const res = await api.uploadResume(file);
      const nameGuess = file.name.replace(/\.(pdf|txt)$/i,"").replace(/[-_]/g," ");
      api.addToLibrary({
        id: res.id || `resume_${Date.now()}`,
        filename: file.name,
        name: nameGuess,
        category: "Uploaded",
        uploadedAt: new Date().toISOString(),
        preview: res.preview || "",
        fullText: res.raw_text || "",
        metadata: {},
      });
      setMsg("Resume uploaded successfully.");
      setFile(null);
      refreshLib();
    } catch (e: any) { setErr(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleDelete = (id: string) => {
    api.removeFromLibrary(id);
    if (selected?.id === id) setSelected(null);
    // also remove from shortlist
    const updated = shortlistedIds.filter(x => x !== id);
    setShortlistedIds(updated); saveLocalShortlisted(updated);
    refreshLib();
  };

  const toggleShortlist = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = shortlistedIds.includes(id)
      ? shortlistedIds.filter(x => x !== id)
      : [...shortlistedIds, id];
    setShortlistedIds(updated);
    saveLocalShortlisted(updated);
  };

  const isShortlisted = (id: string) => shortlistedIds.includes(id);

  const filtered = lib
    .filter(r => !filterShortlisted || isShortlisted(r.id))
    .filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.filename.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
    );

  const shortlistedCount = lib.filter(r => isShortlisted(r.id)).length;

  return (
    <div className="page">
      <div className="page-head"><h2>Resumes</h2><p>Upload resumes and shortlist the ones you like</p></div>

      <div className="upload-strip">
        <div className={`dropzone ${file?"dz-active":""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}>
          <input ref={inputRef} type="file" accept=".pdf,.txt" style={{display:"none"}}
            onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }} />
          {file
            ? <><span className="dz-icon">📄</span><span className="dz-name">{file.name}</span><span className="dz-hint">Click to change</span></>
            : <><span className="dz-icon">↑</span><span className="dz-name">Drop a resume here or click to browse</span><span className="dz-hint">PDF or TXT</span></>}
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
        <div className="lib-header-left">
          <div className="section-title">{lib.length} resume{lib.length!==1?"s":""} in library</div>
          {shortlistedCount > 0 && (
            <button
              className={`sl-filter-btn ${filterShortlisted?"sl-filter-active":""}`}
              onClick={() => setFilterShortlisted(p => !p)}
            >
              ★ {shortlistedCount} shortlisted{filterShortlisted?" (showing)":""}
            </button>
          )}
        </div>
        {lib.length > 0 && <input className="search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />}
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
                  {isShortlisted(r.id) && <span className="sl-badge">★ Shortlisted</span>}
                  <button
                    className={`lib-sl-btn ${isShortlisted(r.id)?"lib-sl-active":""}`}
                    onClick={e => toggleShortlist(r.id, e)}
                    title={isShortlisted(r.id)?"Remove from shortlist":"Add to shortlist"}
                  >
                    {isShortlisted(r.id) ? "★" : "☆"}
                  </button>
                  <button className="lib-del" onClick={e=>{e.stopPropagation();handleDelete(r.id)}} title="Remove">×</button>
                </div>
              ))}
              {filtered.length===0 && <div className="no-results">{filterShortlisted ? "No shortlisted resumes yet — click ☆ on any resume to shortlist it" : `No results for "${search}"`}</div>}
            </div>

            {selected && (
              <div className="lib-detail">
                <div className="detail-header">
                  <div className="avatar lg" style={{background:avatarColor(selected.id)}}>{initials(selected.name)}</div>
                  <div style={{flex:1}}>
                    <div className="detail-name">{selected.name||selected.filename}</div>
                    <div className="detail-meta">{selected.filename}</div>
                    <div className="detail-meta">{selected.category} · {timeAgo(selected.uploadedAt)}</div>
                  </div>
                </div>
                <button
                  className={`btn-shortlist-big ${isShortlisted(selected.id)?"btn-shortlist-big-active":""}`}
                  onClick={() => toggleShortlist(selected.id)}
                >
                  {isShortlisted(selected.id) ? "★ Shortlisted — click to remove" : "☆ Add to Shortlist"}
                </button>
                <div className="detail-section-title">Resume content</div>
                <div className="detail-preview">
                  {selected.fullText || selected.preview || "No readable text found for this resume."}
                </div>
                <button className="btn-ghost w-full" style={{marginTop:12}} onClick={() => setSelected(null)}>Close</button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

// ── Find Candidates ────────────────────────────────────────────────────────────
function MatchView({ onShortlistChange }: { onShortlistChange?: () => void }) {
  const [title, setTitle] = useState(""), [jd, setJd] = useState("");
  const [topK, setTopK] = useState(10), [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse|null>(null), [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [summaries, setSummaries] = useState<Record<string,AISummary>>({});
  const [sumLoading, setSumLoading] = useState<string|null>(null);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [shortlisting, setShortlisting] = useState<string|null>(null);
  const [shortlistMsg, setShortlistMsg] = useState<Record<string,string>>({});
  const [showSlPicker, setShowSlPicker] = useState<string|null>(null);
  const [newSlTitle, setNewSlTitle] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    api.getShortlists().then(setShortlists).catch(()=>{});
  }, []);

  const shortlistCandidate = async (m: ResumeMatch, slId: number) => {
    setShortlisting(m.id);
    const sum = summaries[m.id];
    try {
      await api.addToShortlist(slId, {
        candidate_id: m.id,
        candidate_name: (m.metadata?.filename || m.id).replace(/\.(pdf|txt)$/i, ""),
        filename: m.metadata?.filename || m.id,
        category: m.category || "",
        match_score: m.score,
        fit_score: sum?.fit_score || 0,
        recommendation: sum?.recommendation || "",
        preview: m.preview || "",
        notes: "",
      });
      setShortlistMsg(p => ({...p, [m.id]: "✓ Shortlisted!"}));
      onShortlistChange?.();
      setTimeout(() => setShortlistMsg(p => ({...p, [m.id]: ""})), 3000);
    } catch (e: any) {
      setShortlistMsg(p => ({...p, [m.id]: e.message.includes("already") ? "Already shortlisted" : "Failed"}));
    } finally {
      setShortlisting(null);
      setShowSlPicker(null);
    }
  };

  const createAndShortlist = async (m: ResumeMatch) => {
    if (!newSlTitle.trim()) return;
    setCreatingNew(true);
    try {
      const sl = await api.createShortlist(newSlTitle.trim(), jd);
      setShortlists(p => [sl, ...p]);
      setNewSlTitle("");
      await shortlistCandidate(m, sl.id);
    } catch {} finally { setCreatingNew(false); }
  };

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
                          <div className="res-name">{(m.metadata?.filename||m.id).replace(/\.(pdf|txt)$/i,"")}</div>
                          <div className="res-cat">{m.category||"—"}</div>
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
                          {/* Shortlist button */}
                          <div className="sl-actions">
                            {shortlistMsg[m.id]
                              ? <div className="sl-msg">{shortlistMsg[m.id]}</div>
                              : showSlPicker===m.id
                                ? (
                                  <div className="sl-picker">
                                    <div className="sl-picker-title">Add to shortlist</div>
                                    {shortlists.map(sl => (
                                      <button key={sl.id} className="sl-pick-row" onClick={()=>shortlistCandidate(m, sl.id)} disabled={shortlisting===m.id}>
                                        <span className="sl-pick-icon">★</span>
                                        <span className="sl-pick-name">{sl.job_title}</span>
                                        <span className="sl-pick-count">{sl.total ?? 0} candidates</span>
                                      </button>
                                    ))}
                                    <div className="sl-new-row">
                                      <input className="sl-new-input" value={newSlTitle} onChange={e=>setNewSlTitle(e.target.value)}
                                        placeholder="New shortlist name…" onKeyDown={e=>e.key==="Enter"&&createAndShortlist(m)} />
                                      <button className="btn-sm-primary" onClick={()=>createAndShortlist(m)} disabled={creatingNew||!newSlTitle.trim()}>
                                        {creatingNew?"…":"Create & add"}
                                      </button>
                                    </div>
                                    <button className="btn-ghost btn-sm" onClick={()=>setShowSlPicker(null)}>Cancel</button>
                                  </div>
                                )
                                : (
                                  <button className="btn-shortlist" onClick={()=>{setShowSlPicker(m.id);api.getShortlists().then(setShortlists).catch(()=>{});}}>
                                    ★ Add to Shortlist
                                  </button>
                                )
                            }
                          </div>
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
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
            <input ref={inputRef} type="file" accept=".pdf,.txt" style={{display:"none"}}
              onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
            {extracting
              ? <><div className="loader"/><div className="dz-big-name">Reading file…</div></>
              : file&&fileReady
                ? <><div className="dz-big-icon">✓</div><div className="dz-big-name">{file.name}</div><div className="dz-hint">Text extracted successfully · Click to change</div></>
                : <><div className="dz-big-icon">↑</div><div className="dz-big-name">Drop a resume here or click to browse</div><div className="dz-hint">PDF or TXT file</div></>
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


// ── Shortlist View ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", interviewed: "Interviewed", accepted: "Accepted", rejected: "Rejected"
};
const STATUS_CLS: Record<string, string> = {
  pending: "tag-gray", interviewed: "tag-blue", accepted: "tag-green", rejected: "tag-red"
};

function ShortlistView() {
  const lib = api.getResumeLibrary();
  const shortlistedIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem("shortlisted_ids") || "[]"); } catch { return []; }
  })();

  const shortlisted = lib.filter(r => shortlistedIds.includes(r.id));
  const [selected, setSelected] = useState<StoredResume|null>(null);
  const [notes, setNotes] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem("sl_notes") || "{}"); } catch { return {}; }
  });
  const [editingNote, setEditingNote] = useState<string|null>(null);
  const [noteVal, setNoteVal] = useState("");

  const unstar = (id: string) => {
    const updated = shortlistedIds.filter(x => x !== id);
    localStorage.setItem("shortlisted_ids", JSON.stringify(updated));
    if (selected?.id === id) setSelected(null);
    // force re-render
    window.dispatchEvent(new Event("storage"));
  };

  const saveNote = (id: string) => {
    const updated = {...notes, [id]: noteVal};
    setNotes(updated);
    localStorage.setItem("sl_notes", JSON.stringify(updated));
    setEditingNote(null);
  };

  // listen for star changes from Resumes page
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate(n => n+1);
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const shortlistedNow = lib.filter(r => {
    try { return (JSON.parse(localStorage.getItem("shortlisted_ids") || "[]") as string[]).includes(r.id); }
    catch { return false; }
  });

  return (
    <div className="page">
      <div className="page-head">
        <h2>★ Shortlisted Candidates</h2>
        <p>{shortlistedNow.length} candidate{shortlistedNow.length !== 1 ? "s" : ""} shortlisted — go to Resumes and click ☆ to add more</p>
      </div>

      {shortlistedNow.length === 0 ? (
        <div className="empty-lib">
          <div className="empty-icon">☆</div>
          <p>No shortlisted resumes yet.<br/>Go to <strong>Resumes</strong>, upload resumes, and click the <strong>☆ star</strong> on the ones you like.</p>
        </div>
      ) : (
        <div className="lib-layout">
          <div className="lib-list">
            {shortlistedNow.map(r => (
              <div key={r.id} className={`lib-row ${selected?.id===r.id?"lib-row-active":""}`} onClick={() => setSelected(r)}>
                <div className="avatar sm" style={{background:avatarColor(r.id)}}>{initials(r.name)}</div>
                <div className="lib-info">
                  <div className="lib-name">{r.name || r.filename}</div>
                  <div className="lib-meta">{r.filename} · {timeAgo(r.uploadedAt)}</div>
                </div>
                <span className="sl-badge">★</span>
                {notes[r.id] && <span className="sl-note-chip">📝</span>}
                <button className="lib-sl-btn lib-sl-active" title="Remove from shortlist"
                  onClick={e => { e.stopPropagation(); unstar(r.id); forceUpdate(n=>n+1); }}>★</button>
              </div>
            ))}
          </div>

          {selected && (
            <div className="lib-detail">
              <div className="detail-header">
                <div className="avatar lg" style={{background:avatarColor(selected.id)}}>{initials(selected.name)}</div>
                <div style={{flex:1}}>
                  <div className="detail-name">{selected.name || selected.filename}</div>
                  <div className="detail-meta">{selected.filename}</div>
                  <div className="detail-meta">{selected.category} · {timeAgo(selected.uploadedAt)}</div>
                </div>
              </div>

              {/* Notes section */}
              <div className="detail-section-title" style={{marginTop:14}}>Notes</div>
              {editingNote === selected.id ? (
                <div style={{marginBottom:12}}>
                  <textarea className="textarea-field" rows={3} value={noteVal}
                    onChange={e => setNoteVal(e.target.value)}
                    placeholder="Write your notes about this candidate…" />
                  <div style={{display:"flex",gap:8,marginTop:6}}>
                    <button className="btn-sm-primary" onClick={() => saveNote(selected.id)}>Save</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditingNote(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="sl-note-row" style={{marginBottom:12}}
                  onClick={() => { setEditingNote(selected.id); setNoteVal(notes[selected.id]||""); }}>
                  {notes[selected.id]
                    ? <span className="sl-note-text">📝 {notes[selected.id]}</span>
                    : <span className="sl-note-placeholder">+ Add note about this candidate…</span>}
                </div>
              )}

              <div className="detail-section-title">Resume</div>
              <div className="detail-preview">
                {selected.fullText || selected.preview || "No text available."}
              </div>

              <button className="lib-del-big" onClick={() => { unstar(selected.id); forceUpdate(n=>n+1); }}>
                ✕ Remove from shortlist
              </button>
              <button className="btn-ghost w-full" style={{marginTop:8}} onClick={() => setSelected(null)}>Close</button>
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
  const [resumeCount, setResumeCount] = useState(api.getResumeLibrary().length);
  const [stats, setStats] = useState<any>(null);
  const [slStats, setSlStats] = useState<any>(null);

  const refreshCount = useCallback(() => setResumeCount(api.getResumeLibrary().length), []);
  const refreshSlStats = useCallback(() => {
    api.getShortlistStats().then(setSlStats).catch(()=>{});
  }, []);

  useEffect(() => {
    if (authed) {
      api.getStats().then(setStats).catch(()=>{});
      refreshSlStats();
    }
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  const handleLogout = () => { api.clearToken(); setAuthed(false); };

  return (
    <div className="shell">
      <Sidebar view={view} setView={setView} resumeCount={resumeCount} onLogout={handleLogout} />
      <main className="content">
        {view==="dashboard"  && <Dashboard setView={setView} resumeCount={resumeCount} stats={stats} slStats={slStats} />}
        {view==="resumes"    && <ResumesView onCountChange={refreshCount} />}
        {view==="match"      && <MatchView onShortlistChange={refreshSlStats} />}
        {view==="shortlist"  && <ShortlistView />}
        {view==="ai-summary" && <AISummaryView />}
      </main>
    </div>
  );
}