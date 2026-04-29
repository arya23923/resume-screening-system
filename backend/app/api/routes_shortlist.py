"""
Shortlisting routes — full CRUD with SQLite persistence.
HR can shortlist candidates from match results, add notes, track status,
and view the complete shortlist pipeline.
"""
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.api.routes_auth import get_current_user
from app.core.config import BASE_DIR

router = APIRouter()

# ── DB path ──────────────────────────────────────────────────────────────────
DB_PATH = BASE_DIR / "data" / "shortlist.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS shortlists (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            job_title   TEXT NOT NULL,
            job_desc    TEXT,
            created_by  TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shortlisted_candidates (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            shortlist_id    INTEGER NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
            candidate_id    TEXT NOT NULL,
            candidate_name  TEXT,
            filename        TEXT,
            category        TEXT,
            match_score     REAL,
            fit_score       REAL,
            recommendation  TEXT,
            preview         TEXT,
            notes           TEXT DEFAULT '',
            status          TEXT DEFAULT 'pending',
            shortlisted_by  TEXT NOT NULL,
            shortlisted_at  TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            UNIQUE(shortlist_id, candidate_id)
        );
    """)
    conn.commit()
    conn.close()


init_db()


# ── Schemas ──────────────────────────────────────────────────────────────────
class CreateShortlistRequest(BaseModel):
    job_title: str
    job_desc: Optional[str] = ""


class AddCandidateRequest(BaseModel):
    candidate_id: str
    candidate_name: Optional[str] = ""
    filename: Optional[str] = ""
    category: Optional[str] = ""
    match_score: Optional[float] = 0.0
    fit_score: Optional[float] = 0.0
    recommendation: Optional[str] = ""
    preview: Optional[str] = ""
    notes: Optional[str] = ""


class UpdateCandidateRequest(BaseModel):
    status: Optional[str] = None   # pending | interviewed | accepted | rejected
    notes: Optional[str] = None


class ShortlistSummary(BaseModel):
    id: int
    job_title: str
    created_by: str
    created_at: str
    total: int
    pending: int
    accepted: int
    rejected: int
    interviewed: int


# ── Helpers ──────────────────────────────────────────────────────────────────
def row_to_dict(row):
    return dict(row) if row else None


VALID_STATUSES = {"pending", "interviewed", "accepted", "rejected"}


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_shortlists(current_user: dict = Depends(get_current_user)):
    """List all shortlists with summary counts."""
    conn = get_db()
    rows = conn.execute("""
        SELECT s.id, s.job_title, s.created_by, s.created_at,
               COUNT(c.id) as total,
               SUM(CASE WHEN c.status='pending' THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN c.status='accepted' THEN 1 ELSE 0 END) as accepted,
               SUM(CASE WHEN c.status='rejected' THEN 1 ELSE 0 END) as rejected,
               SUM(CASE WHEN c.status='interviewed' THEN 1 ELSE 0 END) as interviewed
        FROM shortlists s
        LEFT JOIN shortlisted_candidates c ON c.shortlist_id = s.id
        GROUP BY s.id
        ORDER BY s.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/", status_code=201)
