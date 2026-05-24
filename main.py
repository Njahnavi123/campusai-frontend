import sqlite3
import bcrypt
import os
import base64
import uuid
import threading
import time
from datetime import datetime, timedelta

from flask import (
    Flask, render_template, request,
    redirect, session, jsonify
)

# ── ML matcher (pure scikit-learn, no API key needed) ──────
from matcher import find_matches, find_matches_for_item

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "campusai_secret_2025")

ADMIN_EMAIL    = "admin@campusai.edu"
ADMIN_PASSWORD = "admin123"

# ─── Auto-escalation config ────────────────────────────────
ESCALATION_DAYS = 3
ESCALATION_CHECK_INTERVAL = 3600

# ─── Category → Assignee options mapping ───────────────────
CATEGORY_ASSIGNEES = {
    "Infrastructure / IT":  ["IT Department", "Network Team", "Maintenance"],
    "Academic":             ["Academic Office", "Dean of Studies", "Department Head"],
    "Hostel":               ["Hostel Warden", "Hostel Management", "Maintenance"],
    "Canteen / Food":       ["Canteen Management", "Food Committee", "Admin Office"],
    "Transport":            ["Transport Office", "Fleet Manager"],
    "Medical / Health":     ["Medical Center", "Campus Doctor", "Health Committee"],
    "Fee / Finance":        ["Finance Office", "Accounts Department"],
    "Harassment / Conduct": ["Grievance Cell", "Dean of Students", "POSH Committee"],
    "Sports / Facilities":  ["Sports Department", "Facilities Manager"],
    "Administration":       ["Admin Office", "Principal Office", "Registrar"],
}
ALL_ASSIGNEES = sorted({a for opts in CATEGORY_ASSIGNEES.values() for a in opts})

