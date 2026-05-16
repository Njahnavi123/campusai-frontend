/* ═══════════════════════════════════════
   THEME
═══════════════════════════════════════ */
(function () {
  const s = localStorage.getItem('campusai-theme');
  if (s) document.documentElement.setAttribute('data-theme', s);
})();

function toggleTheme() {
  const h = document.documentElement;
  const dark = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('campusai-theme', dark ? 'light' : 'dark');
  showToast(dark ? '☀️' : '🌙', dark ? 'Light mode on!' : 'Dark mode on!');
}

/* ═══════════════════════════════════════
   CATEGORY → ASSIGNEE MAP
═══════════════════════════════════════ */
const CATEGORY_ASSIGNEES = {
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
};
const ALL_ASSIGNEES = [...new Set(Object.values(CATEGORY_ASSIGNEES).flat())].sort();

function getAssignees(category) {
  return CATEGORY_ASSIGNEES[category] || ALL_ASSIGNEES;
}

function buildAssigneeOptions(category, current) {
  const opts = getAssignees(category);
  const unselected = !current || current === '—';
  let html = `<option value="—" ${unselected ? 'selected' : ''}>— Unassigned —</option>`;
  opts.forEach(o => {
    html += `<option value="${o}" ${current === o ? 'selected' : ''}>${o}</option>`;
  });
  if (current && current !== '—' && !opts.includes(current)) {
    html += `<option value="${current}" selected>${current}</option>`;
  }
  return html;
}

/* ═══════════════════════════════════════
   PAGE SYSTEM
═══════════════════════════════════════ */
const PAGES = ['landingPage','loginPage','registerPage','appSidebar','appMain'];

function showPage(name) {
  PAGES.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  if (name === 'landing') {
    document.getElementById('landingPage').style.display = 'block';
  } else if (name === 'login') {
    document.getElementById('loginPage').style.display = 'block';
    _clearAuthBanners();
  } else if (name === 'register') {
    document.getElementById('registerPage').style.display = 'block';
    _clearAuthBanners();
  } else if (name === 'app') {
    document.getElementById('appSidebar').style.display = 'flex';
    document.getElementById('appMain').style.display    = 'flex';
  }
  window.scrollTo(0, 0);
}