def create_shortlist(body: CreateShortlistRequest, current_user: dict = Depends(get_current_user)):
    """Create a new shortlist for a job."""
    now = datetime.utcnow().isoformat()
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO shortlists (job_title, job_desc, created_by, created_at, updated_at) VALUES (?,?,?,?,?)",
        (body.job_title, body.job_desc, current_user["username"], now, now)
    )
    conn.commit()
    sl_id = cur.lastrowid
    row = conn.execute("SELECT * FROM shortlists WHERE id=?", (sl_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.get("/{sl_id}")
def get_shortlist(sl_id: int, current_user: dict = Depends(get_current_user)):
    """Get a shortlist with all candidates."""
    conn = get_db()
    sl = conn.execute("SELECT * FROM shortlists WHERE id=?", (sl_id,)).fetchone()
    if not sl:
        conn.close()
        raise HTTPException(404, "Shortlist not found")
    candidates = conn.execute(
        "SELECT * FROM shortlisted_candidates WHERE shortlist_id=? ORDER BY match_score DESC",
        (sl_id,)
    ).fetchall()
    conn.close()
    return {**row_to_dict(sl), "candidates": [dict(c) for c in candidates]}


@router.post("/{sl_id}/candidates", status_code=201)
def add_candidate(sl_id: int, body: AddCandidateRequest, current_user: dict = Depends(get_current_user)):
    """Add a candidate to a shortlist."""
    conn = get_db()
    sl = conn.execute("SELECT id FROM shortlists WHERE id=?", (sl_id,)).fetchone()
    if not sl:
        conn.close()
        raise HTTPException(404, "Shortlist not found")
    now = datetime.utcnow().isoformat()
    try:
        cur = conn.execute("""
            INSERT INTO shortlisted_candidates
              (shortlist_id, candidate_id, candidate_name, filename, category,
               match_score, fit_score, recommendation, preview, notes,
               status, shortlisted_by, shortlisted_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (sl_id, body.candidate_id, body.candidate_name, body.filename,
              body.category, body.match_score, body.fit_score, body.recommendation,
              body.preview, body.notes, "pending",
              current_user["username"], now, now))
        conn.commit()
        row = conn.execute("SELECT * FROM shortlisted_candidates WHERE id=?", (cur.lastrowid,)).fetchone()
        # Update shortlist updated_at
        conn.execute("UPDATE shortlists SET updated_at=? WHERE id=?", (now, sl_id))
        conn.commit()
        conn.close()
        return dict(row)
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(409, "Candidate already in this shortlist")


@router.patch("/{sl_id}/candidates/{cand_id}")
def update_candidate(sl_id: int, cand_id: int, body: UpdateCandidateRequest,
                     current_user: dict = Depends(get_current_user)):
    """Update status or notes for a shortlisted candidate."""
    if body.status and body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Use: {VALID_STATUSES}")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM shortlisted_candidates WHERE id=? AND shortlist_id=?",
        (cand_id, sl_id)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Candidate not found in this shortlist")
    now = datetime.utcnow().isoformat()
    new_status = body.status if body.status is not None else row["status"]
    new_notes = body.notes if body.notes is not None else row["notes"]
    conn.execute(
        "UPDATE shortlisted_candidates SET status=?, notes=?, updated_at=? WHERE id=?",
        (new_status, new_notes, now, cand_id)
    )
    conn.execute("UPDATE shortlists SET updated_at=? WHERE id=?", (now, sl_id))
    conn.commit()
    updated = conn.execute("SELECT * FROM shortlisted_candidates WHERE id=?", (cand_id,)).fetchone()
    conn.close()
    return dict(updated)


@router.delete("/{sl_id}/candidates/{cand_id}", status_code=204)
def remove_candidate(sl_id: int, cand_id: int, current_user: dict = Depends(get_current_user)):
    """Remove a candidate from a shortlist."""
    conn = get_db()
    conn.execute(
        "DELETE FROM shortlisted_candidates WHERE id=? AND shortlist_id=?",
        (cand_id, sl_id)
    )
    conn.commit()
    conn.close()
    return None


@router.delete("/{sl_id}", status_code=204)
def delete_shortlist(sl_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a shortlist and all its candidates."""
    conn = get_db()
    conn.execute("DELETE FROM shortlists WHERE id=?", (sl_id,))
    conn.commit()
    conn.close()
    return None


@router.get("/stats/overview")
def shortlist_stats(current_user: dict = Depends(get_current_user)):
    """Aggregate stats across all shortlists."""
    conn = get_db()
    total_sl = conn.execute("SELECT COUNT(*) FROM shortlists").fetchone()[0]
    total_c = conn.execute("SELECT COUNT(*) FROM shortlisted_candidates").fetchone()[0]
    by_status = conn.execute("""
        SELECT status, COUNT(*) as count FROM shortlisted_candidates GROUP BY status
    """).fetchall()
    conn.close()
    return {
        "total_shortlists": total_sl,
        "total_candidates": total_c,
        "by_status": {r["status"]: r["count"] for r in by_status},
    }
