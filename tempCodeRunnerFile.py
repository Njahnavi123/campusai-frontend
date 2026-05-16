import sqlite3
import bcrypt
import os
import base64
import uuid

from flask import (
    Flask, render_template, request,
    redirect, session, jsonify
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "campusai_secret_2025")

ADMIN_EMAIL    = "admin@campusai.edu"
ADMIN_PASSWORD = "admin123"

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

# ─── DB ────────────────────────────────
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

    # ── Lost & Found table ──────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lost_found (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            type        TEXT    NOT NULL CHECK(type IN ('lost','found')),
            title       TEXT    NOT NULL,
            category    TEXT    DEFAULT '',
            color       TEXT    DEFAULT '',
            brand       TEXT    DEFAULT '',
            description TEXT    DEFAULT '',
            location    TEXT    DEFAULT '',
            date        TEXT    DEFAULT '',
            time        TEXT    DEFAULT '',
            image_path  TEXT    DEFAULT '',
            private     INTEGER DEFAULT 0,
            status      TEXT    DEFAULT 'open',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # ── Migrations ───────────────────────────────────────────
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

    conn.commit()
    conn.close()


# ─── HOME ──────────────────────────────
@app.route('/')
def home():
    msgs = session.pop('msgs', [])
    ctx  = dict(
        category_assignees=CATEGORY_ASSIGNEES,
        all_assignees=ALL_ASSIGNEES,
        msgs=msgs,
    )
    if 'user_id' in session:
        return render_template('index.html', logged_in=True,
            user_name=session.get('user_name',''),
            user_role=session.get('user_role','student'),
            user_id=session.get('user_id', 0),
            **ctx)
    return render_template('index.html', logged_in=False,
        user_name='', user_role='', user_id=None,
        **ctx)


# ─── REGISTER ──────────────────────────
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


# ─── LOGIN ─────────────────────────────
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


# ─── SUBMIT GRIEVANCE ──────────────────
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


# ─── API: ALL GRIEVANCES ───────────────
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


# ─── API: MY GRIEVANCES ────────────────
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


# ─── API: ASSIGNEES FOR CATEGORY ───────
@app.route('/api/assignees')
def api_assignees():
    cat = request.args.get('category','')
    return jsonify(CATEGORY_ASSIGNEES.get(cat, ALL_ASSIGNEES))


# ─── API: UPDATE GRIEVANCE (admin) ─────
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
            subject = grievance['subject']
            user_id = grievance['user_id']
            msg = f"Your grievance '{subject}' is now {new_status.title()}"
            cur.execute("""
                INSERT INTO notifications (user_id, grievance_id, message)
                VALUES (?, ?, ?)
            """, (user_id, grv_id, msg))
    if 'priority'    in data: cur.execute("UPDATE grievances SET priority=?    WHERE id=?", (data['priority'],    grv_id))
    if 'assigned_to' in data: cur.execute("UPDATE grievances SET assigned_to=? WHERE id=?", (data['assigned_to'], grv_id))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


# ─── API: DELETE GRIEVANCE (admin) ─────
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


# ─── API: NOTIFICATIONS ────────────────
@app.route('/api/notifications')
def api_notifications():
    if 'user_id' not in session:
        return jsonify([])
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT * FROM notifications WHERE user_id=?
        ORDER BY created_at DESC
    """, (session['user_id'],))
    notifications = cur.fetchall()
    conn.close()
    return jsonify([dict(n) for n in notifications])


# ─── API: VOTE (toggle) ────────────────
@app.route('/api/grievance/<int:grv_id>/vote', methods=['POST'])
def toggle_vote(grv_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
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


# ─── API: COMMENTS ────────────────────
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
    data = request.get_json()
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'Comment cannot be empty'}), 400
    if len(body) > 1000:
        return jsonify({'error': 'Comment too long (max 1000 chars)'}), 400

    uid      = session['user_id']
    is_admin = 1 if session.get('user_role') == 'admin' else 0

    conn = get_db(); cur = conn.cursor()

    if uid == 0:
        cur.execute("SELECT id FROM users WHERE email=?", (ADMIN_EMAIL,))
        row = cur.fetchone()
        if row:
            uid = row['id']
        else:
            hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt())
            cur.execute("""
                INSERT INTO users (first_name, last_name, email, password, role)
                VALUES ('Admin','','admin@campusai.edu',?,'admin')
            """, (hashed,))
            uid = cur.lastrowid

    cur.execute("""
        INSERT INTO comments (grievance_id, user_id, body, is_admin)
        VALUES (?,?,?,?)
    """, (grv_id, uid, body, is_admin))
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


# ══════════════════════════════════════════════════════════════
# LOST & FOUND APIs
# ══════════════════════════════════════════════════════════════

# ─── API: SUBMIT LOST / FOUND ITEM ────
@app.route('/api/lf/submit', methods=['POST'])
def api_lf_submit():
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401

    # Accept JSON body (image sent as base64 dataURL)
    data = request.get_json(force=True) or {}

    item_type   = (data.get('type') or '').strip().lower()
    title       = (data.get('title') or '').strip()
    category    = (data.get('category') or '').strip()
    color       = (data.get('color') or '').strip()
    brand       = (data.get('brand') or '').strip()
    description = (data.get('description') or '').strip()
    location    = (data.get('location') or '').strip()
    date        = (data.get('date') or '').strip()
    time_       = (data.get('time') or '').strip()
    private_    = 1 if data.get('private') else 0
    image_data  = (data.get('image') or '').strip()   # base64 dataURL

    if item_type not in ('lost', 'found'):
        return jsonify({'error': 'Invalid type'}), 400
    if not title:
        return jsonify({'error': 'Item name is required'}), 400
    if item_type == 'found' and not image_data:
        return jsonify({'error': 'A photo is required for found items'}), 400

    # Save image to disk if provided
    image_path = ''
    if image_data and image_data.startswith('data:'):
        try:
            header, b64 = image_data.split(',', 1)
            ext = 'jpg'
            if 'png' in header:
                ext = 'png'
            elif 'gif' in header:
                ext = 'gif'
            elif 'webp' in header:
                ext = 'webp'
            filename   = f"{uuid.uuid4().hex}.{ext}"
            filepath   = os.path.join(UPLOAD_FOLDER, filename)
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(b64))
            image_path = f"/static/uploads/{filename}"
        except Exception as e:
            return jsonify({'error': f'Image save failed: {e}'}), 500

    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO lost_found
            (user_id, type, title, category, color, brand, description,
             location, date, time, image_path, private, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'open')
    """, (
        session['user_id'], item_type, title, category, color, brand,
        description, location, date, time_, image_path, private_
    ))
    new_id = cur.lastrowid
    conn.commit()

    # Fetch the inserted row with user info
    cur.execute("""
        SELECT lf.*, u.first_name, u.last_name
        FROM lost_found lf JOIN users u ON lf.user_id = u.id
        WHERE lf.id = ?
    """, (new_id,))
    row = dict(cur.fetchone())
    conn.close()
    return jsonify({'ok': True, 'item': row})


# ─── API: GET ALL LOST & FOUND ITEMS ──
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


# ─── API: DELETE LF ITEM (admin or owner) ─
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


# ─── API: UPDATE LF STATUS (admin) ────
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


# ─── LOGOUT ────────────────────────────
@app.route('/logout')
def logout():
    session.clear()
    session['msgs'] = [('info','You have been logged out.')]
    return redirect('/')


if __name__ == '__main__':
    init_db()
    app.run(debug=True)