function _clearAuthBanners() {
  ['loginErrBox','loginSuccBox','regErrBox','regSuccBox'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

/* ═══════════════════════════════════════
   APP VIEW SWITCHING
═══════════════════════════════════════ */
const viewMeta = {
  grievances  : ['Grievance Management', 'Track and manage campus grievances'],
  'submit-grv': ['Submit a Grievance',   'File a new complaint'],
  'my-grv'    : ['My Grievances',        'Grievances you submitted'],
  'lf-browse' : ['Lost & Found',         'Browse all lost and found items'],
  'lf-post'   : ['Post an Item',         'Report a lost or found item'],
  'lf-matches': ['AI Matches',           '5 potential matches found'],
  admin       : ['Admin Panel',          'Manage all grievances & items'],
  analytics   : ['Analytics',            'Grievance & item statistics'],
  chatbot     : ['AI Chatbot',           'Ask anything about your campus'],
};

function appView(name, navEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  if (navEl) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    navEl.classList.add('active');
  }
  const [title, sub] = viewMeta[name] || ['CampusAI', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSub').textContent   = sub;

  if (name === 'grievances') loadAllGrievances();
  if (name === 'my-grv')     loadMyGrievances();
  if (name === 'admin')      loadAdminGrievances();
  if (name === 'analytics')  loadAnalytics();
  if (name === 'lf-browse')  loadLFItems();
}

/* ═══════════════════════════════════════
   FLASK MSG HANDLER
═══════════════════════════════════════ */
function handleMsgs() {
  const msgs = window._msgs || [];
  if (!msgs.length) return;
  msgs.forEach(([type, value]) => {
    switch (type) {
      case 'login_ok':
        showPage('app');
        Promise.all([loadAllGrievances(), loadMyGrievances()]).then(() => {
          appView('grievances', document.querySelector('[data-view="grievances"]'));
        });
        showToast('✅', `Welcome back, ${value}!`);
        break;
      case 'login_ok_admin':
        showPage('app');
        Promise.all([loadAllGrievances(), loadAdminGrievances()]).then(() => {
          appView('admin', document.querySelector('[data-view="admin"]'));
        });
        showToast('🛡️', 'Welcome, Admin!');
        break;
      case 'reg_ok':
        showPage('login');
        _showBanner('loginSuccBox', `🎉 Account created! Sign in, ${value}.`, 'succ');
        showToast('🎉', `Welcome aboard, ${value}!`);
        break;
      case 'error_login':
        showPage('login');
        _showBanner('loginErrBox', `❌ ${value}`, 'err');
        showToast('❌', value);
        break;
      case 'error':
        showToast('❌', value);
        break;
      case 'grv_ok':
        showPage('app');
        Promise.all([loadAllGrievances(), loadMyGrievances(), loadAdminGrievances()]).then(() => {
          appView('my-grv', document.querySelector('[data-view="my-grv"]'));
          _showGrvModal(value);
        });
        break;
      case 'info':
        showPage('landing');
        showToast('ℹ️', value);
        break;
    }
  });
}

function _showBanner(id, text, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.display = 'flex';
  el.className = kind === 'succ' ? 'succ-banner-inline' : 'err-banner-inline';
}

function _showGrvModal(subject) {
  const ref = 'GRV-2025-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('modalIcon').textContent  = '🎉';
  document.getElementById('modalTitle').textContent = 'Grievance Submitted!';
  document.getElementById('modalDesc').textContent  = `"${subject}" has been registered. Admin will review and assign priority.`;
  document.getElementById('modalRef').textContent   = ref;
  document.getElementById('modalBtn').onclick       = closeModal;
  document.getElementById('successModal').classList.add('show');
}

/* ═══════════════════════════════════════
   LIVE GRIEVANCE DATA
═══════════════════════════════════════ */
let _allGrievances = [];
let _myGrievances  = [];
let _grvFilter     = 'all';
let _grvCatFilter  = '';

async function loadAllGrievances() {
  try {
    const res  = await fetch('/api/grievances');
    _allGrievances = await res.json();
    _renderGrvTable(_getFilteredGrv());
    _updateKPIs(_allGrievances);
    _updateNavBadges();
  } catch(e) { console.error('loadAllGrievances:', e); }
}

async function loadMyGrievances() {
  if (window._userRole !== 'student') return;
  try {
    const res  = await fetch('/api/my_grievances');
    _myGrievances = await res.json();
    _renderMyGrv(_myGrievances);
    _updateNavBadges();
  } catch(e) { console.error('loadMyGrievances:', e); }
}

async function loadAdminGrievances() {
  if (window._userRole !== 'admin') return;
  try {
    const res  = await fetch('/api/grievances');
    _allGrievances = await res.json();
    _renderAdminTable(_allGrievances);
    _updateKPIs(_allGrievances);
    _updateNavBadges();
  } catch(e) { console.error('loadAdminGrievances:', e); }
}

async function loadAnalytics() {
  if (!_allGrievances.length) await loadAllGrievances();
  const total    = _allGrievances.length;
  const resolved = _allGrievances.filter(g => g.status === 'resolved').length;
  const review   = _allGrievances.filter(g => g.status === 'review').length;
  const pending  = _allGrievances.filter(g => g.status === 'pending').length;
  const esc      = _allGrievances.filter(g => g.status === 'escalated').length;
  const pct      = n => total ? Math.round(n/total*100) : 0;
  _setText('aPendingTotal', total);
  _setText('aResPct', `${resolved} (${pct(resolved)}%)`);
  _setText('aRevPct', `${review} (${pct(review)}%)`);
  _setText('aPenPct', `${pending} (${pct(pending)}%)`);
  _setText('aEscPct', `${esc} (${pct(esc)}%)`);
  _setWidth('aResBar', pct(resolved));
  _setWidth('aRevBar', pct(review));
  _setWidth('aPenBar', pct(pending));
  _setWidth('aEscBar', pct(esc));
}

function _setText(id, val) { const e = document.getElementById(id); if(e) e.textContent = String(val).trim(); }
function _setWidth(id, pct) { const e = document.getElementById(id); if(e) e.style.width = pct + '%'; }

function _updateKPIs(data) {
  _setText('kpiPending',  data.filter(g => g.status === 'pending').length);
  _setText('kpiReview',   data.filter(g => g.status === 'review').length);
  _setText('kpiResolved', data.filter(g => g.status === 'resolved').length);
  const sub = document.getElementById('grvTotal');
  if (sub) sub.textContent = `${data.length} total · Last updated just now`;
}

function _updateNavBadges() {
  ['nbAllGrv','nbAllGrvAdmin'].forEach(id => { const e = document.getElementById(id); if(e) e.textContent = _allGrievances.length; });
  const nb = document.getElementById('nbMyGrv'); if(nb) nb.textContent = _myGrievances.length;
}

/* ───── All Grievances Table ───── */
const statusLabel = s => ({pending:'Pending',review:'In Review',resolved:'Resolved',escalated:'Escalated'}[s] || s);
const prioEmoji   = p => ({high:'🔴',medium:'🟡',low:'🟢'}[p?.toLowerCase()] || '⚪');

function _getFilteredGrv() {
  let list = _allGrievances;
  if (_grvFilter !== 'all') list = list.filter(g => g.status === _grvFilter);
  if (_grvCatFilter)        list = list.filter(g => g.category === _grvCatFilter);
  return list;
}

function _renderGrvTable(data) {
  const tbody = document.getElementById('grvTable');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No grievances found.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(g => {
    const name = g.first_name ? `${g.first_name} ${g.last_name||''}`.trim() : (window._userName||'You');
    const id   = `GRV-${String(g.id).padStart(4,'0')}`;
    const date = g.created_at ? g.created_at.slice(0,10) : '';
    const prio = (g.priority||'medium').toLowerCase();
    const votes = g.vote_count || 0;
    const comments = g.comment_count || 0;
    const voted = g.user_voted > 0;
    const isOwner = g.user_id === window._userId;
    return `
    <tr
      onclick="openGrvDetailDB(${g.id})"
      style="cursor:pointer;transition:all .25s ease;"
      onmouseover="this.style.background='rgba(255,255,255,.03)';this.style.transform='scale(1.002)';"
      onmouseout="this.style.background='transparent';this.style.transform='scale(1)';"
    >
      <td>
        <div class="g-id" style="font-weight:700;color:var(--accent);font-size:.78rem;">${id}</div>
      </td>
      <td>
        <div class="g-title" style="font-weight:700;font-size:.92rem;color:var(--text);margin-bottom:3px;">${g.subject||'—'}</div>
        <div class="g-sub" style="color:var(--muted2);font-size:.76rem;margin-bottom:8px;">By ${name}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${isOwner ? `
          <span
            style="display:flex;align-items:center;gap:7px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);color:#7eb3ff;padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;opacity:.5;cursor:not-allowed;"
            title="You cannot upvote your own grievance"
          >👍 <span>${votes}</span></span>` : `
          <span
            class="vote-chip ${voted?'voted':''}"
            onclick="event.stopPropagation();quickVote(${g.id},this)"
            style="display:flex;align-items:center;gap:7px;background:${voted?'rgba(247,195,79,.15)':'rgba(255,255,255,.05)'};border:1px solid ${voted?'#f7c34f':'var(--border)'};color:${voted?'#f7c34f':'var(--text)'};padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .25s ease;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 5px 14px rgba(247,195,79,.18)';"
            onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';"
          >👍 <span class="vc-count">${votes}</span></span>`}
          <span
            class="comment-chip"
            style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;transition:all .25s ease;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.borderColor='#8b5cf6';this.style.color='#8b5cf6';this.style.boxShadow='0 5px 14px rgba(139,92,246,.18)';"
            onmouseout="this.style.transform='translateY(0)';this.style.borderColor='var(--border)';this.style.color='var(--text)';this.style.boxShadow='none';"
          >💬 ${comments}</span>
        </div>
      </td>
      <td><div style="font-size:.8rem;font-weight:600;color:var(--accent);">${g.category||'—'}</div></td>
      <td><span class="prio p-${prio}" style="padding:6px 10px;border-radius:10px;font-weight:700;">${prioEmoji(g.priority)} ${g.priority||'Medium'}</span></td>
      <td><span class="tag tag-${g.status||'pending'}" style="padding:6px 12px;border-radius:10px;font-weight:700;">${statusLabel(g.status||'pending')}</span></td>
      <td style="font-size:.8rem;color:var(--muted2);font-weight:500;">${g.assigned_to||'—'}</td>
      <td style="font-size:.76rem;color:var(--muted);">${date}</td>
      <td>
        <button
          class="btn btn-ghost btn-xs"
          onclick="event.stopPropagation();openGrvDetailDB(${g.id})"
          style="border-radius:10px;padding:7px 14px;font-weight:600;transition:all .25s ease;"
          onmouseover="this.style.transform='translateY(-2px)';this.style.background='rgba(255,255,255,.08)';"
          onmouseout="this.style.transform='translateY(0)';this.style.background='transparent';"
        >View</button>
      </td>
    </tr>`;
  }).join('');
}

function filterGrv(type, el) {
  document.querySelectorAll('#view-grievances .fc').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  _grvFilter = type;
  _renderGrvTable(_getFilteredGrv());
}

function filterGrvCat(val) {
  _grvCatFilter = val;
  _renderGrvTable(_getFilteredGrv());
}

/* ───── My Grievances ───── */
function _renderMyGrv(data) {
  const container = document.getElementById('myGrvList');
  if (!container) return;
  const sub = document.getElementById('myGrvSub');
  if (sub) sub.textContent = `${data.length} grievance${data.length !== 1 ? 's' : ''} submitted by you`;

  if (!data.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted)">
      <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
      <div style="font-size:.93rem;margin-bottom:16px">You haven't submitted any grievances yet.</div>
      <button class="btn btn-primary btn-sm" onclick="appView('submit-grv',null)">✏️ Submit Your First Grievance</button>
    </div>`;
    return;
  }

  container.innerHTML = data.map(g => {
    const id   = `GRV-${String(g.id).padStart(4,'0')}`;
    const date = g.created_at ? g.created_at.slice(0,10) : '';
    const prio = (g.priority||'medium').toLowerCase();
    const prog = g.status==='resolved'?100:g.status==='review'?55:g.status==='escalated'?80:15;
    const votes = g.vote_count || 0;
    const comments = g.comment_count || 0;
    return `
    <div class="grv-card" onclick="openGrvDetailDB(${g.id})" style="cursor:pointer">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px">
        <div>
          <div class="g-id" style="margin-bottom:4px">${id} · ${date}</div>
          <div style="font-weight:600;font-size:.93rem;color:var(--text)">${g.subject||'—'}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">${g.category||'—'}</div>
          <div style="font-size:.78rem;color:var(--muted2);margin-top:4px;line-height:1.5">${g.description?g.description.slice(0,100)+(g.description.length>100?'…':''):''}</div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <span
              style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);color:#7eb3ff;font-size:.75rem;font-weight:600;opacity:.5;cursor:not-allowed;"
              title="You cannot upvote your own grievance"
            >👍 ${votes}</span>
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2);font-size:.75rem;font-weight:500;">💬 ${comments} comment${comments!==1?'s':''}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
          <span class="tag tag-${g.status||'pending'}">${statusLabel(g.status||'pending')}</span>
          <span class="prio p-${prio}">${prioEmoji(g.priority)} ${g.priority||'Medium'}</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-bottom:5px">
        <span>Progress</span><span>${prog}%</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
    </div>`;
  }).join('');
}

/* ───── Admin Table ───── */
function _renderAdminTable(data) {
  const tbody = document.getElementById('adminTable');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No grievances in the database yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(g => {
    const name = g.first_name ? `${g.first_name} ${g.last_name||''}`.trim() : 'Unknown';
    const id   = `GRV-${String(g.id).padStart(4,'0')}`;
    const prio = g.priority || 'Medium';
    const assigneeOpts = buildAssigneeOptions(g.category, g.assigned_to);
    const votes = g.vote_count || 0;
    const comments = g.comment_count || 0;
    return `
    <tr id="admin-row-${g.id}" onmouseover="this.style.background='rgba(79,142,247,.04)'" onmouseout="this.style.background=''">
      <td style="padding:11px 14px;font-size:.73rem;color:var(--muted)">${id}</td>
      <td style="padding:11px 14px">
        <div style="font-size:.83rem;font-weight:600;color:var(--text)">📢 ${g.subject||'—'}</div>
        <div style="font-size:.71rem;color:var(--muted)">${g.category||'—'}</div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:4px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.3);color:#7eb3ff;font-size:.72rem;font-weight:600;" title="${votes} upvote${votes!==1?'s':''}">▲ ${votes}</span>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:4px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.3);color:#7eb3ff;font-size:.72rem;font-weight:600;" title="${comments} comment${comments!==1?'s':''}">💬 ${comments}</span>
        </div>
      </td>
      <td style="padding:11px 14px;font-size:.8rem;color:var(--muted2)">${name}</td>
      <td style="padding:11px 14px">
        <select class="prio-sel" onchange="updateGrvPriority(${g.id},this.value)" onclick="event.stopPropagation()">
          <option value="Low"    ${prio==='Low'   ?'selected':''}>🟢 Low</option>
          <option value="Medium" ${prio==='Medium'?'selected':''}>🟡 Medium</option>
          <option value="High"   ${prio==='High'  ?'selected':''}>🔴 High</option>
        </select>
      </td>
      <td style="padding:11px 14px">
        <select class="prio-sel" onchange="updateGrvStatus(${g.id},this.value)" onclick="event.stopPropagation()">
          <option value="pending"   ${g.status==='pending'  ?'selected':''}>Pending</option>
          <option value="review"    ${g.status==='review'   ?'selected':''}>In Review</option>
          <option value="resolved"  ${g.status==='resolved' ?'selected':''}>Resolved</option>
          <option value="escalated" ${g.status==='escalated'?'selected':''}>Escalated</option>
        </select>
      </td>
      <td style="padding:11px 14px">
        <select class="prio-sel" onchange="updateGrvAssignee(${g.id},this.value)" onclick="event.stopPropagation()">
          ${assigneeOpts}
        </select>
      </td>
      <td style="padding:11px 14px">
        <div style="display:flex;gap:5px;align-items:center">
          <button class="btn btn-ghost btn-xs" onclick="openGrvDetailDB(${g.id})" title="View & comment">💬</button>
          <button class="btn btn-found btn-xs" onclick="updateGrvStatus(${g.id},'resolved');showToast('✅','Resolved!')">✅</button>
          <button class="btn btn-ghost btn-xs" onclick="updateGrvStatus(${g.id},'escalated');showToast('🔺','Escalated!')">🔺</button>
          <button class="btn btn-xs"
            style="background:rgba(247,95,95,.12);color:var(--lost);border:1px solid rgba(247,95,95,.25);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:.72rem"
            onclick="confirmDeleteGrievance(${g.id},'${(g.subject||'').replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════
   VOTING
