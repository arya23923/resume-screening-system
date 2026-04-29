const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface StoredResume {
  id: string;
  filename: string;
  name: string;
  category: string;
  uploadedAt: string;
  preview: string;        // clean readable text snippet
  fullText: string;       // full clean text for AI analysis
  metadata: Record<string, string>;
  shortlisted?: boolean;
}

export interface ResumeMatch {
  id: string;
  score: number;
  category: string;
  preview: string;
  metadata: Record<string, string>;
}

export interface AISummary {
  candidate_id: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: string;
  fit_score: number;
  interview_questions?: string[];
  hiring_advice?: string;
}

export interface RoleSuggestion {
  role: string;
  reason: string;
  fit: "Excellent" | "Good" | "Fair";
}

export interface ResumeAnalysis {
  candidate_name: string;
  experience_level: string;
  years_experience: string;
  current_or_recent_role: string;
  summary: string;
  top_skills: string[];
  skill_gaps: string[];
  strongest_points: string[];
  areas_to_improve: string[];
  suggested_roles: RoleSuggestion[];
  resume_quality: { score: number; comment: string };
  what_to_do_next: string[];
}

class ApiClient {
  private token: string | null = null;

  setToken(t: string) { this.token = t; localStorage.setItem("auth_token", t); }
  loadToken() { this.token = localStorage.getItem("auth_token"); }
  clearToken() {
    this.token = null;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("resume_library");
  }

  private h(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async login(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  async getStats() {
    const res = await fetch(`${BASE_URL}/match/stats`, { headers: this.h() });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  }

  async matchResumes(title: string, description: string, topK = 10) {
    const res = await fetch(`${BASE_URL}/match/resumes`, {
      method: "POST", headers: this.h(),
      body: JSON.stringify({ title, description, top_k: topK }),
    });
    if (!res.ok) throw new Error("Matching failed");
    return res.json();
  }

  async getSummary(resumeText: string, jobDescription: string, candidateId?: string): Promise<AISummary> {
    const res = await fetch(`${BASE_URL}/match/summary`, {
      method: "POST", headers: this.h(),
      body: JSON.stringify({
        resume_text: resumeText,
        job_description: jobDescription,
        candidate_id: candidateId,
      }),
    });
    if (!res.ok) throw new Error("Summary failed");
    return res.json();
  }

  async analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
    const res = await fetch(`${BASE_URL}/match/analyze`, {
      method: "POST", headers: this.h(),
      body: JSON.stringify({ resume_text: resumeText }),
    });
    if (!res.ok) throw new Error("Analysis failed");
    return res.json();
  }

<<<<<<< HEAD
  private _fallbackAnalysis(text: string, s: AISummary): ResumeAnalysis {
    const words = text.toLowerCase().split(/\s+/);
    const skills: string[] = [];
    ["python","java","javascript","react","sql","aws","docker","machine learning","nlp","data science","fastapi","node","typescript","kubernetes"].forEach(sk => {
      if (words.some(w => w.includes(sk.split(" ")[0]))) skills.push(sk);
    });
    return {
      candidate_name: "Candidate",
      summary: s.summary,
      top_skills: skills.slice(0, 6),
      experience_level: s.fit_score > 70 ? "Senior" : s.fit_score > 45 ? "Mid-level" : "Junior",
      suggested_roles: s.strengths.slice(0, 3).map((st, i) => ({
        role: st.split(" ").slice(0, 4).join(" "),
        match_reason: `Based on your profile analysis`,
        fit_level: (["Excellent","Good","Fair"] as const)[i] || "Fair",
      })),
      strengths: s.strengths,
      areas_to_improve: s.gaps,
    };
  }

  async uploadResume(file: File): Promise<{ message: string; id?: string; preview?: string }> {
=======
  /**
   * Upload a PDF to backend — backend extracts clean text via pypdf.
   * Returns: id, message, raw_text (clean English), preview
   */
  async uploadResume(file: File): Promise<{
    message: string;
    id: string;
    raw_text: string;
    preview: string;
  }> {
>>>>>>> 0c418cb (updated ai workflow)
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/ingest/resume/upload`, {
      method: "POST",
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  }

  /**
   * Extract clean text from a PDF without indexing it.
   * Used by AI Analysis page.
   */
  async extractTextFromFile(file: File): Promise<{ text: string; preview: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/ingest/resume/extract-text`, {
      method: "POST",
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Text extraction failed");
    }
    return res.json();
  }

  async extractText(file: File): Promise<{ text: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/ingest/extract`, {
      method: "POST",
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error("Extraction failed");
    return res.json();
  }

  async bulkIngestResumes() {
    const res = await fetch(`${BASE_URL}/ingest/resumes/bulk`, { method: "POST", headers: this.h() });
    if (!res.ok) throw new Error("Bulk ingest failed");
    return res.json();
  }

  // ── Local resume library (localStorage) ──────────────────────────────────────
  getResumeLibrary(): StoredResume[] {
    try { return JSON.parse(localStorage.getItem("resume_library") || "[]"); }
    catch { return []; }
  }

  addToLibrary(r: StoredResume) {
    const lib = this.getResumeLibrary();
    lib.unshift(r);
    localStorage.setItem("resume_library", JSON.stringify(lib));
  }

  removeFromLibrary(id: string) {
    const lib = this.getResumeLibrary().filter(r => r.id !== id);
    localStorage.setItem("resume_library", JSON.stringify(lib));
  }

  toggleShortlist(id: string) {
    const lib = this.getResumeLibrary();
    const idx = lib.findIndex(r => r.id === id);
    if (idx !== -1) {
      lib[idx].shortlisted = !lib[idx].shortlisted;
      localStorage.setItem("resume_library", JSON.stringify(lib));
    }
  }
}

export const api = new ApiClient();
api.loadToken();