UPLOAD_FOLDER = os.path.join("static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── DB ────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect("campusai.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur  = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT    NOT NULL,
            last_name  TEXT    DEFAULT '',
            email      TEXT    UNIQUE NOT NULL,
            roll       TEXT    DEFAULT '',
            department TEXT    DEFAULT '',
            password   TEXT    NOT NULL,
            role       TEXT    DEFAULT 'student'
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS grievances (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL,
            category      TEXT    DEFAULT '',
            subject       TEXT    DEFAULT '',
            priority      TEXT    DEFAULT 'Medium',
            description   TEXT    DEFAULT '',
            location      TEXT    DEFAULT '',
            incident_date TEXT    DEFAULT '',
            status        TEXT    DEFAULT 'pending',
            assigned_to   TEXT    DEFAULT '—',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER,
            grievance_id INTEGER,
            message      TEXT,
            is_read      INTEGER DEFAULT 0,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id)      REFERENCES users(id),
            FOREIGN KEY (grievance_id) REFERENCES grievances(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            grievance_id INTEGER NOT NULL,
            user_id      INTEGER NOT NULL,
            body         TEXT    NOT NULL,
            is_admin     INTEGER DEFAULT 0,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (grievance_id) REFERENCES grievances(id),
            FOREIGN KEY (user_id)      REFERENCES users(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS votes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            grievance_id INTEGER NOT NULL,
            user_id      INTEGER NOT NULL,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(grievance_id, user_id),
            FOREIGN KEY (grievance_id) REFERENCES grievances(id),
            FOREIGN KEY (user_id)      REFERENCES users(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lost_found (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL,
            type          TEXT    NOT NULL CHECK(type IN ('lost','found')),
            title         TEXT    NOT NULL,
            category      TEXT    DEFAULT '',
            color         TEXT    DEFAULT '',
            brand         TEXT    DEFAULT '',
            description   TEXT    DEFAULT '',
            location      TEXT    DEFAULT '',
            date          TEXT    DEFAULT '',
            time          TEXT    DEFAULT '',
            image_path    TEXT    DEFAULT '',
            locker_number TEXT    DEFAULT '',
            private       INTEGER DEFAULT 0,
            status        TEXT    DEFAULT 'open',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id    TEXT    NOT NULL,
            sender_id    INTEGER NOT NULL,
            receiver_id  INTEGER NOT NULL,
            lf_item_id   INTEGER,
            body         TEXT    NOT NULL,
            is_read      INTEGER DEFAULT 0,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id)   REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id),
            FOREIGN KEY (lf_item_id)  REFERENCES lost_found(id)
        )
    """)

    # ── Migrations ──────────────────────────────────────────
    existing_grv = {row[1] for row in cur.execute("PRAGMA table_info(grievances)")}
    for col, defn in [
        ("priority",      "TEXT DEFAULT 'Medium'"),
        ("location",      "TEXT DEFAULT ''"),
        ("incident_date", "TEXT DEFAULT ''"),
        ("status",        "TEXT DEFAULT 'pending'"),
        ("assigned_to",   "TEXT DEFAULT '—'"),
        ("created_at",    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]:
        if col not in existing_grv:
            cur.execute(f"ALTER TABLE grievances ADD COLUMN {col} {defn}")

    existing_usr = {row[1] for row in cur.execute("PRAGMA table_info(users)")}
    for col, defn in [
        ("last_name",  "TEXT DEFAULT ''"),
        ("roll",       "TEXT DEFAULT ''"),
        ("department", "TEXT DEFAULT ''"),
        ("role",       "TEXT DEFAULT 'student'"),
    ]:
        if col not in existing_usr:
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")

    existing_lf = {row[1] for row in cur.execute("PRAGMA table_info(lost_found)")}
    if 'locker_number' not in existing_lf:
        cur.execute("ALTER TABLE lost_found ADD COLUMN locker_number TEXT DEFAULT ''")

    conn.commit()
    conn.close()


# ─── Auto-escalation background thread ─────────────────────
def auto_escalate_grievances():
    while True:
        try:
            cutoff     = datetime.utcnow() - timedelta(days=ESCALATION_DAYS)
            cutoff_str = cutoff.strftime('%Y-%m-%d %H:%M:%S')

            conn = get_db()
            cur  = conn.cursor()

            cur.execute("""
                SELECT id, user_id, subject, created_at
                FROM grievances
                WHERE status = 'pending' AND created_at <= ?
            """, (cutoff_str,))
            stale = cur.fetchall()

            for grv in stale:
                grv_id   = grv['id']
                owner_id = grv['user_id']
                subject  = grv['subject']

                cur.execute("UPDATE grievances SET status='escalated' WHERE id=?", (grv_id,))

                cur.execute("""
                    INSERT INTO notifications (user_id, grievance_id, message)
                    VALUES (?, ?, ?)
                """, (
                    owner_id, grv_id,
                    f"⏰ Your grievance '{subject}' was automatically escalated "
                    f"after {ESCALATION_DAYS} days without a response. "
                    f"The admin team has been alerted."
                ))

                cur.execute("""
                    INSERT INTO notifications (user_id, grievance_id, message)
                    VALUES (?, ?, ?)
                """, (
                    0, grv_id,
                    f"🔺 AUTO-ESCALATED: Grievance '{subject}' (GRV-{str(grv_id).zfill(4)}) "
                    f"was pending for {ESCALATION_DAYS}+ days and has been auto-escalated."
                ))

            if stale:
                conn.commit()
            conn.close()

        except Exception as e:
            print(f"[auto_escalate] Error: {e}")

        time.sleep(ESCALATION_CHECK_INTERVAL)


# ─── HOME ──────────────────────────────────────────────────
@app.route('/')
def home():
    msgs = session.pop('msgs', [])
    ctx  = dict(
        category_assignees=CATEGORY_ASSIGNEES,
        all_assignees=ALL_ASSIGNEES,
        msgs=msgs,
        escalation_days=ESCALATION_DAYS,
    )
    if 'user_id' in session:
        return render_template('index.html', logged_in=True,
            user_name=session.get('user_name',''),
            user_role=session.get('user_role','student'),
            user_id=session.get('user_id', 0),
            **ctx)
    return render_template('index.html', logged_in=False,
        user_name='', user_role='', user_id=None, **ctx)


# ─── REGISTER ──────────────────────────────────────────────
@app.route('/register', methods=['POST'])
def register():
    first_name = request.form.get('first_name','').strip()
    last_name  = request.form.get('last_name', '').strip()
    email      = request.form.get('email',     '').strip().lower()
    roll       = request.form.get('roll',      '').strip()
    department = request.form.get('department','').strip()
    password   = request.form.get('password',  '')

    if not first_name or not email or len(password) < 8:
        session['msgs'] = [('error','Fill all required fields. Password must be 8+ characters.')]
        return redirect('/')

    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email=?", (email,))
    if cur.fetchone():
        conn.close()
        session['msgs'] = [('error','Email already registered. Please sign in.')]
        return redirect('/')

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    cur.execute("""
        INSERT INTO users (first_name,last_name,email,roll,department,password,role)
        VALUES (?,?,?,?,?,?,'student')
    """, (first_name, last_name, email, roll, department, hashed))
    conn.commit(); conn.close()
    session['msgs'] = [('reg_ok', first_name)]
    return redirect('/')


# ─── LOGIN ─────────────────────────────────────────────────
@app.route('/login', methods=['POST'])
def login():
    email    = request.form.get('email',   '').strip().lower()
    password = request.form.get('password','')
    role_sel = request.form.get('role',    'student')

    if role_sel == 'admin':
        if email == ADMIN_EMAIL and password == ADMIN_PASSWORD:
            session.update(user_id=0, user_name='Admin', user_role='admin',
                           msgs=[('login_ok_admin','Admin')])
        else:
            session['msgs'] = [('error_login','Invalid admin credentials.')]
        return redirect('/')

    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email=?", (email,))
    user = cur.fetchone(); conn.close()
    if user:
        stored = user['password']
        if isinstance(stored, str): stored = stored.encode()
        if bcrypt.checkpw(password.encode(), stored):
            session.update(user_id=user['id'], user_name=user['first_name'],
                           user_role='student', msgs=[('login_ok', user['first_name'])])
            return redirect('/')

    session['msgs'] = [('error_login','Invalid email or password.')]
    return redirect('/')


# ─── SUBMIT GRIEVANCE ──────────────────────────────────────
@app.route('/submit_grievance', methods=['POST'])
def submit_grievance():
    if 'user_id' not in session or session.get('user_role') != 'student':
        session['msgs'] = [('error_login','Please log in as a student.')]
        return redirect('/')

    subject = request.form.get('subject','').strip()
    if not subject:
        session['msgs'] = [('error','Subject is required.')]
        return redirect('/')

    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO grievances
            (user_id,category,subject,priority,description,location,incident_date,status,assigned_to)
        VALUES (?,?,?,'Medium',?,?,?,'pending','—')
    """, (
        session['user_id'],
        request.form.get('category','').strip(),
        subject,
        request.form.get('description','').strip(),
        request.form.get('location','').strip(),
        request.form.get('incident_date','').strip(),
    ))
    conn.commit(); conn.close()
    session['msgs'] = [('grv_ok', subject)]
    return redirect('/')


# ─── API: ALL GRIEVANCES ────────────────────────────────────
@app.route('/api/grievances')
def api_grievances():
    if 'user_id' not in session:
        return jsonify([])
    uid  = session.get('user_id', 0)
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT g.id, g.user_id, g.category, g.subject, g.priority, g.description,
               g.location, g.incident_date, g.status, g.assigned_to,
               g.created_at, u.first_name, u.last_name,
               (SELECT COUNT(*) FROM votes   v WHERE v.grievance_id = g.id) AS vote_count,
               (SELECT COUNT(*) FROM comments c WHERE c.grievance_id = g.id) AS comment_count,
               (SELECT COUNT(*) FROM votes   v WHERE v.grievance_id = g.id AND v.user_id = ?) AS user_voted
        FROM grievances g JOIN users u ON g.user_id = u.id
        ORDER BY g.created_at DESC
    """, (uid,))
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])


# ─── API: MY GRIEVANCES ─────────────────────────────────────
@app.route('/api/my_grievances')
def api_my_grievances():
    if 'user_id' not in session or session.get('user_role') != 'student':
        return jsonify([])
    uid  = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT g.id, g.user_id, g.category, g.subject, g.priority, g.description,
               g.location, g.incident_date, g.status, g.assigned_to,
               g.created_at, u.first_name, u.last_name,
               (SELECT COUNT(*) FROM votes   v WHERE v.grievance_id = g.id) AS vote_count,
               (SELECT COUNT(*) FROM comments c WHERE c.grievance_id = g.id) AS comment_count,
               (SELECT COUNT(*) FROM votes   v WHERE v.grievance_id = g.id AND v.user_id = ?) AS user_voted
        FROM grievances g JOIN users u ON g.user_id = u.id
        WHERE g.user_id = ?
        ORDER BY g.created_at DESC
    """, (uid, uid))
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])