═══════════════════════════════════════ */
async function quickVote(id, chipEl) {
  if (!window._loggedIn) { showToast('🔒', 'Please log in to vote.'); return; }
  const g = _allGrievances.find(x => x.id === id) || _myGrievances.find(x => x.id === id);
  if (g && g.user_id === window._userId) {
    showToast('🚫', 'You cannot upvote your own grievance.');
    return;
  }
  try {
    const res  = await fetch(`/api/grievance/${id}/vote`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) return;

    [_allGrievances, _myGrievances].forEach(arr => {
      const g = arr.find(x => x.id === id);
      if (g) { g.vote_count = data.vote_count; g.user_voted = data.voted ? 1 : 0; }
    });

    if (chipEl) {
      const countEl = chipEl.querySelector('.vc-count');
      if (countEl) countEl.textContent = data.vote_count;
      chipEl.classList.toggle('voted', data.voted);
      chipEl.style.background = data.voted ? 'rgba(247,195,79,.15)' : 'rgba(255,255,255,.05)';
      chipEl.style.borderColor = data.voted ? '#f7c34f' : 'var(--border)';
      chipEl.style.color = data.voted ? '#f7c34f' : 'var(--text)';
    }

    const dpVoteBtn = document.getElementById(`dp-vote-${id}`);
    if (dpVoteBtn) {
      dpVoteBtn.querySelector('.vc-count').textContent = data.vote_count;
      dpVoteBtn.classList.toggle('dp-voted', data.voted);
      dpVoteBtn.querySelector('.vote-label').textContent = data.voted ? 'Voted' : 'Upvote';
      dpVoteBtn.style.background = data.voted ? 'rgba(79,142,247,.25)' : 'rgba(79,142,247,.12)';
      dpVoteBtn.style.color = data.voted ? '#ffffff' : '#7eb3ff';
    }

    showToast(data.voted ? '👍' : '👋', data.voted ? 'Upvoted!' : 'Vote removed.');
  } catch(e) { showToast('❌', 'Could not register vote.'); }
}

/* ═══════════════════════════════════════
   COMMENTS
═══════════════════════════════════════ */
async function loadComments(grievanceId) {
  const container = document.getElementById('comments-list');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--muted);font-size:.8rem">Loading…</div>`;
  try {
    const res  = await fetch(`/api/grievance/${grievanceId}/comments`);
    const data = await res.json();
    renderComments(data, container);
  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--lost);font-size:.8rem">Failed to load comments.</div>`;
  }
}

