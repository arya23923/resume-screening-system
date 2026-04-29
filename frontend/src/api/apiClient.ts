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

  // ── Shortlist API ────────────────────────────────────────────────────────────
  async getShortlists(): Promise<Shortlist[]> {
    const res = await fetch(`${BASE_URL}/shortlist/`, { headers: this.h() });
    if (!res.ok) throw new Error("Failed to load shortlists");
    return res.json();
  }

  async createShortlist(job_title: string, job_desc?: string): Promise<Shortlist> {
    const res = await fetch(`${BASE_URL}/shortlist/`, {
      method: "POST", headers: this.h(),
      body: JSON.stringify({ job_title, job_desc: job_desc || "" }),
    });
    if (!res.ok) throw new Error("Failed to create shortlist");
    return res.json();
  }

  async getShortlist(id: number): Promise<Shortlist> {
    const res = await fetch(`${BASE_URL}/shortlist/${id}`, { headers: this.h() });
    if (!res.ok) throw new Error("Shortlist not found");
    return res.json();
  }

  async deleteShortlist(id: number): Promise<void> {
    await fetch(`${BASE_URL}/shortlist/${id}`, { method: "DELETE", headers: this.h() });
  }

  async addToShortlist(slId: number, data: {
    candidate_id: string; candidate_name: string; filename: string;
    category: string; match_score: number; fit_score: number;
    recommendation: string; preview: string; notes?: string;
  }): Promise<ShortlistedCandidate> {
    const res = await fetch(`${BASE_URL}/shortlist/${slId}/candidates`, {
      method: "POST", headers: this.h(), body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to add candidate");
    }
    return res.json();
  }

  async updateShortlistCandidate(slId: number, cId: number, data: {
    status?: string; notes?: string;
  }): Promise<ShortlistedCandidate> {
    const res = await fetch(`${BASE_URL}/shortlist/${slId}/candidates/${cId}`, {
      method: "PATCH", headers: this.h(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  }

  async removeFromShortlist(slId: number, cId: number): Promise<void> {
    await fetch(`${BASE_URL}/shortlist/${slId}/candidates/${cId}`, {
      method: "DELETE", headers: this.h()
    });
  }

  async getShortlistStats(): Promise<{ total_shortlists: number; total_candidates: number; by_status: Record<string,number> }> {
    const res = await fetch(`${BASE_URL}/shortlist/stats/overview`, { headers: this.h() });
    if (!res.ok) throw new Error("Failed to load stats");
    return res.json();
  }

}

export const api = new ApiClient();
api.loadToken();

// ── Shortlist types ──────────────────────────────────────────────────────────
export interface ShortlistedCandidate {
  id: number;
  shortlist_id: number;
  candidate_id: string;
  candidate_name: string;
  filename: string;
  category: string;
  match_score: number;
  fit_score: number;
  recommendation: string;
  preview: string;
  notes: string;
  status: "pending" | "interviewed" | "accepted" | "rejected";
  shortlisted_by: string;
  shortlisted_at: string;
  updated_at: string;
}

export interface Shortlist {
  id: number;
  job_title: string;
  job_desc?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  candidates?: ShortlistedCandidate[];
  total?: number;
  pending?: number;
  accepted?: number;
  rejected?: number;
  interviewed?: number;
}