# ─── API: ASSIGNEES FOR CATEGORY ────────────────────────────
@app.route('/api/assignees')
def api_assignees():
    cat = request.args.get('category','')
    return jsonify(CATEGORY_ASSIGNEES.get(cat, ALL_ASSIGNEES))


# ─── API: UPDATE GRIEVANCE (admin) ──────────────────────────
@app.route('/api/grievance/<int:grv_id>/update', methods=['POST'])
def update_grievance(grv_id):
    if session.get('user_role') != 'admin':
        return jsonify({'error':'Unauthorized'}), 403
    data = request.get_json()
    conn = get_db(); cur = conn.cursor()

    if 'status' in data:
        new_status = data['status']
        cur.execute("SELECT subject, user_id FROM grievances WHERE id=?", (grv_id,))
        grievance = cur.fetchone()
        cur.execute("UPDATE grievances SET status=? WHERE id=?", (new_status, grv_id))

        if grievance:
            subject      = grievance['subject']
            owner_id     = grievance['user_id']
            status_label = new_status.replace('_', ' ').title()

            cur.execute("""
                INSERT INTO notifications (user_id, grievance_id, message)
                VALUES (?, ?, ?)
            """, (owner_id, grv_id,
                  f"Your grievance '{subject}' status has been updated to: {status_label}"))

            cur.execute("SELECT user_id FROM votes WHERE grievance_id=?", (grv_id,))
            voter_msg = (
                f"A grievance you upvoted ('{subject}') "
                f"has been updated to: {status_label}"
            )
            for row in cur.fetchall():
                if row['user_id'] != owner_id:
                    cur.execute("""
                        INSERT INTO notifications (user_id, grievance_id, message)
                        VALUES (?, ?, ?)
                    """, (row['user_id'], grv_id, voter_msg))

    if 'priority'    in data:
        cur.execute("UPDATE grievances SET priority=?    WHERE id=?", (data['priority'],    grv_id))
    if 'assigned_to' in data:
        cur.execute("UPDATE grievances SET assigned_to=? WHERE id=?", (data['assigned_to'], grv_id))

    conn.commit(); conn.close()
    return jsonify({'ok': True})