function renderComments(comments, container) {
  if (!container) return;
  if (!comments.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px 16px;color:var(--muted);font-size:.8rem;">
        <div style="font-size:1.6rem;margin-bottom:6px">💬</div>
        No comments yet. Be the first to comment!
      </div>`;
    return;
  }
  container.innerHTML = comments.map(c => {
    const name    = `${c.first_name} ${c.last_name||''}`.trim();
    const isAdmin = c.is_admin || c.role === 'admin';
    const author  = isAdmin ? 'Admin' : name;

    let timestamp = '';
    if (c.created_at) {
      const d     = new Date(c.created_at.replace(' ','T'));
      const now   = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time  = d.toTimeString().slice(0,5);
      const day   = d.getDate();
      const month = d.toLocaleString('default',{month:'short'});
      timestamp   = isToday ? `Today ${time}` : `${day} ${month} ${time}`;
    }

   return `
      <div style="
        margin:8px 10px;
        padding:12px 14px;
        border-radius:10px;
        border:1px solid ${isAdmin ? 'rgba(79,142,247,.3)' : 'rgba(255,255,255,.07)'};
        background:${isAdmin ? 'rgba(79,142,247,.08)' : 'rgba(255,255,255,.03)'};
        transition:border-color .18s, background .18s;
      "
        onmouseover="this.style.borderColor='rgba(79,142,247,.35)';this.style.background='rgba(79,142,247,.1)';"
        onmouseout="this.style.borderColor='${isAdmin?'rgba(79,142,247,.3)':'rgba(255,255,255,.07)'}';this.style.background='${isAdmin?'rgba(79,142,247,.08)':'rgba(255,255,255,.03)'}';"
      >
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="
            width:28px;height:28px;border-radius:7px;flex-shrink:0;
            background:${isAdmin?'linear-gradient(135deg,#4f8ef7,#7c3aed)':'linear-gradient(135deg,var(--accent),var(--accent2))'};
            display:flex;align-items:center;justify-content:center;
            font-size:${isAdmin?'.9':'.68'}rem;font-weight:700;color:#fff;
          ">${isAdmin ? '🛡️' : author.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>
          <span style="font-size:.8rem;font-weight:700;color:var(--text);">${author}</span>
          ${isAdmin ? `<span style="font-size:.62rem;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(79,142,247,.18);color:#7eb3ff;border:1px solid rgba(79,142,247,.3);">Official</span>` : ''}
          <span style="font-size:.7rem;color:var(--muted);margin-left:auto;">${timestamp}</span>
        </div>
        <div style="font-size:.83rem;color:var(--muted2);line-height:1.6;padding-left:36px;word-break:break-word;">${escHtml(c.body)}</div>
      </div>`;
  }).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

async function submitComment(grievanceId) {
  if (!window._loggedIn) { showToast('🔒', 'Please log in to comment.'); return; }
  const inp  = document.getElementById('comment-input');
  if (!inp)  return;
  const body = inp.value.trim();
  if (!body) { showToast('⚠️', 'Comment cannot be empty.'); return; }

  const btn = document.getElementById('comment-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }

  try {
    const res  = await fetch(`/api/grievance/${grievanceId}/comments`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({body})
    });
    const data = await res.json();
    if (data.ok) {
      inp.value = '';
      [_allGrievances, _myGrievances].forEach(arr => {
        const g = arr.find(x => x.id === grievanceId);
        if (g) g.comment_count = (g.comment_count || 0) + 1;
      });
      const countEl = document.getElementById(`dp-comment-count-${grievanceId}`);
      if (countEl) {
        const g = _allGrievances.find(x => x.id === grievanceId) || _myGrievances.find(x => x.id === grievanceId);
        if (g) countEl.textContent = g.comment_count;
      }
      await loadComments(grievanceId);
      showToast('💬', 'Comment posted!');
    } else {
      showToast('❌', data.error || 'Failed to post comment.');
    }
  } catch(e) {
    showToast('❌', 'Network error. Could not post comment.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
  }
}

/* ═══════════════════════════════════════
   DELETE GRIEVANCE
═══════════════════════════════════════ */
function confirmDeleteGrievance(id, subject) {
  const overlay = document.createElement('div');
  overlay.id = 'deleteConfirmOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;
    display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);
  `;
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 28px;max-width:420px;width:90%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.4);">
      <div style="font-size:2.8rem;margin-bottom:14px">🗑️</div>
      <h3 style="font-family:'Syne',sans-serif;font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:8px">Delete Grievance?</h3>
      <p style="font-size:.85rem;color:var(--muted2);line-height:1.6;margin-bottom:6px">You are about to permanently delete:</p>
      <div style="background:rgba(247,95,95,.08);border:1px solid rgba(247,95,95,.2);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:.84rem;font-weight:600;color:var(--lost);">"${subject}"</div>
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:24px">This will remove the grievance, all comments, and votes. This action cannot be undone.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-ghost" onclick="document.getElementById('deleteConfirmOverlay').remove()">Cancel</button>
        <button class="btn" style="background:var(--lost);color:#fff;border:none;padding:9px 22px;border-radius:9px;cursor:pointer;font-weight:600" onclick="executeDeleteGrievance(${id})">🗑️ Yes, Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function executeDeleteGrievance(id) {
  const overlay = document.getElementById('deleteConfirmOverlay');
  if (overlay) overlay.remove();
  try {
    const res = await fetch(`/api/grievance/${id}/delete`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      _allGrievances = _allGrievances.filter(g => g.id !== id);
      _myGrievances  = _myGrievances.filter(g => g.id !== id);
      const row = document.getElementById(`admin-row-${id}`);
      if (row) {
        row.style.transition = 'opacity .3s, transform .3s';
        row.style.opacity    = '0';
        row.style.transform  = 'translateX(-20px)';
        setTimeout(() => row.remove(), 300);
      }
      _renderGrvTable(_getFilteredGrv());
      _renderMyGrv(_myGrievances);
      _renderAdminTable(_allGrievances);
      _updateKPIs(_allGrievances);
      _updateNavBadges();
      closeDetail();
      showToast('🗑️', 'Grievance deleted successfully.');
    } else {
      showToast('❌', 'Failed to delete grievance.');
    }
  } catch(e) {
    showToast('❌', 'Network error. Could not delete.');
    console.error('deleteGrievance:', e);
  }
}

/* ───── Admin API calls ───── */
async function updateGrvPriority(id, priority) {
  try {
    await fetch(`/api/grievance/${id}/update`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({priority})
    });
    [_allGrievances, _myGrievances].forEach(arr => {
      const g = arr.find(x => x.id === id); if(g) g.priority = priority;
    });
    showToast('✅', `Priority → ${priority}`);
    _renderGrvTable(_getFilteredGrv());
    _renderMyGrv(_myGrievances);
    _renderAdminTable(_allGrievances);
  } catch(e) { showToast('❌','Failed to update priority'); }
}

async function updateGrvStatus(id, status) {
  try {
    await fetch(`/api/grievance/${id}/update`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({status})
    });
    [_allGrievances, _myGrievances].forEach(arr => {
      const g = arr.find(x => x.id === id); if(g) g.status = status;
    });
    showToast('✅', `Status → ${statusLabel(status)}`);
    _renderGrvTable(_getFilteredGrv());
    _updateKPIs(_allGrievances);
    _renderAdminTable(_allGrievances);
    _renderMyGrv(_myGrievances);
  } catch(e) { showToast('❌','Failed to update status'); }
}

async function updateGrvAssignee(id, assigned_to) {
  try {
    await fetch(`/api/grievance/${id}/update`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({assigned_to})
    });
    [_allGrievances, _myGrievances].forEach(arr => {
      const g = arr.find(x => x.id === id); if(g) g.assigned_to = assigned_to;
    });
    showToast('✅', assigned_to === '—' ? 'Assignee cleared' : `Assigned → ${assigned_to}`);
    _renderGrvTable(_getFilteredGrv());
    _renderMyGrv(_myGrievances);
  } catch(e) { showToast('❌','Failed to update assignee'); }
}