# ─── API: DELETE GRIEVANCE (admin) ──────────────────────────
@app.route('/api/grievance/<int:grv_id>/delete', methods=['DELETE'])
def delete_grievance(grv_id):
    if session.get('user_role') != 'admin':
        return jsonify({'error':'Unauthorized'}), 403
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM comments      WHERE grievance_id=?", (grv_id,))
    cur.execute("DELETE FROM votes         WHERE grievance_id=?", (grv_id,))
    cur.execute("DELETE FROM notifications WHERE grievance_id=?", (grv_id,))
    cur.execute("DELETE FROM grievances    WHERE id=?",           (grv_id,))
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'deleted_id': grv_id})


# ─── API: NOTIFICATIONS ─────────────────────────────────────
@app.route('/api/notifications')
def api_notifications():
    if 'user_id' not in session:
        return jsonify([])
    uid = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT * FROM notifications WHERE user_id=?
        ORDER BY created_at DESC
    """, (uid,))
    notifications = cur.fetchall()
    conn.close()
    return jsonify([dict(n) for n in notifications])


# ─── API: MARK NOTIFICATIONS READ ───────────────────────────
@app.route('/api/notifications/mark_read', methods=['POST'])
def mark_notifications_read():
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
    uid = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (uid,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


# ─── API: UNREAD NOTIFICATION COUNT ─────────────────────────
@app.route('/api/notifications/unread_count')
def unread_notification_count():
    if 'user_id' not in session:
        return jsonify({'count': 0})
    uid = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=? AND is_read=0",
        (uid,)
    )
    count = cur.fetchone()['cnt']
    conn.close()
    return jsonify({'count': count})


# ─── API: VOTE (toggle) — students only ─────────────────────
@app.route('/api/grievance/<int:grv_id>/vote', methods=['POST'])
def toggle_vote(grv_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
    if session.get('user_role') == 'admin':
        return jsonify({'error': 'Admins cannot vote on grievances'}), 403

    uid  = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT user_id FROM grievances WHERE id=?", (grv_id,))
    grv = cur.fetchone()
    if grv and grv['user_id'] == uid:
        conn.close()
        return jsonify({'error': 'You cannot upvote your own grievance'}), 403

    cur.execute("SELECT id FROM votes WHERE grievance_id=? AND user_id=?", (grv_id, uid))
    existing = cur.fetchone()
    if existing:
        cur.execute("DELETE FROM votes WHERE grievance_id=? AND user_id=?", (grv_id, uid))
        voted = False
    else:
        cur.execute("INSERT INTO votes (grievance_id, user_id) VALUES (?,?)", (grv_id, uid))
        voted = True
    cur.execute("SELECT COUNT(*) AS cnt FROM votes WHERE grievance_id=?", (grv_id,))
    count = cur.fetchone()['cnt']
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'voted': voted, 'vote_count': count})


# ─── API: COMMENTS ──────────────────────────────────────────
@app.route('/api/grievance/<int:grv_id>/comments')
def get_comments(grv_id):
    if 'user_id' not in session:
        return jsonify([])
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT c.id, c.body, c.is_admin, c.created_at,
               u.first_name, u.last_name, u.role
        FROM comments c JOIN users u ON c.user_id = u.id
        WHERE c.grievance_id = ?
        ORDER BY c.created_at ASC
    """, (grv_id,))
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/grievance/<int:grv_id>/comments', methods=['POST'])
def post_comment(grv_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
    if session.get('user_role') == 'admin':
        return jsonify({'error': 'Admins cannot comment on grievances'}), 403

    data = request.get_json()
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'Comment cannot be empty'}), 400
    if len(body) > 1000:
        return jsonify({'error': 'Comment too long (max 1000 chars)'}), 400

    uid = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO comments (grievance_id, user_id, body, is_admin)
        VALUES (?,?,?,0)
    """, (grv_id, uid, body))
    new_id = cur.lastrowid

    cur.execute("SELECT user_id, subject FROM grievances WHERE id=?", (grv_id,))
    grv = cur.fetchone()
    if grv and grv['user_id'] != uid:
        cur.execute("""
            INSERT INTO notifications (user_id, grievance_id, message)
            VALUES (?,?,?)
        """, (grv['user_id'], grv_id,
              f"New comment on your grievance '{grv['subject']}'."))

    conn.commit()
    cur.execute("""
        SELECT c.id, c.body, c.is_admin, c.created_at,
               u.first_name, u.last_name, u.role
        FROM comments c JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    """, (new_id,))
    comment = dict(cur.fetchone())
    conn.close()
    return jsonify({'ok': True, 'comment': comment})


# ─── API: ANALYTICS ─────────────────────────────────────────
@app.route('/api/analytics')
def api_analytics():
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401

    conn = get_db(); cur = conn.cursor()

    cur.execute("SELECT status, COUNT(*) AS cnt FROM grievances GROUP BY status")
    status_rows = {r['status']: r['cnt'] for r in cur.fetchall()}

    cur.execute("""
        SELECT category, COUNT(*) AS cnt FROM grievances
        WHERE category != '' GROUP BY category ORDER BY cnt DESC LIMIT 8
    """)
    cat_rows = cur.fetchall()

    cur.execute("""
        SELECT strftime('%Y-%m', created_at) AS month,
               COUNT(*) AS total,
               SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) AS resolved
        FROM grievances
        WHERE created_at >= date('now', '-6 months')
        GROUP BY month ORDER BY month ASC
    """)
    monthly_rows = cur.fetchall()

    cur.execute("SELECT priority, COUNT(*) AS cnt FROM grievances GROUP BY priority")
    prio_rows = {r['priority']: r['cnt'] for r in cur.fetchall()}

    cur.execute("""
        SELECT AVG(CAST(julianday('now') - julianday(created_at) AS REAL)) AS avg_days
        FROM grievances WHERE status='resolved'
    """)
    avg_row = cur.fetchone()
    avg_resolution = round(avg_row['avg_days'] or 0, 1)

    cur.execute("SELECT COUNT(*) AS cnt FROM notifications WHERE message LIKE '%AUTO-ESCALATED%'")
    auto_esc_count = cur.fetchone()['cnt']

    cur.execute("SELECT type, COUNT(*) AS cnt FROM lost_found GROUP BY type")
    lf_rows = {r['type']: r['cnt'] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) AS cnt FROM lost_found WHERE status='claimed'")
    lf_claimed = cur.fetchone()['cnt']

    cur.execute("""
        SELECT assigned_to, COUNT(*) AS cnt FROM grievances
        WHERE assigned_to != '—' AND assigned_to != ''
        GROUP BY assigned_to ORDER BY cnt DESC LIMIT 6
    """)
    assignee_rows = cur.fetchall()

    conn.close()

    return jsonify({
        'status': {
            'pending':   status_rows.get('pending', 0),
            'review':    status_rows.get('review', 0),
            'resolved':  status_rows.get('resolved', 0),
            'escalated': status_rows.get('escalated', 0),
        },
        'categories': [{'label': r['category'], 'count': r['cnt']} for r in cat_rows],
        'monthly': [{'month': r['month'], 'total': r['total'], 'resolved': r['resolved']} for r in monthly_rows],
        'priority': {
            'Low':    prio_rows.get('Low', 0),
            'Medium': prio_rows.get('Medium', 0),
            'High':   prio_rows.get('High', 0),
        },
        'avg_resolution_days': avg_resolution,
        'auto_escalated':      auto_esc_count,
        'lf': {
            'lost':    lf_rows.get('lost', 0),
            'found':   lf_rows.get('found', 0),
            'claimed': lf_claimed,
        },
        'assignees': [{'label': r['assigned_to'], 'count': r['cnt']} for r in assignee_rows],
    })


# ══════════════════════════════════════════════════════════════
# ANONYMOUS MESSAGING SYSTEM  ── FIXED
# ══════════════════════════════════════════════════════════════

def _make_thread_id(user_a, user_b, lf_item_id):
    """Deterministic thread ID — same two users + same item always get same thread."""
    ids = sorted([int(user_a), int(user_b)])
    return f"lf{lf_item_id}-u{ids[0]}-u{ids[1]}"


@app.route('/api/messages/send', methods=['POST'])
def send_message():
    """
    Send the FIRST message about a lost/found item (creates the thread).
    If a thread already exists between these two users for this item,
    the message is added to the existing thread instead of creating a duplicate.
    Body: { lf_item_id, body }
    """
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401

    data       = request.get_json() or {}
    lf_item_id = data.get('lf_item_id')
    body       = (data.get('body') or '').strip()

    if not lf_item_id or not body:
        return jsonify({'error': 'lf_item_id and body are required'}), 400
    if len(body) > 1000:
        return jsonify({'error': 'Message too long (max 1000 chars)'}), 400

    sender_id = session['user_id']
    conn = get_db(); cur = conn.cursor()

    # Look up the item — receiver is always the item owner
    cur.execute("SELECT user_id, title, type FROM lost_found WHERE id=?", (lf_item_id,))
    item = cur.fetchone()
    if not item:
        conn.close()
        return jsonify({'error': 'Item not found'}), 404

    receiver_id = item['user_id']
    if receiver_id == sender_id:
        conn.close()
        return jsonify({'error': 'You cannot message yourself'}), 400

    # Build deterministic thread_id
    thread_id = _make_thread_id(sender_id, receiver_id, lf_item_id)

    # Check if thread already exists — if so, just add the message (no duplicate thread)
    cur.execute(
        "SELECT id FROM messages WHERE thread_id = ? LIMIT 1",
        (thread_id,)
    )
    thread_exists = cur.fetchone() is not None

    # Insert the message
    cur.execute("""
        INSERT INTO messages (thread_id, sender_id, receiver_id, lf_item_id, body)
        VALUES (?, ?, ?, ?, ?)
    """, (thread_id, sender_id, receiver_id, lf_item_id, body))

    # Only notify the receiver if this is a brand-new thread
    if not thread_exists:
        item_type  = item['type']
        item_title = item['title']
        cur.execute("""
            INSERT INTO notifications (user_id, grievance_id, message)
            VALUES (?, NULL, ?)
        """, (
            receiver_id,
            f"💬 You have a new anonymous message about your {item_type} item "
            f"'{item_title}'. Go to Messages to reply."
        ))

    conn.commit()
    conn.close()
    return jsonify({'ok': True, 'thread_id': thread_id})


@app.route('/api/messages/reply', methods=['POST'])
def reply_message():
    """
    Send a reply within an existing thread.
    Body: { thread_id, body }
    """
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401

    data      = request.get_json() or {}
    thread_id = (data.get('thread_id') or '').strip()
    body      = (data.get('body') or '').strip()

    if not thread_id or not body:
        return jsonify({'error': 'thread_id and body are required'}), 400
    if len(body) > 1000:
        return jsonify({'error': 'Message too long (max 1000 chars)'}), 400

    sender_id = session['user_id']
    conn = get_db(); cur = conn.cursor()

    # Verify sender belongs to this thread and get the other participant
    cur.execute("""
        SELECT sender_id, receiver_id, lf_item_id FROM messages
        WHERE thread_id = ? AND (sender_id = ? OR receiver_id = ?)
        LIMIT 1
    """, (thread_id, sender_id, sender_id))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Thread not found or access denied'}), 404

    # The receiver of THIS reply is the other participant
    if existing['sender_id'] == sender_id:
        receiver_id = existing['receiver_id']
    else:
        receiver_id = existing['sender_id']

    lf_item_id = existing['lf_item_id']

    cur.execute("""
        INSERT INTO messages (thread_id, sender_id, receiver_id, lf_item_id, body)
        VALUES (?, ?, ?, ?, ?)
    """, (thread_id, sender_id, receiver_id, lf_item_id, body))

    # Notify the receiver of the reply
    cur.execute("SELECT title, type FROM lost_found WHERE id=?", (lf_item_id,))
    item_row = cur.fetchone()
    if item_row:
        cur.execute("""
            INSERT INTO notifications (user_id, grievance_id, message)
            VALUES (?, NULL, ?)
        """, (
            receiver_id,
            f"💬 New reply in your conversation about '{item_row['title']}'. Check Messages."
        ))

    conn.commit()
    conn.close()
    return jsonify({'ok': True, 'thread_id': thread_id})


@app.route('/api/messages/threads')
def list_threads():
    """
    List all message threads for the current user.
    FIXED: removed the broken CASE direction column that caused GROUP BY issues.
    """
    if 'user_id' not in session:
        return jsonify([])

    uid  = session['user_id']
    conn = get_db(); cur = conn.cursor()

    cur.execute("""
        SELECT
            m.thread_id,
            m.lf_item_id,
            lf.title      AS item_title,
            lf.type       AS item_type,
            lf.image_path AS item_image,
            MAX(m.created_at) AS last_at,
            COUNT(*)          AS msg_count,
            SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread
        FROM messages m
        LEFT JOIN lost_found lf ON m.lf_item_id = lf.id
        WHERE m.sender_id = ? OR m.receiver_id = ?
        GROUP BY m.thread_id
        ORDER BY last_at DESC
    """, (uid, uid, uid))

    threads = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(threads)


@app.route('/api/messages/thread/<thread_id>')
def get_thread(thread_id):
    """Get all messages in a thread. Marks received messages as read."""
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401

    uid  = session['user_id']
    conn = get_db(); cur = conn.cursor()

    # Verify user belongs to this thread
    cur.execute("""
        SELECT id FROM messages
        WHERE thread_id = ? AND (sender_id = ? OR receiver_id = ?)
        LIMIT 1
    """, (thread_id, uid, uid))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': 'Thread not found'}), 404

    # Mark all messages received by this user in this thread as read
    cur.execute("""
        UPDATE messages SET is_read = 1
        WHERE thread_id = ? AND receiver_id = ?
    """, (thread_id, uid))

    # Fetch messages — 'me' or 'them' author label (never expose real identity)
    cur.execute("""
        SELECT m.id, m.body, m.created_at, m.is_read,
               CASE WHEN m.sender_id = ? THEN 'me' ELSE 'them' END AS author,
               m.lf_item_id
        FROM messages m
        WHERE m.thread_id = ?
        ORDER BY m.created_at ASC
    """, (uid, thread_id))
    messages = [dict(r) for r in cur.fetchall()]

    # Fetch item context for the chat header
    item = {}
    if messages:
        cur.execute("""
            SELECT id, title, type, image_path, status
            FROM lost_found WHERE id = ?
        """, (messages[0]['lf_item_id'],))
        item_row = cur.fetchone()
        if item_row:
            item = dict(item_row)

    conn.commit()
    conn.close()
    return jsonify({'messages': messages, 'item': item})


@app.route('/api/messages/unread_count')
def messages_unread_count():
    if 'user_id' not in session:
        return jsonify({'count': 0})
    uid  = session['user_id']
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM messages WHERE receiver_id = ? AND is_read = 0",
        (uid,)
    )
    count = cur.fetchone()['cnt']
    conn.close()
    return jsonify({'count': count})


# ══════════════════════════════════════════════════════════════
# LOST & FOUND APIs
# ══════════════════════════════════════════════════════════════

def _lf_rows_as_dicts(cur):
    return [dict(r) for r in cur.fetchall()]


@app.route('/api/lf/submit', methods=['POST'])
def api_lf_submit():
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401

    data = request.get_json(force=True) or {}

    item_type     = (data.get('type') or '').strip().lower()
    title         = (data.get('title') or '').strip()
    category      = (data.get('category') or '').strip()
    color         = (data.get('color') or '').strip()
    brand         = (data.get('brand') or '').strip()
    description   = (data.get('description') or '').strip()
    location      = (data.get('location') or '').strip()
    date          = (data.get('date') or '').strip()
    time_         = (data.get('time') or '').strip()
    locker_number = (data.get('locker_number') or '').strip()
    private_      = 1 if data.get('private') else 0
    image_data    = (data.get('image') or '').strip()

    if item_type not in ('lost', 'found'):
        return jsonify({'error': 'Invalid type'}), 400
    if not title:
        return jsonify({'error': 'Item name is required'}), 400
    if item_type == 'found' and not image_data:
        return jsonify({'error': 'A photo is required for found items'}), 400

    image_path = ''
    if image_data and image_data.startswith('data:'):
        try:
            header, b64 = image_data.split(',', 1)
            ext = 'jpg'
            if 'png'  in header: ext = 'png'
            elif 'gif'  in header: ext = 'gif'
            elif 'webp' in header: ext = 'webp'
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(b64))
            image_path = f"/static/uploads/{filename}"
        except Exception as e:
            return jsonify({'error': f'Image save failed: {e}'}), 500

    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO lost_found
            (user_id, type, title, category, color, brand, description,
             location, date, time, image_path, locker_number, private, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'open')
    """, (
        session['user_id'], item_type, title, category, color, brand,
        description, location, date, time_, image_path, locker_number, private_
    ))
    new_id = cur.lastrowid
    conn.commit()

    cur.execute("""
        SELECT lf.*, u.first_name, u.last_name
        FROM lost_found lf JOIN users u ON lf.user_id = u.id
        WHERE lf.id = ?
    """, (new_id,))
    new_item = dict(cur.fetchone())

    # ML matching
    opposite = 'found' if item_type == 'lost' else 'lost'
    cur.execute("SELECT * FROM lost_found WHERE type=? AND status='open'", (opposite,))
    candidates = _lf_rows_as_dicts(cur)
    instant_matches = find_matches_for_item(new_item, candidates)

    if instant_matches and instant_matches[0]['score'] >= 60:
        top = instant_matches[0]

        cur.execute("""
            INSERT INTO notifications (user_id, grievance_id, message)
            VALUES (?, NULL, ?)
        """, (session['user_id'],
              f"🤖 AI found a potential match ({top['score']}% confidence) "
              f"for your {item_type} item '{title}'. Check AI Matches!"))

        matched_item_id = top.get('found_id') if item_type == 'lost' else top.get('lost_id')
        matched_title   = top.get('found_title', '') if item_type == 'lost' else top.get('lost_title', '')

        if matched_item_id:
            cur.execute("SELECT user_id FROM lost_found WHERE id=?", (matched_item_id,))
            matched_owner = cur.fetchone()
            if matched_owner and matched_owner['user_id'] != session['user_id']:
                cur.execute("""
                    INSERT INTO notifications (user_id, grievance_id, message)
                    VALUES (?, NULL, ?)
                """, (matched_owner['user_id'],
                      f"🤖 Good news! A new {item_type} item '{title}' was posted "
                      f"that may match your {opposite} item '{matched_title}' "
                      f"({top['score']}% confidence). Check AI Matches!"))
        conn.commit()

    conn.close()
    return jsonify({
        'ok': True,
        'item': new_item,
        'instant_matches': len(instant_matches),
    })