/* ───── Detail panel ───── */
function openGrvDetailDB(id) {
  const g = _allGrievances.find(x => x.id === id) || _myGrievances.find(x => x.id === id);
  if (!g) { showToast('⚠️','Could not load grievance details.'); return; }
  const name    = g.first_name ? `${g.first_name} ${g.last_name||''}`.trim() : (window._userName||'You');
  const grvId   = `GRV-${String(g.id).padStart(4,'0')}`;
  const prio    = (g.priority||'medium').toLowerCase();
  const prog    = g.status==='resolved'?100:g.status==='review'?55:g.status==='escalated'?80:15;
  const isAdmin = window._userRole === 'admin';
  const isOwner = g.user_id === window._userId;
  const votes    = g.vote_count || 0;
  const comments = g.comment_count || 0;
  const voted    = g.user_voted > 0;

  document.getElementById('dpHero').className = 'dp-hero grv-bg';
  document.getElementById('dpHero').innerHTML = `📢<button class="dp-close" onclick="closeDetail()">✕</button>`;

  document.getElementById('dpBody').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span class="tag tag-${g.status||'pending'}">${statusLabel(g.status||'pending')}</span>
      <span class="prio p-${prio}">${prioEmoji(g.priority)} ${g.priority||'Medium'}</span>
    </div>

    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:8px;color:var(--text)">${g.subject||'—'}</div>
    <p style="font-size:.84rem;color:var(--muted2);line-height:1.65;margin-bottom:16px">${g.description||'—'}</p>

    <div class="dp-social-bar">
      ${isOwner ? `
      <div
        style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:8px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);color:#7eb3ff;font-size:.83rem;font-weight:600;opacity:.45;cursor:not-allowed;"
        title="You cannot upvote your own grievance"
      >
        👍 <span>Upvote</span>
        <span style="background:rgba(79,142,247,.2);border-radius:20px;padding:1px 7px;font-size:.7rem;font-weight:700;">${votes}</span>
      </div>` : `
      <button
        id="dp-vote-${g.id}"
        onclick="quickVote(${g.id}, null)"
        style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:8px;background:${voted?'rgba(79,142,247,.25)':'rgba(79,142,247,.12)'};border:1px solid rgba(79,142,247,.3);color:${voted?'#ffffff':'#7eb3ff'};font-size:.83rem;font-weight:600;cursor:pointer;transition:all .2s;outline:none;"
        onmouseover="this.style.background='rgba(79,142,247,.3)';this.style.color='#fff';"
        onmouseout="this.style.background='${voted?'rgba(79,142,247,.25)':'rgba(79,142,247,.12)'}';this.style.color='${voted?'#ffffff':'#7eb3ff'}';"
      >
        👍 <span class="vote-label">${voted?'Voted':'Upvote'}</span>
        <span class="dp-vote-pill" style="background:rgba(79,142,247,.25);border-radius:20px;padding:1px 7px;font-size:.7rem;font-weight:700;"><span class="vc-count">${votes}</span></span>
      </button>`}
      <span class="dp-comment-info">
        💬 <span id="dp-comment-count-${g.id}">${comments}</span> comment${comments!==1?'s':''}
      </span>
      ${votes > 0 ? `<span class="dp-severity ${votes>=10?'sev-high':votes>=5?'sev-med':'sev-low'}">
        ${votes>=10?'🔥 High Community Interest':votes>=5?'⚡ Notable Issue':'📌 Some Interest'}
      </span>` : ''}
    </div>

    <div class="dp-sec">
      <div class="dp-sec-title">Details</div>
      <div class="dp-field"><label>ID</label><span>${grvId}</span></div>
      <div class="dp-field"><label>Category</label><span>${g.category||'—'}</span></div>
      <div class="dp-field"><label>Location</label><span>${g.location||'—'}</span></div>
      <div class="dp-field"><label>Incident Date</label><span>${g.incident_date||'—'}</span></div>
      <div class="dp-field"><label>Submitted by</label><span>${name}</span></div>
      <div class="dp-field"><label>Assigned To</label><span>${g.assigned_to||'—'}</span></div>
      <div class="dp-field"><label>Submitted On</label><span>${(g.created_at||'').slice(0,10)}</span></div>
    </div>

    ${isAdmin ? `
    <div class="dp-sec">
      <div class="dp-sec-title">🛡️ Admin Controls</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
        <div>
          <label class="f-lbl" style="font-size:.73rem">Priority</label>
          <select class="prio-sel" style="width:100%;margin-top:4px" onchange="updateGrvPriority(${g.id},this.value)">
            <option value="Low"    ${(g.priority||'')=='Low'   ?'selected':''}>🟢 Low</option>
            <option value="Medium" ${(g.priority||'Medium')=='Medium'?'selected':''}>🟡 Medium</option>
            <option value="High"   ${(g.priority||'')=='High'  ?'selected':''}>🔴 High</option>
          </select>
        </div>
        <div>
          <label class="f-lbl" style="font-size:.73rem">Status</label>
          <select class="prio-sel" style="width:100%;margin-top:4px" onchange="updateGrvStatus(${g.id},this.value)">
            <option value="pending"   ${g.status==='pending'  ?'selected':''}>Pending</option>
            <option value="review"    ${g.status==='review'   ?'selected':''}>In Review</option>
            <option value="resolved"  ${g.status==='resolved' ?'selected':''}>Resolved</option>
            <option value="escalated" ${g.status==='escalated'?'selected':''}>Escalated</option>
          </select>
        </div>
      </div>
      <div style="margin-top:10px">
        <label class="f-lbl" style="font-size:.73rem">Assign To</label>
        <select class="prio-sel" style="width:100%;margin-top:4px" onchange="updateGrvAssignee(${g.id},this.value)">
          ${buildAssigneeOptions(g.category, g.assigned_to)}
        </select>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" style="background:rgba(247,95,95,.12);color:var(--lost);border:1px solid rgba(247,95,95,.25);width:100%;justify-content:center"
          onclick="closeDetail();confirmDeleteGrievance(${g.id},'${(g.subject||'').replace(/'/g,"\\'")}')">
          🗑️ Delete Grievance (Fake / Spam)
        </button>
      </div>
    </div>` : ''}

    <div class="dp-sec">
      <div class="dp-sec-title">Progress</div>
      <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-top:5px">
        <span>Submitted</span><span>In Review</span><span>Resolved</span>
      </div>
    </div>

    <div class="dp-sec" id="comments-section">
      <div class="dp-sec-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>💬 Community Discussion</span>
        <span style="font-size:.72rem;color:var(--muted);font-weight:400">Public · All can see</span>
      </div>

      <div id="comments-list" style="margin-top:2px;max-height:320px;overflow-y:auto;border-radius:8px;border:1px solid rgba(79,142,247,.2);background:rgba(79,142,247,.04);">
      </div>

      ${window._loggedIn ? `
       <div class="comment-compose" style="border:1px solid rgba(79,142,247,.2);border-top:none;border-radius:0 0 8px 8px;background:rgba(79,142,247,.04);padding:12px;">
        <div class="compose-right">
          <textarea
            id="comment-input"
            class="comment-textarea"
            placeholder="Share your thoughts or additional context…"
            onkeydown="commentKeydown(event, ${g.id})"
            maxlength="1000"
            style="background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.3);color:var(--text);width:100%;min-height:90px;box-sizing:border-box;"
          ></textarea>
          <div class="compose-footer">
            <span class="char-hint" id="char-hint">0 / 1000</span>
            <button id="comment-submit-btn" class="btn btn-primary btn-sm" onclick="submitComment(${g.id})">Post</button>
          </div>
        </div>
      </div>` : `
      <div style="text-align:center;padding:14px;font-size:.82rem;color:var(--muted)">
        <a href="#" onclick="showPage('login')" class="link">Sign in</a> to join the discussion.
      </div>`}
    </div>`;

  const ta = document.getElementById('comment-input');
  if (ta) {
    ta.oninput = () => {
      const hint = document.getElementById('char-hint');
      if (hint) hint.textContent = `${ta.value.length} / 1000`;
    };
  }

  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  loadComments(g.id);
}

function commentKeydown(e, grvId) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    submitComment(grvId);
  }
}

async function loadNotifications() {
  const res = await fetch('/api/notifications');
  const data = await res.json();
  let html = '';
  data.forEach(n => {
    html += `<div class="notif-item">${n.message}</div>`;
  });
  document.getElementById('notifList').innerHTML = html || '<div class="notif-item" style="color:var(--muted)">No notifications yet.</div>';
}

function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('show');
  loadNotifications();
}

/* ═══════════════════════════════════════
   LOST & FOUND — DB-BACKED
═══════════════════════════════════════ */

let _lfItems      = [];   // all items from DB
let _lfTypeFilter = 'all';

/* Emoji mapping for categories */
function _lfEmoji(cat) {
  const map = {
    '🎒 Bags & Accessories':'🎒','📱 Electronics':'📱',
    '📄 Documents / ID Cards':'📄','👕 Clothing':'👕',
    '🔑 Keys':'🔑','📚 Books / Stationery':'📚','📦 Other':'📦',
  };
  return map[cat] || '📦';
}

/* Load items from DB and render */
async function loadLFItems() {
  const grid = document.getElementById('lfGrid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Loading items…</div>`;
  try {
    const res = await fetch('/api/lf/items');
    _lfItems  = await res.json();
    _applyLFFilter();
    _updateLFKPIs();
  } catch(e) {
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--lost)">Failed to load items.</div>`;
    console.error('loadLFItems:', e);
  }
}

function _updateLFKPIs() {
  const lostCount  = _lfItems.filter(i => i.type === 'lost').length;
  const foundCount = _lfItems.filter(i => i.type === 'found').length;
  _setText('lfKpiLost',  lostCount);
  _setText('lfKpiFound', foundCount);
  const cntEl = document.getElementById('lfItemCount');
  if (cntEl) cntEl.textContent = `${_lfItems.length} items · Updated now`;
}

function _applyLFFilter() {
  let list = _lfItems;
  if (_lfTypeFilter !== 'all') list = list.filter(i => i.type === _lfTypeFilter);
  _renderLFItems(list);
}

/* Render items fetched from DB */
function _renderLFItems(list) {
  const grid = document.getElementById('lfGrid');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--muted)">
      <div style="font-size:2.5rem;margin-bottom:12px">🗂️</div>
      <div style="font-size:.93rem;margin-bottom:16px">No items found. Be the first to post one!</div>
      <button class="btn btn-primary btn-sm student-only" onclick="appView('lf-post',null)">➕ Post an Item</button>
    </div>`;
    return;
  }

  const urgLabel = u => u==='h'?'🔴 Urgent':u==='m'?'🟡 Medium':'🟢 Low';
  const urgCls   = u => u==='h'?'urg-h':u==='m'?'urg-m':'urg-l';

  grid.innerHTML = list.map(item => {
    const emoji    = _lfEmoji(item.category);
    const poster   = (item.private || item.type === 'lost')
      ? 'Anonymous'
      : (item.first_name ? `${item.first_name} ${item.last_name||''}`.trim() : 'Anonymous');
    const initials = poster === 'Anonymous' ? '👤' : poster.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2) || '?';
    const dateStr  = item.date || (item.created_at ? item.created_at.slice(0,10) : '');
    const urgency  = 'm'; // default; extend if you add urgency to DB later
    const hasImg   = item.image_path && item.image_path.trim() !== '';
    const imgHtml  = hasImg
      ? `<img src="${item.image_path}" alt="${escHtml(item.title)}"
           style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
      : emoji;

    return `
    <div class="item-card" onclick="openLFDetailDB(${item.id})">
      <div class="item-img img-${item.type}" style="${hasImg?'padding:0;overflow:hidden;':''}">
        ${imgHtml}
        <span class="type-badge badge-${item.type}" style="${hasImg?'position:absolute;top:8px;left:8px;':''}">
          ${item.type.toUpperCase()}
        </span>
        <span class="urg-badge ${urgCls(urgency)}">${urgLabel(urgency)}</span>
      </div>
      <div class="item-body">
        <div class="item-cat">${item.category||'General'}</div>
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-desc">${item.description ? escHtml(item.description).slice(0,90) + (item.description.length>90?'…':'') : ''}</div>
        <div class="item-meta">
          ${item.location ? `<span class="meta-chip">📍 ${escHtml(item.location)}</span>` : ''}
          ${dateStr       ? `<span class="meta-chip">📅 ${dateStr}</span>` : ''}
          ${item.color    ? `<span class="meta-chip">🎨 ${escHtml(item.color)}</span>` : ''}
        </div>
        <div class="item-foot">
          <div style="display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--muted2)">
            <div class="poster-av">${initials}</div>${escHtml(poster)}
          </div>
          <button class="btn ${item.type==='lost'?'btn-found':'btn-lost'} btn-xs"
            onclick="event.stopPropagation();showToast('📧','Contact request sent!')">
            ${item.type==='lost'?'✋ I Found It':'✋ I Lost It'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* Open detail panel for a DB item */
function openLFDetailDB(id) {
  const item = _lfItems.find(x => x.id === id);
  if (!item) { showToast('⚠️','Could not load item details.'); return; }

  const emoji    = _lfEmoji(item.category);
  const poster   = (item.private || item.type === 'lost')
    ? '🔒 Anonymous (private)'
    : (item.first_name ? `${item.first_name} ${item.last_name||''}`.trim() : 'Anonymous');
  const dateStr  = item.date || (item.created_at ? item.created_at.slice(0,10) : '');
  const hasImg   = item.image_path && item.image_path.trim() !== '';

  document.getElementById('dpHero').className = `dp-hero ${item.type}-bg`;
  document.getElementById('dpHero').innerHTML = hasImg
    ? `<img src="${item.image_path}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" /><button class="dp-close" onclick="closeDetail()">✕</button>`
    : `${emoji}<button class="dp-close" onclick="closeDetail()">✕</button>`;

  document.getElementById('dpBody').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <span class="type-badge badge-${item.type}">${item.type.toUpperCase()}</span>
      <span class="tag tag-${item.status||'open'}" style="font-size:.72rem">${item.status==='claimed'?'Claimed':'Open'}</span>
    </div>
    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:6px;color:var(--text)">${escHtml(item.title)}</div>
    <p style="font-size:.84rem;color:var(--muted2);line-height:1.65;margin-bottom:16px">${item.description ? escHtml(item.description) : '—'}</p>
    <div class="dp-sec"><div class="dp-sec-title">Item Details</div>
      <div class="dp-field"><label>Category</label><span>${item.category||'—'}</span></div>
      <div class="dp-field"><label>Color</label><span>${item.color||'—'}</span></div>
      <div class="dp-field"><label>Brand / Make</label><span>${item.brand||'—'}</span></div>
      <div class="dp-field"><label>Location</label><span>${item.location||'—'}</span></div>
      <div class="dp-field"><label>Date</label><span>${dateStr||'—'}</span></div>
      <div class="dp-field"><label>Posted by</label><span>${item.private ? 'Anonymous' : escHtml(poster)}</span></div>
      <div class="dp-field"><label>Reference</label><span>LF-${String(item.id).padStart(4,'0')}</span></div>
    </div>
    ${hasImg ? `<div class="dp-sec"><div class="dp-sec-title">📸 Photo</div>
      <img src="${item.image_path}" alt="Item photo" style="width:100%;border-radius:10px;margin-top:6px;border:1px solid var(--border);" /></div>` : ''}
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:14px">
      <div style="font-family:'Syne',sans-serif;font-size:.88rem;font-weight:700;margin-bottom:10px;color:var(--text)">📞 Contact</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-found btn-sm" onclick="showToast('📧','Message sent!')">📧 Send Message</button>
        <button class="btn btn-ghost btn-sm" onclick="showToast('🚩','Reported!')">🚩 Report</button>
        <button class="btn btn-ghost btn-sm" onclick="showToast('🔖','Saved!')">🔖 Save</button>
      </div>
    </div>`;

  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

/* ─── SUBMIT LOST/FOUND ITEM ─── */
let lfType = 'lost';
let _lfImageDataURL = '';   // stores the selected image as base64

function selectType(type) {
  lfType = type;
  document.getElementById('typeLost').className  = 'type-card' + (type==='lost'  ? ' sel-lost'  : '');
  document.getElementById('typeFound').className = 'type-card' + (type==='found' ? ' sel-found' : '');
  document.getElementById('lfFormTitle').textContent = type==='lost' ? '📋 Report Lost Item' : '📋 Report Found Item';
  document.getElementById('lfSubmitBtn').className   = 'btn ' + (type==='lost' ? 'btn-lost' : 'btn-found');
  document.getElementById('lfSubmitBtn').textContent  = type==='lost' ? '🚀 Submit Lost Report' : '🚀 Submit Found Report';
  document.getElementById('dateLbl').textContent     = type==='lost' ? 'Date Lost *' : 'Date Found *';

  // Photo upload is always visible (both lost and found)
  const photoSection = document.getElementById('lfPhotoSection');
  if (photoSection) photoSection.style.display = '';

  // Photo required indicator
  const req  = document.getElementById('lfPhotoReq');
  const hint = document.getElementById('lfPhotoHint');
  if (req)  req.style.display  = type === 'found' ? 'inline' : 'none';
  if (hint) hint.style.display = type === 'lost'  ? 'inline' : 'none';

  // Privacy: auto-locked (always private) for LOST; optional checkbox for FOUND
  const locked = document.getElementById('iPrivacyLocked');
  const check  = document.getElementById('iPrivacyCheck');
  const priv   = document.getElementById('iPrivate');
  if (type === 'lost') {
    if (locked) locked.style.display = 'flex';
    if (check)  check.style.display  = 'none';
    if (priv)   priv.checked = true;   // always private for lost
  } else {
    if (locked) locked.style.display = 'none';
    if (check)  check.style.display  = 'flex';
    if (priv)   priv.checked = false;
  }
}