@app.route('/api/lf/items')
def api_lf_items():
    if 'user_id' not in session:
        return jsonify([])
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT lf.*, u.first_name, u.last_name
        FROM lost_found lf JOIN users u ON lf.user_id = u.id
        ORDER BY lf.created_at DESC
    """)
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/lf/matches')
def api_lf_matches():
    if 'user_id' not in session:
        return jsonify([])
    if session.get('user_role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    min_score = int(request.args.get('min_score', 35))
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM lost_found WHERE type='lost'  AND status='open'")
    lost_items  = _lf_rows_as_dicts(cur)
    cur.execute("SELECT * FROM lost_found WHERE type='found' AND status='open'")
    found_items = _lf_rows_as_dicts(cur)
    conn.close()

    matches = find_matches(lost_items, found_items)
    matches = [m for m in matches if m['score'] >= min_score]
    return jsonify(matches)


@app.route('/api/lf/<int:item_id>/matches')
def api_lf_item_matches(item_id):
    if 'user_id' not in session:
        return jsonify([])
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM lost_found WHERE id=?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Item not found'}), 404

    item     = dict(row)
    opposite = 'found' if item['type'] == 'lost' else 'lost'
    cur.execute(
        "SELECT * FROM lost_found WHERE type=? AND status='open' AND id!=?",
        (opposite, item_id)
    )
    candidates = _lf_rows_as_dicts(cur)
    conn.close()
    return jsonify(find_matches_for_item(item, candidates))


@app.route('/api/lf/confirm_match', methods=['POST'])
def api_lf_confirm_match():
    if session.get('user_role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    data     = request.get_json() or {}
    lost_id  = data.get('lost_id')
    found_id = data.get('found_id')
    if not lost_id or not found_id:
        return jsonify({'error': 'lost_id and found_id are required'}), 400

    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE lost_found SET status='claimed' WHERE id=?", (lost_id,))
    cur.execute("UPDATE lost_found SET status='claimed' WHERE id=?", (found_id,))

    cur.execute("SELECT user_id, title FROM lost_found WHERE id=?", (lost_id,))
    lost_row = cur.fetchone()
    cur.execute("SELECT user_id, title, locker_number FROM lost_found WHERE id=?", (found_id,))
    found_row = cur.fetchone()

    if lost_row:
        locker_hint = ''
        if found_row and found_row['locker_number']:
            locker_hint = f" It has been deposited in locker #{found_row['locker_number']}."
        cur.execute("""
            INSERT INTO notifications (user_id, grievance_id, message)
            VALUES (?, NULL, ?)
        """, (lost_row['user_id'],
              f"🎉 Great news! Your lost item '{lost_row['title']}' has been found. "
              f"An AI match was confirmed by the admin.{locker_hint} "
              f"Please visit the Lost & Found desk to claim it."))

    if found_row and lost_row and found_row['user_id'] != lost_row['user_id']:
        cur.execute("""
            INSERT INTO notifications (user_id, grievance_id, message)
            VALUES (?, NULL, ?)
        """, (found_row['user_id'],
              f"✅ The item you found ('{found_row['title']}') has been matched with its owner "
              f"and both items are now marked as claimed. Thank you for helping!"))

    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.route('/api/lf/<int:item_id>/delete', methods=['DELETE'])
def api_lf_delete(item_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT user_id FROM lost_found WHERE id=?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    if session.get('user_role') != 'admin' and row['user_id'] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized'}), 403
    cur.execute("DELETE FROM lost_found WHERE id=?", (item_id,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.route('/api/lf/<int:item_id>/status', methods=['POST'])
def api_lf_status(item_id):
    if session.get('user_role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data   = request.get_json()
    status = data.get('status', 'open')
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE lost_found SET status=? WHERE id=?", (status, item_id))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


# ─── LOGOUT ─────────────────────────────────────────────────
@app.route('/logout')
def logout():
    session.clear()
    session['msgs'] = [('info','You have been logged out.')]
    return redirect('/')


if __name__ == '__main__':
    init_db()

    escalator = threading.Thread(target=auto_escalate_grievances, daemon=True)
    escalator.start()
    print(f"[auto_escalate] Started — checking every {ESCALATION_CHECK_INTERVAL}s, "
          f"threshold={ESCALATION_DAYS} days")

    app.run(debug=True)