function selectLoc(el, loc) {
  document.querySelectorAll('.loc-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('iLocOther').value = loc;
}

/* Handle image file selection */
function handleLFImageSelect(input) {
  const file = input.files[0];
  if (!file) { _lfImageDataURL = ''; return; }

  if (!file.type.startsWith('image/')) {
    showToast('⚠️', 'Please select an image file.');
    input.value = ''; _lfImageDataURL = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('⚠️', 'Image must be under 5 MB.');
    input.value = ''; _lfImageDataURL = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    _lfImageDataURL = e.target.result;
    // Update preview
    const preview = document.getElementById('lfImagePreview');
    if (preview) {
      preview.innerHTML = `
        <img src="${_lfImageDataURL}" alt="Preview"
          style="width:100%;max-height:180px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-top:8px;" />
        <div style="font-size:.73rem;color:var(--found);margin-top:5px;">✅ ${escHtml(file.name)} selected</div>`;
    }
    // Update the slot UI
    const slot = document.getElementById('lfImgSlot');
    if (slot) {
      slot.innerHTML = `<img src="${_lfImageDataURL}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" /><span>Change</span>`;
      slot.classList.add('has-img');
    }
  };
  reader.readAsDataURL(file);
}

async function submitLF() {
  if (!window._loggedIn) { showToast('🔒', 'Please log in to post an item.'); return; }

  const title = document.getElementById('iTitle').value.trim();
  if (!title) { showToast('⚠️', 'Please enter an item name!'); return; }

  // Mandatory photo for "found"
  if (lfType === 'found' && !_lfImageDataURL) {
    showToast('📷', 'Please upload a photo of the found item.');
    document.getElementById('lfPhotoSection').scrollIntoView({behavior:'smooth',block:'nearest'});
    return;
  }

  const payload = {
    type       : lfType,
    title,
    category   : document.getElementById('iCat').value,
    color      : document.getElementById('iColor').value.trim(),
    brand      : document.getElementById('iBrand').value.trim(),
    description: document.getElementById('iDesc').value.trim(),
    location   : document.getElementById('iLocOther').value.trim(),
    date       : document.getElementById('iDate').value,
    time       : document.getElementById('iTime').value,
    private    : document.getElementById('iPrivate').checked,
    image      : _lfImageDataURL,   // may be empty for "lost"
  };

  const btn = document.getElementById('lfSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    const res  = await fetch('/api/lf/submit', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showToast('❌', data.error || 'Submission failed.');
      return;
    }

    // Add to local list and refresh browse
    _lfItems.unshift(data.item);
    _updateLFKPIs();

    // Reset form
    document.getElementById('iTitle').value  = '';
    document.getElementById('iDesc').value   = '';
    document.getElementById('iColor').value  = '';
    document.getElementById('iBrand').value  = '';
    document.getElementById('iLocOther').value = '';
    document.getElementById('iDate').valueAsDate = new Date();
    document.getElementById('iTime').value   = '';
    document.getElementById('iPrivate').checked = false;
    _lfImageDataURL = '';
    const preview = document.getElementById('lfImagePreview');
    if (preview) preview.innerHTML = '';
    const slot = document.getElementById('lfImgSlot');
    if (slot) { slot.innerHTML = '📷<span>Add Photo</span>'; slot.classList.remove('has-img'); }

    // Show success modal
    const ref = `LF-${String(data.item.id).padStart(4,'0')}`;
    document.getElementById('modalIcon').textContent  = lfType==='lost' ? '📢' : '🎉';
    document.getElementById('modalTitle').textContent = lfType==='lost' ? 'Lost Item Reported!' : 'Found Item Posted!';
    document.getElementById('modalDesc').textContent  = lfType==='lost'
      ? 'Your report is live. AI is scanning for matches.'
      : 'Your found item is posted. Owner notified if matched.';
    document.getElementById('modalRef').textContent  = ref;
    document.getElementById('modalBtn').onclick = () => {
      closeModal();
      appView('lf-browse', document.querySelector('[data-view="lf-browse"]'));
    };
    document.getElementById('successModal').classList.add('show');

  } catch(e) {
    showToast('❌', 'Network error. Please try again.');
    console.error('submitLF:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = lfType==='lost' ? '🚀 Submit Lost Report' : '🚀 Submit Found Report'; }
  }
}

/* ─── LF browse filters ─── */
function filterLF(type, el) {
  document.querySelectorAll('#view-lf-browse .fc').forEach(c => c.classList.remove('active','fc-lost','fc-found'));
  el.classList.add('active');
  if (type==='lost')  el.classList.add('fc-lost');
  if (type==='found') el.classList.add('fc-found');
  _lfTypeFilter = type;
  _applyLFFilter();
}

function handleSearch(q) {
  if (!q) { _applyLFFilter(); return; }
  const lower = q.toLowerCase();
  const filtered = _lfItems.filter(i =>
    i.title.toLowerCase().includes(lower) ||
    (i.location||'').toLowerCase().includes(lower) ||
    (i.description||'').toLowerCase().includes(lower)
  );
  _renderLFItems(filtered);
}

/* ─── Static matches (keep for now) ─── */
const matches = [
  {lostId:'LF-2025-0083',foundId:'LF-2025-0078',score:87,lostEmoji:'🎒',foundEmoji:'🎒',lostTitle:'Blue North Face Backpack',foundTitle:'Dark Blue Wildcraft Bag',lostLoc:'Library',foundLoc:'Canteen',reasons:['Similar category','Color match','Nearby location','Same day range']},
  {lostId:'LF-2025-0081',foundId:'LF-2025-0084',score:74,lostEmoji:'🎧',foundEmoji:'📱',lostTitle:'Sony Headphones',foundTitle:'Black Electronics Found',lostLoc:'Seminar Hall A',foundLoc:'Cafeteria',reasons:['Electronics category','Black color','Campus proximity']},
];

function renderMatches() {
  document.getElementById('matchesList').innerHTML = matches.map(m=>`
    <div class="match-pair">
      <div class="match-hdr">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="score-ring">${m.score}%</div>
          <div><div style="font-family:'Syne',sans-serif;font-size:.88rem;font-weight:700;color:var(--match)">${m.score>=80?'🔥 Strong Match':'⚡ Possible Match'}</div>
          <div style="font-size:.72rem;color:var(--muted)">${m.lostId} ↔ ${m.foundId}</div></div></div>
        <div style="display:flex;gap:7px">
          <button class="btn btn-found btn-sm" onclick="showToast('✅','Match confirmed!')">✅ Confirm</button>
          <button class="btn btn-ghost btn-sm" onclick="showToast('✕','Dismissed.')">Dismiss</button>
        </div>
      </div>
      <div class="match-body">
        <div class="m-item"><div class="m-img mi-lost">${m.lostEmoji}</div>
          <div class="m-item-info"><h5>${m.lostTitle}</h5><p>📍 ${m.lostLoc}</p>
          <span class="type-badge badge-lost" style="position:static;display:inline-block;margin-top:5px">LOST</span></div></div>
        <div style="text-align:center;color:var(--match);font-size:20px">⇄</div>
        <div class="m-item"><div class="m-img mi-found">${m.foundEmoji}</div>
          <div class="m-item-info"><h5>${m.foundTitle}</h5><p>📍 ${m.foundLoc}</p>
          <span class="type-badge badge-found" style="position:static;display:inline-block;margin-top:5px">FOUND</span></div></div>
      </div>
      <div style="padding:0 16px 14px;display:flex;gap:6px;flex-wrap:wrap">
        ${m.reasons.map(r=>`<span class="reason-tag">✓ ${r}</span>`).join('')}
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════
   GRIEVANCE FORM STEPS
═══════════════════════════════════════ */
const cats = [
  {icon:'🌐',label:'Infrastructure / IT'},{icon:'📚',label:'Academic'},
  {icon:'🏠',label:'Hostel'},{icon:'🍽️',label:'Canteen / Food'},
  {icon:'🚌',label:'Transport'},{icon:'🏥',label:'Medical / Health'},
  {icon:'💰',label:'Fee / Finance'},{icon:'⚖️',label:'Harassment / Conduct'},
  {icon:'🏋️',label:'Sports / Facilities'},{icon:'📋',label:'Administration'},
];
const locs = ['Library','Canteen','Adminstrative building','Auditorium','Principal office','University Examination branch','J hub','CSE Department','ECE Department','EEE Department','Civil Department','Mechanical Department','Chemical Department','CRC','Hostel','Sports Complex'];

let gStep = 1;

function updateSteps() {
  ['sd1','sd2','sd3'].forEach((id,i) => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove('done','cur');
    if (i+1 < gStep) el.classList.add('done');
    else if (i+1 === gStep) el.classList.add('cur');
  });
  ['sl1','sl2'].forEach((id,i) => {
    const l = document.getElementById(id); if (!l) return;
    l.classList.remove('done'); if (i+1 < gStep) l.classList.add('done');
  });
}

function selectCat(cat, el) {
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const hi = document.getElementById('selectedCategory'); if (hi) hi.value = cat;
  const di = document.getElementById('categoryDisplay');  if (di) di.value = cat;
  gStep = 2; updateSteps();
  document.querySelectorAll('.step-form').forEach(f => f.classList.remove('active'));
  const s2 = document.getElementById('sf2'); if (s2) s2.classList.add('active');
}

function goPrev() {
  if (gStep <= 1) return; gStep--;
  updateSteps();
  document.querySelectorAll('.step-form').forEach(f => f.classList.remove('active'));
  const p = document.getElementById('sf' + gStep); if (p) p.classList.add('active');
}

function renderCatGrid() {
  document.getElementById('catGrid').innerHTML = cats.map(c=>`
    <div class="cat-card" onclick="selectCat('${c.label}',this)">
      <div class="ci">${c.icon}</div><div class="cn">${c.label}</div>
    </div>`).join('');
}

function renderLocGrid() {
  document.getElementById('locGrid').innerHTML = locs.map(l=>`
    <div class="loc-chip" onclick="selectLoc(this,'${l}')">${l}</div>`).join('');
}

/* ═══════════════════════════════════════
   DETAIL PANELS (static LF — kept as fallback)
═══════════════════════════════════════ */
function openLFDetail(item) {
  document.getElementById('dpHero').className = `dp-hero ${item.type}-bg`;
  document.getElementById('dpHero').innerHTML = `${item.emoji||'📦'}<button class="dp-close" onclick="closeDetail()">✕</button>`;
  document.getElementById('dpBody').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <span class="type-badge badge-${item.type}">${item.type.toUpperCase()}</span></div>
    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:6px;color:var(--text)">${item.title}</div>
    <p style="font-size:.84rem;color:var(--muted2);line-height:1.65;margin-bottom:16px">${item.desc||''}</p>
    <div class="dp-sec"><div class="dp-sec-title">Item Details</div>
      <div class="dp-field"><label>Category</label><span>${item.cat||'—'}</span></div>
      <div class="dp-field"><label>Color</label><span>${item.color||'—'}</span></div>
      <div class="dp-field"><label>Location</label><span>${item.loc||'—'}</span></div>
      <div class="dp-field"><label>Date</label><span>${item.date||'—'}</span></div>
      <div class="dp-field"><label>Posted by</label><span>${item.poster||'—'}</span></div>
      <div class="dp-field"><label>Reference</label><span>${item.id||'—'}</span></div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:14px">
      <div style="font-family:'Syne',sans-serif;font-size:.88rem;font-weight:700;margin-bottom:10px;color:var(--text)">📞 Contact</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-found btn-sm" onclick="showToast('📧','Message sent!')">📧 Send Message</button>
        <button class="btn btn-ghost btn-sm" onclick="showToast('🚩','Reported!')">🚩 Report</button>
        <button class="btn btn-ghost btn-sm" onclick="showToast('🔖','Saved!')">🔖 Save</button>
      </div>
    </div>`;
  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('show'); document.body.style.overflow = ''; }
function closeDetailEvt(e) { if (e.target === document.getElementById('detailOverlay')) closeDetail(); }

/* ═══════════════════════════════════════
   AI CHATBOT
═══════════════════════════════════════ */
const chatHistory = [];
function sendChat() {
  const inp = document.getElementById('chatInput');
  const msg = inp.value.trim(); if (!msg) return;
  inp.value = '';
  appendChat('user', msg);
  chatHistory.push({role:'user', content:msg});
  document.getElementById('chatTyping').style.display = 'flex';
  setTimeout(()=>{
    const replies = [
      "I'm looking into that for you! Please check the Grievance section for updates.",
      "You can submit a new grievance using the '✏️ Submit Grievance' option in the sidebar.",
      "For lost items, head to the Lost & Found section to browse or post.",
      "Your grievance has been noted. Expected resolution time is 2-3 working days.",
      "The admin team reviews all submitted grievances and assigns priority accordingly.",
      "Is there anything else I can help you with regarding your campus experience?",
    ];
    const reply = replies[Math.floor(Math.random()*replies.length)];
    document.getElementById('chatTyping').style.display = 'none';
    appendChat('bot', reply);
    chatHistory.push({role:'assistant', content:reply});
  }, 1200);
}
function appendChat(role, text) {
  const wrap = document.getElementById('chatMessages');
  const div  = document.createElement('div');
  div.className = role==='user' ? 'chat-msg chat-user' : 'chat-msg chat-bot';
  div.innerHTML = `<div class="chat-bubble">${text}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}
function chatKeydown(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }

/* ═══════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════ */
function setRole(btn){
  document.querySelectorAll('#loginPage .role-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const ri=document.getElementById('loginRoleInput'); if(ri) ri.value=btn.dataset.role||'student';
}
function setRegRole(btn,role){
  document.querySelectorAll('#registerPage .role-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rollWrap').style.display=role==='student'?'block':'none';
}
function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}
function handleLogin(){
  let ok=true;
  const e=document.getElementById('lEmail').value.trim();
  const p=document.getElementById('lPass').value;
  ['lEmailErr','lPassErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  if(!validEmail(e)){document.getElementById('lEmailErr').classList.add('show');ok=false;}
  if(!p){document.getElementById('lPassErr').classList.add('show');ok=false;}
  if(ok) document.getElementById('loginForm').submit();
}
function handleRegister(){
  let ok=true;
  const first=document.getElementById('rFirst').value.trim();
  const email=document.getElementById('rEmail').value.trim();
  const pass =document.getElementById('rPass').value;
  const conf =document.getElementById('rConfirm').value;
  const ok2  =document.getElementById('rAgree').checked;
  ['rFirstErr','rEmailErr','rPassErr','rConfErr','rAgreeErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  if(!first)            {document.getElementById('rFirstErr').classList.add('show');ok=false;}
  if(!validEmail(email)){document.getElementById('rEmailErr').classList.add('show');ok=false;}
  if(pass.length<8)     {document.getElementById('rPassErr').classList.add('show'); ok=false;}
  if(pass!==conf)       {document.getElementById('rConfErr').classList.add('show');  ok=false;}
  if(!ok2)              {document.getElementById('rAgreeErr').classList.add('show'); ok=false;}
  if(ok) document.getElementById('registerForm').submit();
}
function googleSignIn(page) {
  showToast('🔄','Redirecting to Google…');
  setTimeout(()=>{
    _showBanner(page==='login'?'loginSuccBox':'regSuccBox','🔗 Google Sign-In coming soon!','succ');
  },800);
}

/* ═══════════════════════════════════════
   MISC
═══════════════════════════════════════ */
function fChip(el){
  el.closest('.filter-row').querySelectorAll('.fc').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); showToast('🔽','Filter applied!');
}
function closeModal(){document.getElementById('successModal').classList.remove('show');}
function showToast(icon,msg){
  const t=document.getElementById('toast');
  document.getElementById('toastIcon').textContent=icon;
  document.getElementById('toastMsg').textContent=msg;
  t.classList.add('show'); clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove('show'),3000);
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  renderMatches();
  renderCatGrid();
  renderLocGrid();
  updateSteps();

  const gd=document.getElementById('gDate'); if(gd) gd.valueAsDate=new Date();
  const id=document.getElementById('iDate'); if(id) id.valueAsDate=new Date();
  if(document.getElementById('typeLost')) selectType('lost');

  document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));
  const sf1=document.getElementById('sf1'); if(sf1) sf1.classList.add('active');
  gStep=1; updateSteps();

  if (window._loggedIn === true) {
    showPage('app');
    if (window._msgs && window._msgs.length) {
      handleMsgs();
    } else {
      const role = window._userRole || 'student';
      if (role === 'admin') {
        Promise.all([loadAllGrievances(), loadAdminGrievances()]).then(() => {
          appView('admin', document.querySelector('[data-view="admin"]'));
        });
      } else {
        Promise.all([loadAllGrievances(), loadMyGrievances()]).then(() => {
          appView('grievances', document.querySelector('[data-view="grievances"]'));
        });
      }
    }
  } else if (window._msgs && window._msgs.length) {
    handleMsgs();
  } else {
    showPage('landing');
  }
});