/* ═══════════════════════════════════════
   THEME
═══════════════════════════════════════ */
(function () {
  if (typeof localStorage === 'undefined') return;
  const s = localStorage.getItem('campusai-theme');
  if (s) document.documentElement.setAttribute('data-theme', s);
})();

function toggleTheme() {
  const h    = document.documentElement;
  const dark = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', dark ? 'light' : 'dark');
  if (typeof localStorage !== 'undefined')
    localStorage.setItem('campusai-theme', dark ? 'light' : 'dark');
  showToast(dark ? '☀️' : '🌙', dark ? 'Light mode on!' : 'Dark mode on!');
}

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
function getAssignees(cat) { return CATEGORY_ASSIGNEES[cat] || ALL_ASSIGNEES; }
function buildAssigneeOptions(category, current) {
  const opts      = getAssignees(category);
  const unselected = !current || current === '—';
  let html = `<option value="—" ${unselected ? 'selected' : ''}>— Unassigned —</option>`;
  opts.forEach(o => { html += `<option value="${o}" ${current === o ? 'selected' : ''}>${o}</option>`; });
  if (current && current !== '—' && !opts.includes(current))
    html += `<option value="${current}" selected>${current}</option>`;
  return html;
}

/* ═══════════════════════════════════════
   PAGE SYSTEM
═══════════════════════════════════════ */
const PAGES = ['landingPage','loginPage','registerPage','appSidebar','appMain'];
function showPage(name) {
  PAGES.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  if      (name === 'landing')   { document.getElementById('landingPage').style.display  = 'block'; }
  else if (name === 'login')     { document.getElementById('loginPage').style.display    = 'block'; _clearAuthBanners(); }
  else if (name === 'register')  { document.getElementById('registerPage').style.display = 'block'; _clearAuthBanners(); }
  else if (name === 'app')       { document.getElementById('appSidebar').style.display   = 'flex';
                                   document.getElementById('appMain').style.display      = 'flex'; }
  window.scrollTo(0, 0);
}
function _clearAuthBanners() {
  ['loginErrBox','loginSuccBox','regErrBox','regSuccBox'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

/* VIEW SWITCHING */
const viewMeta = {
  grievances  : ['Grievance Management', 'Track and manage campus grievances'],
  'submit-grv': ['Submit a Grievance',   'File a new complaint'],
  'my-grv'    : ['My Grievances',        'Grievances you submitted'],
  'lf-browse' : ['Lost & Found',         'Browse all lost and found items'],
  'lf-post'   : ['Post an Item',         'Report a lost or found item'],
  'lf-matches': ['AI Matches',           'ML-powered lost & found matching'],
  messages    : ['Messages',             'Anonymous conversations about items'],
  admin       : ['Admin Panel',          'Manage all grievances & items'],
  analytics   : ['Analytics',           'Grievance & item statistics'],
  chatbot     : ['AI Chatbot',           'Ask anything about your campus'],
  profile     : ['My Profile',          'View and edit your account details'],
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
  if (name === 'lf-matches') loadLFMatches();
  if (name === 'messages')   loadMessageThreads();
  if (name === 'profile')    loadProfile();
}

/* FLASK MSG HANDLER */
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
  document.getElementById('modalDesc').textContent  = `"${subject}" has been registered.`;
  document.getElementById('modalRef').textContent   = ref;
  document.getElementById('modalBtn').onclick       = closeModal;
  document.getElementById('successModal').classList.add('show');
}

/* ═══════════════════════════════════════
   LIVE GRIEVANCE DATA
═══════════════════════════════════════ */
let _allGrievances = [], _myGrievances = [], _grvFilter = 'all', _grvCatFilter = '', _grvSearch = '';

async function loadAllGrievances() {
  try {
    const res = await fetch('/api/grievances');
    _allGrievances = await res.json();
    _renderGrvTable(_getFilteredGrv());
    _updateKPIs(_allGrievances);
    _updateNavBadges();
  } catch(e) { console.error(e); }
}
async function loadMyGrievances() {
  if (window._userRole !== 'student') return;
  try {
    const res = await fetch('/api/my_grievances');
    _myGrievances = await res.json();
    _renderMyGrv(_myGrievances);
    _updateNavBadges();
  } catch(e) { console.error(e); }
}
async function loadAdminGrievances() {
  if (window._userRole !== 'admin') return;
  try {
    const res = await fetch('/api/grievances');
    _allGrievances = await res.json();
    _renderAdminTable(_allGrievances);
    _updateKPIs(_allGrievances);
    _updateNavBadges();
  } catch(e) { console.error(e); }
}

/* ═══════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════ */
let _chartInstances = {};
function _destroyChart(key) {
  if (_chartInstances[key]) { _chartInstances[key].destroy(); delete _chartInstances[key]; }
}

async function loadAnalytics() {
  try {
    const res  = await fetch('/api/analytics');
    const data = await res.json();
    const { status, categories, monthly, priority, avg_resolution_days, auto_escalated, lf, assignees } = data;

    const total = status.pending + status.review + status.resolved + status.escalated;
    _setText('aPendingTotal', total);
    _setText('aResRateVal',   total ? `${Math.round(status.resolved / total * 100)}%` : '0%');
    _setText('aLFTotalVal',   lf.lost + lf.found);
    _setText('aAvgRes',       avg_resolution_days ? `${avg_resolution_days}d` : '—');

    _setText('aResPct', `${status.resolved}  (${total ? Math.round(status.resolved  / total * 100) : 0}%)`);
    _setText('aRevPct', `${status.review}    (${total ? Math.round(status.review    / total * 100) : 0}%)`);
    _setText('aPenPct', `${status.pending}   (${total ? Math.round(status.pending   / total * 100) : 0}%)`);
    _setText('aEscPct', `${status.escalated} (${total ? Math.round(status.escalated / total * 100) : 0}%)`);
    _setWidth('aResBar', total ? Math.round(status.resolved  / total * 100) : 0);
    _setWidth('aRevBar', total ? Math.round(status.review    / total * 100) : 0);
    _setWidth('aPenBar', total ? Math.round(status.pending   / total * 100) : 0);
    _setWidth('aEscBar', total ? Math.round(status.escalated / total * 100) : 0);

    _setText('aLostCount',  lf.lost);
    _setText('aFoundCount', lf.found);
    _setText('aMatchCount', lf.claimed);
    _setText('aAutoEsc', auto_escalated);

    requestAnimationFrame(() => {
      _renderStatusPieChart(status);
      _renderCategoryBarChart(categories);
      _renderMonthlyLineChart(monthly);
      _renderPriorityDoughnutChart(priority);
      _renderAssigneeBarChart(assignees);
    });
  } catch(e) {
    console.error('loadAnalytics:', e);
    showToast('❌', 'Failed to load analytics.');
  }
}

function _chartDefaults() {
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e2e8f0';
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor, font: { family: "'DM Sans', sans-serif", size: 12 }, padding: 16 } },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', titleColor: '#e2e8f0', bodyColor: '#94a3b8',
                 borderColor: 'rgba(79,142,247,0.3)', borderWidth: 1, padding: 10 }
    }
  };
}
function _drawEmptyMessage(canvas, msg) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#64748b'; ctx.font = '13px "DM Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
}
function _renderStatusPieChart(status) {
  const canvas = document.getElementById('chartStatus'); if (!canvas) return;
  _destroyChart('status');
  _chartInstances['status'] = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: ['Pending','In Review','Resolved','Escalated'],
            datasets: [{ data: [status.pending, status.review, status.resolved, status.escalated],
                         backgroundColor: ['#f7c34f','#4f8ef7','#38e2b8','#f75f5f'],
                         borderColor: 'rgba(15,23,42,0.8)', borderWidth: 3, hoverOffset: 8 }] },
    options: { ..._chartDefaults(), cutout: '62%',
               plugins: { ..._chartDefaults().plugins, legend: { ..._chartDefaults().plugins.legend, position: 'bottom' } } }
  });
}
function _renderCategoryBarChart(categories) {
  const canvas = document.getElementById('chartCategories'); if (!canvas) return;
  _destroyChart('categories');
  if (!categories || !categories.length) { _drawEmptyMessage(canvas, 'No grievances submitted yet'); return; }
  _chartInstances['categories'] = new Chart(canvas, {
    type: 'bar',
    data: { labels: categories.map(c => c.label.replace(' / ','/')),
            datasets: [{ label: 'Grievances', data: categories.map(c => c.count),
                         backgroundColor: 'rgba(79,142,247,0.75)', borderColor: '#4f8ef7',
                         borderWidth: 1, borderRadius: 6, borderSkipped: false }] },
    options: { ..._chartDefaults(), indexAxis: 'y',
               plugins: { ..._chartDefaults().plugins, legend: { display: false } },
               scales: { x: { ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
                               grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
                         y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } } } }
  });
}
function _renderMonthlyLineChart(monthly) {
  const canvas = document.getElementById('chartMonthly'); if (!canvas) return;
  _destroyChart('monthly');
  if (!monthly || !monthly.length) { _drawEmptyMessage(canvas, 'No monthly data yet'); return; }
  const labels = monthly.map(m => {
    const [y, mo] = m.month.split('-');
    return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
  });
  _chartInstances['monthly'] = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Total Submitted', data: monthly.map(m => m.total),
        borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,0.12)',
        borderWidth: 2.5, pointBackgroundColor: '#4f8ef7', pointRadius: 4, tension: 0.4, fill: true },
      { label: 'Resolved', data: monthly.map(m => m.resolved),
        borderColor: '#38e2b8', backgroundColor: 'rgba(56,226,184,0.08)',
        borderWidth: 2.5, pointBackgroundColor: '#38e2b8', pointRadius: 4, tension: 0.4, fill: true }
    ]},
    options: { ..._chartDefaults(),
               plugins: { ..._chartDefaults().plugins, legend: { ..._chartDefaults().plugins.legend, position: 'top' } },
               scales: { x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                         y: { ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
                              grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }
  });
}
function _renderPriorityDoughnutChart(priority) {
  const canvas = document.getElementById('chartPriority'); if (!canvas) return;
  _destroyChart('priority');
  _chartInstances['priority'] = new Chart(canvas, {
    type: 'pie',
    data: { labels: ['Low','Medium','High'],
            datasets: [{ data: [priority.Low, priority.Medium, priority.High],
                         backgroundColor: ['#38e2b8','#f7c34f','#f75f5f'],
                         borderColor: 'rgba(15,23,42,0.8)', borderWidth: 3, hoverOffset: 8 }] },
    options: { ..._chartDefaults(),
               plugins: { ..._chartDefaults().plugins, legend: { ..._chartDefaults().plugins.legend, position: 'bottom' } } }
  });
}
function _renderAssigneeBarChart(assignees) {
  const canvas = document.getElementById('chartAssignees'); if (!canvas) return;
  _destroyChart('assignees');
  if (!assignees || !assignees.length) { _drawEmptyMessage(canvas, 'No assignments yet'); return; }
  _chartInstances['assignees'] = new Chart(canvas, {
    type: 'bar',
    data: { labels: assignees.map(a => a.label),
            datasets: [{ label: 'Open Cases', data: assignees.map(a => a.count),
                         backgroundColor: ['rgba(247,195,79,0.75)','rgba(79,142,247,0.75)','rgba(56,226,184,0.75)',
                                           'rgba(247,95,95,0.75)','rgba(139,92,246,0.75)','rgba(251,146,60,0.75)'],
                         borderColor:     ['#f7c34f','#4f8ef7','#38e2b8','#f75f5f','#8b5cf6','#fb923c'],
                         borderWidth: 1, borderRadius: 6, borderSkipped: false }] },
    options: { ..._chartDefaults(),
               plugins: { ..._chartDefaults().plugins, legend: { display: false } },
               scales: { x: { ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 30 }, grid: { display: false } },
                         y: { ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
                              grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }
  });
}

function _setText(id, val) { const e = document.getElementById(id); if (e) e.textContent = String(val).trim(); }
function _setWidth(id, pct) { const e = document.getElementById(id); if (e) e.style.width = pct + '%'; }
function _updateKPIs(data) {
  _setText('kpiPending',  data.filter(g => g.status === 'pending').length);
  _setText('kpiReview',   data.filter(g => g.status === 'review').length);
  _setText('kpiResolved', data.filter(g => g.status === 'resolved').length);
  const sub = document.getElementById('grvTotal');
  if (sub) sub.textContent = `${data.length} total · Last updated just now`;
}
function _updateNavBadges() {
  ['nbAllGrv','nbAllGrvAdmin'].forEach(id => {
    const e = document.getElementById(id); if (e) e.textContent = _allGrievances.length;
  });
  const nb = document.getElementById('nbMyGrv');
  if (nb) nb.textContent = _myGrievances.length;
}

async function _pollNotificationBadge() {
  if (!window._loggedIn) return;
  try {
    const [nr, mr] = await Promise.all([
      fetch('/api/notifications/unread_count'),
      fetch('/api/messages/unread_count')
    ]);
    const nd = await nr.json(), md = await mr.json();
    const nb = document.getElementById('notifBadge');
    if (nb) { nb.textContent = nd.count || ''; nb.style.display = nd.count ? 'inline-flex' : 'none'; }
    const mb = document.getElementById('msgNavBadge');
    if (mb) { mb.textContent = md.count || ''; mb.style.display = md.count ? 'inline-flex' : 'none'; }
  } catch(e) {}
}

/* ═══════════════════════════════════════
   GRIEVANCE TABLE HELPERS
═══════════════════════════════════════ */
const statusLabel = s => ({ pending:'Pending', review:'In Review', resolved:'Resolved', escalated:'Escalated' }[s] || s);
const prioEmoji   = p => ({ high:'🔴', medium:'🟡', low:'🟢' }[p?.toLowerCase()] || '⚪');
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}
function _getFilteredGrv() {
  let list = _allGrievances;
  if (_grvFilter !== 'all') list = list.filter(g => g.status === _grvFilter);
  if (_grvCatFilter)        list = list.filter(g => g.category === _grvCatFilter);
  if (_grvSearch) {
    const q = _grvSearch.toLowerCase();
    list = list.filter(g =>
      (g.subject     || '').toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    );
  }
  return list;
}
function filterGrv(type, el) {
  document.querySelectorAll('#view-grievances .fc').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  _grvFilter = type;
  _renderGrvTable(_getFilteredGrv());
}
function filterGrvCat(val) { _grvCatFilter = val; _renderGrvTable(_getFilteredGrv()); }
function filterGrvSearch(val) {
  _grvSearch = val.trim();
  const clearBtn = document.getElementById('grvSearchClear');
  if (clearBtn) clearBtn.style.display = _grvSearch ? 'flex' : 'none';
  _renderGrvTable(_getFilteredGrv());
}
function clearGrvSearch() {
  _grvSearch = '';
  const inp = document.getElementById('grvSearchInput');
  if (inp) inp.value = '';
  const clearBtn = document.getElementById('grvSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  _renderGrvTable(_getFilteredGrv());
}

function _renderGrvTable(data) {
  const tbody = document.getElementById('grvTable'); if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No grievances found.</td></tr>`;
    return;
  }
  const isAdmin = window._userRole === 'admin';
  tbody.innerHTML = data.map(g => {
    const name     = g.first_name ? `${g.first_name} ${g.last_name||''}`.trim() : (window._userName||'You');
    const id       = `GRV-${String(g.id).padStart(4,'0')}`;
    const date     = g.created_at ? g.created_at.slice(0,10) : '';
    const prio     = (g.priority||'medium').toLowerCase();
    const votes    = g.vote_count||0, comments = g.comment_count||0;
    const voted    = g.user_voted > 0, isOwner = g.user_id === window._userId;
    const escBadge = g.status === 'escalated'
      ? `<span style="font-size:.65rem;padding:2px 7px;border-radius:6px;background:rgba(247,95,95,.12);color:#f75f5f;border:1px solid rgba(247,95,95,.25);font-weight:700;margin-left:4px;">⏰ Auto-escalated</span>`
      : '';
    let voteHtml;
    if (isAdmin)
      voteHtml = `<span style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;cursor:default;">👍 ${votes}</span>`;
    else if (isOwner)
      voteHtml = `<span style="display:flex;align-items:center;gap:7px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);color:#7eb3ff;padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;opacity:.5;cursor:not-allowed;">👍 ${votes}</span>`;
    else
      voteHtml = `<span class="vote-chip ${voted?'voted':''}" onclick="event.stopPropagation();quickVote(${g.id},this)" style="display:flex;align-items:center;gap:7px;background:${voted?'rgba(247,195,79,.15)':'rgba(255,255,255,.05)'};border:1px solid ${voted?'#f7c34f':'var(--border)'};color:${voted?'#f7c34f':'var(--text)'};padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;cursor:pointer;">👍 <span class="vc-count">${votes}</span></span>`;
    return `<tr onclick="openGrvDetailDB(${g.id})" style="cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
      <td><div style="font-weight:700;color:var(--accent);font-size:.78rem;">${id}</div></td>
      <td><div style="font-weight:700;font-size:.92rem;color:var(--text);margin-bottom:3px;">${g.subject||'—'}${escBadge}</div><div style="color:var(--muted2);font-size:.76rem;margin-bottom:8px;">By ${name}</div><div style="display:flex;align-items:center;gap:10px;">${voteHtml}<span style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:12px;font-size:.78rem;font-weight:600;">💬 ${comments}</span></div></td>
      <td><div style="font-size:.8rem;font-weight:600;color:var(--accent);">${g.category||'—'}</div></td>
      <td><span class="prio p-${prio}" style="padding:6px 10px;border-radius:10px;font-weight:700;">${prioEmoji(g.priority)} ${g.priority||'Medium'}</span></td>
      <td><span class="tag tag-${g.status||'pending'}" style="padding:6px 12px;border-radius:10px;font-weight:700;">${statusLabel(g.status||'pending')}</span></td>
      <td style="font-size:.8rem;color:var(--muted2);">${g.assigned_to||'—'}</td>
      <td style="font-size:.76rem;color:var(--muted);">${date}</td>
      <td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openGrvDetailDB(${g.id})">View</button></td>
    </tr>`;
  }).join('');
}

function _renderMyGrv(data) {
  const container = document.getElementById('myGrvList'); if (!container) return;
  const sub = document.getElementById('myGrvSub');
  if (sub) sub.textContent = `${data.length} grievance${data.length!==1?'s':''} submitted by you`;
  if (!data.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted)"><div style="font-size:2.5rem;margin-bottom:12px">📋</div><div style="font-size:.93rem;margin-bottom:16px">You haven't submitted any grievances yet.</div><button class="btn btn-primary btn-sm" onclick="appView('submit-grv',null)">✏️ Submit Your First Grievance</button></div>`;
    return;
  }
  const escDays = window._escalationDays || 3;
  container.innerHTML = data.map(g => {
    const id   = `GRV-${String(g.id).padStart(4,'0')}`, date = g.created_at ? g.created_at.slice(0,10) : '';
    const prio = (g.priority||'medium').toLowerCase();
    const prog = g.status==='resolved'?100:g.status==='review'?55:g.status==='escalated'?80:15;
    const votes = g.vote_count||0, comments = g.comment_count||0;
    const escNotice = g.status === 'escalated'
      ? `<div style="margin-top:6px;font-size:.75rem;padding:5px 10px;border-radius:7px;background:rgba(247,95,95,.08);border:1px solid rgba(247,95,95,.2);color:#f75f5f;">⏰ Auto-escalated after ${escDays} days — admin has been alerted</div>`
      : '';
    return `<div class="grv-card" onclick="openGrvDetailDB(${g.id})" style="cursor:pointer">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px">
        <div>
          <div class="g-id" style="margin-bottom:4px">${id} · ${date}</div>
          <div style="font-weight:600;font-size:.93rem;color:var(--text)">${g.subject||'—'}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">${g.category||'—'}</div>
          <div style="font-size:.78rem;color:var(--muted2);margin-top:4px;line-height:1.5">${g.description?g.description.slice(0,100)+(g.description.length>100?'…':''):''}</div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);color:#7eb3ff;font-size:.75rem;font-weight:600;opacity:.5;cursor:not-allowed;">👍 ${votes}</span>
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2);font-size:.75rem;font-weight:500;">💬 ${comments}</span>
          </div>
          ${escNotice}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
          <span class="tag tag-${g.status||'pending'}">${statusLabel(g.status||'pending')}</span>
          <span class="prio p-${prio}">${prioEmoji(g.priority)} ${g.priority||'Medium'}</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-bottom:5px"><span>Progress</span><span>${prog}%</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
    </div>`;
  }).join('');
}

function _renderAdminTable(data) {
  const tbody = document.getElementById('adminTable'); if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No grievances yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(g => {
    const name  = g.first_name ? `${g.first_name} ${g.last_name||''}`.trim() : 'Unknown';
    const id    = `GRV-${String(g.id).padStart(4,'0')}`, prio = g.priority||'Medium';
    const votes = g.vote_count||0, comments = g.comment_count||0;
    const rowBg = g.status === 'escalated' ? 'background:rgba(247,95,95,.04);' : '';
    const escTag = g.status === 'escalated'
      ? `<span style="font-size:.62rem;padding:1px 6px;border-radius:4px;background:rgba(247,95,95,.15);color:#f75f5f;border:1px solid rgba(247,95,95,.3);font-weight:700;margin-left:5px;">⏰ ESC</span>`
      : '';
    return `<tr id="admin-row-${g.id}" style="${rowBg}" onmouseover="this.style.background='rgba(79,142,247,.04)'" onmouseout="this.style.background='${g.status==='escalated'?'rgba(247,95,95,.04)':''}'">
      <td style="padding:11px 14px;font-size:.73rem;color:var(--muted)">${id}</td>
      <td style="padding:11px 14px"><div style="font-size:.83rem;font-weight:600;color:var(--text)">📢 ${g.subject||'—'}${escTag}</div><div style="font-size:.71rem;color:var(--muted)">${g.category||'—'}</div><div style="display:flex;gap:6px;margin-top:4px"><span style="padding:3px 10px;border-radius:4px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.3);color:#7eb3ff;font-size:.72rem;font-weight:600;">▲ ${votes}</span><span style="padding:3px 10px;border-radius:4px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.3);color:#7eb3ff;font-size:.72rem;font-weight:600;">💬 ${comments}</span></div></td>
      <td style="padding:11px 14px;font-size:.8rem;color:var(--muted2)">${name}</td>
      <td style="padding:11px 14px"><select class="prio-sel" onchange="updateGrvPriority(${g.id},this.value)" onclick="event.stopPropagation()"><option value="Low" ${prio==='Low'?'selected':''}>🟢 Low</option><option value="Medium" ${prio==='Medium'?'selected':''}>🟡 Medium</option><option value="High" ${prio==='High'?'selected':''}>🔴 High</option></select></td>
      <td style="padding:11px 14px"><select class="prio-sel" onchange="updateGrvStatus(${g.id},this.value)" onclick="event.stopPropagation()"><option value="pending" ${g.status==='pending'?'selected':''}>Pending</option><option value="review" ${g.status==='review'?'selected':''}>In Review</option><option value="resolved" ${g.status==='resolved'?'selected':''}>Resolved</option><option value="escalated" ${g.status==='escalated'?'selected':''}>Escalated</option></select></td>
      <td style="padding:11px 14px"><select class="prio-sel" onchange="updateGrvAssignee(${g.id},this.value)" onclick="event.stopPropagation()">${buildAssigneeOptions(g.category,g.assigned_to)}</select></td>
      <td style="padding:11px 14px"><div style="display:flex;gap:5px;align-items:center">
        <button class="btn btn-ghost btn-xs" onclick="openGrvDetailDB(${g.id})">👁️</button>
        <button class="btn btn-found btn-xs" onclick="updateGrvStatus(${g.id},'resolved');showToast('✅','Resolved!')">✅</button>
        <button class="btn btn-ghost btn-xs" onclick="updateGrvStatus(${g.id},'escalated');showToast('🔺','Escalated!')">🔺</button>
        <button class="btn btn-xs" style="background:rgba(247,95,95,.12);color:var(--lost);border:1px solid rgba(247,95,95,.25);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:.72rem" onclick="confirmDeleteGrievance(${g.id},'${(g.subject||'').replace(/'/g,"\\'")}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function quickVote(id, chipEl) {
  if (window._userRole==='admin') { showToast('🚫','Admins cannot upvote.'); return; }
  if (!window._loggedIn) { showToast('🔒','Please log in to vote.'); return; }
  const g = _allGrievances.find(x=>x.id===id)||_myGrievances.find(x=>x.id===id);
  if (g && g.user_id === window._userId) { showToast('🚫','You cannot upvote your own grievance.'); return; }
  try {
    const res  = await fetch(`/api/grievance/${id}/vote`,{method:'POST'});
    const data = await res.json();
    if (!data.ok) return;
    [_allGrievances,_myGrievances].forEach(arr => {
      const g = arr.find(x=>x.id===id);
      if (g) { g.vote_count = data.vote_count; g.user_voted = data.voted ? 1 : 0; }
    });
    if (chipEl) {
      const c = chipEl.querySelector('.vc-count'); if (c) c.textContent = data.vote_count;
      chipEl.style.background  = data.voted ? 'rgba(247,195,79,.15)' : 'rgba(255,255,255,.05)';
      chipEl.style.borderColor = data.voted ? '#f7c34f' : 'var(--border)';
      chipEl.style.color       = data.voted ? '#f7c34f' : 'var(--text)';
    }
    showToast(data.voted ? '👍' : '👋', data.voted ? 'Upvoted!' : 'Vote removed.');
  } catch(e) { showToast('❌','Could not register vote.'); }
}

async function loadComments(grievanceId) {
  const container = document.getElementById('comments-list'); if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--muted);font-size:.8rem">Loading…</div>`;
  try {
    const res = await fetch(`/api/grievance/${grievanceId}/comments`);
    renderComments(await res.json(), container);
  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--lost);font-size:.8rem">Failed to load comments.</div>`;
  }
}
function renderComments(comments, container) {
  if (!container) return;
  if (!comments.length) {
    container.innerHTML = `<div style="text-align:center;padding:24px 16px;color:var(--muted);font-size:.8rem;"><div style="font-size:1.6rem;margin-bottom:6px">💬</div>No comments yet.</div>`;
    return;
  }
  container.innerHTML = comments.map(c => {
    const name    = `${c.first_name} ${c.last_name||''}`.trim();
    const isAdmin = c.is_admin || c.role === 'admin';
    const author  = isAdmin ? 'Admin' : name;
    let ts = '';
    if (c.created_at) {
      const d   = new Date(c.created_at.replace(' ','T'));
      const now = new Date();
      ts = d.toDateString() === now.toDateString()
        ? `Today ${d.toTimeString().slice(0,5)}`
        : `${d.getDate()} ${d.toLocaleString('default',{month:'short'})} ${d.toTimeString().slice(0,5)}`;
    }
    return `<div style="margin:8px 10px;padding:12px 14px;border-radius:10px;border:1px solid ${isAdmin?'rgba(79,142,247,.3)':'rgba(255,255,255,.07)'};background:${isAdmin?'rgba(79,142,247,.08)':'rgba(255,255,255,.03)'};">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:28px;height:28px;border-radius:7px;background:${isAdmin?'linear-gradient(135deg,#4f8ef7,#7c3aed)':'linear-gradient(135deg,var(--accent),var(--accent2))'};display:flex;align-items:center;justify-content:center;font-size:${isAdmin?'.9':'.68'}rem;color:#fff;">${isAdmin?'🛡️':author.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>
        <span style="font-size:.8rem;font-weight:700;color:var(--text);">${author}</span>
        ${isAdmin?`<span style="font-size:.62rem;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(79,142,247,.18);color:#7eb3ff;">Official</span>`:''}
        <span style="font-size:.7rem;color:var(--muted);margin-left:auto;">${ts}</span>
      </div>
      <div style="font-size:.83rem;color:var(--muted2);line-height:1.6;padding-left:36px;word-break:break-word;">${escHtml(c.body)}</div>
    </div>`;
  }).join('');
}
async function submitComment(grievanceId) {
  if (window._userRole==='admin') { showToast('🚫','Admins cannot comment.'); return; }
  if (!window._loggedIn) { showToast('🔒','Please log in.'); return; }
  const inp = document.getElementById('comment-input'); if (!inp) return;
  const body = inp.value.trim(); if (!body) { showToast('⚠️','Comment cannot be empty.'); return; }
  const btn = document.getElementById('comment-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
  try {
    const res  = await fetch(`/api/grievance/${grievanceId}/comments`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({body}) });
    const data = await res.json();
    if (data.ok) {
      inp.value = '';
      [_allGrievances,_myGrievances].forEach(arr => {
        const g = arr.find(x=>x.id===grievanceId); if (g) g.comment_count = (g.comment_count||0)+1;
      });
      await loadComments(grievanceId);
      showToast('💬','Comment posted!');
    } else { showToast('❌', data.error||'Failed.'); }
  } catch(e) { showToast('❌','Network error.'); }
  finally { if(btn){btn.disabled=false;btn.textContent='Post';} }
}
function commentKeydown(e, grvId) { if (e.key==='Enter'&&(e.ctrlKey||e.metaKey)) { e.preventDefault(); submitComment(grvId); } }

function confirmDeleteGrievance(id, subject) {
  const overlay = document.createElement('div');
  overlay.id = 'deleteConfirmOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  overlay.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 28px;max-width:420px;width:90%;text-align:center;">
    <div style="font-size:2.8rem;margin-bottom:14px">🗑️</div>
    <h3 style="font-family:'Syne',sans-serif;color:var(--text);margin-bottom:8px">Delete Grievance?</h3>
    <div style="background:rgba(247,95,95,.08);border:1px solid rgba(247,95,95,.2);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:.84rem;color:var(--lost);">"${subject}"</div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn btn-ghost" onclick="document.getElementById('deleteConfirmOverlay').remove()">Cancel</button>
      <button class="btn" style="background:var(--lost);color:#fff;border:none;padding:9px 22px;border-radius:9px;cursor:pointer;font-weight:600" onclick="executeDeleteGrievance(${id})">🗑️ Delete</button>
    </div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
async function executeDeleteGrievance(id) {
  document.getElementById('deleteConfirmOverlay')?.remove();
  try {
    const res  = await fetch(`/api/grievance/${id}/delete`,{method:'DELETE'});
    const data = await res.json();
    if (data.ok) {
      _allGrievances = _allGrievances.filter(g=>g.id!==id);
      _myGrievances  = _myGrievances.filter(g=>g.id!==id);
      const row = document.getElementById(`admin-row-${id}`);
      if (row) { row.style.opacity='0'; row.style.transform='translateX(-20px)'; row.style.transition='all .3s'; setTimeout(()=>row.remove(),300); }
      _renderGrvTable(_getFilteredGrv()); _renderMyGrv(_myGrievances);
      _renderAdminTable(_allGrievances); _updateKPIs(_allGrievances); _updateNavBadges();
      closeDetail(); showToast('🗑️','Deleted.');
    } else { showToast('❌','Failed to delete.'); }
  } catch(e) { showToast('❌','Network error.'); }
}
async function updateGrvPriority(id, priority) {
  try {
    await fetch(`/api/grievance/${id}/update`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({priority})});
    [_allGrievances,_myGrievances].forEach(arr=>{const g=arr.find(x=>x.id===id);if(g)g.priority=priority;});
    showToast('✅',`Priority → ${priority}`);
    _renderGrvTable(_getFilteredGrv()); _renderMyGrv(_myGrievances); _renderAdminTable(_allGrievances);
  } catch(e) { showToast('❌','Failed.'); }
}
async function updateGrvStatus(id, status) {
  try {
    await fetch(`/api/grievance/${id}/update`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    [_allGrievances,_myGrievances].forEach(arr=>{const g=arr.find(x=>x.id===id);if(g)g.status=status;});
    showToast('✅',`Status → ${statusLabel(status)}`);
    _renderGrvTable(_getFilteredGrv()); _updateKPIs(_allGrievances);
    _renderAdminTable(_allGrievances); _renderMyGrv(_myGrievances);
  } catch(e) { showToast('❌','Failed.'); }
}
async function updateGrvAssignee(id, assigned_to) {
  try {
    await fetch(`/api/grievance/${id}/update`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assigned_to})});
    [_allGrievances,_myGrievances].forEach(arr=>{const g=arr.find(x=>x.id===id);if(g)g.assigned_to=assigned_to;});
    showToast('✅', assigned_to==='—' ? 'Assignee cleared' : `Assigned → ${assigned_to}`);
    _renderGrvTable(_getFilteredGrv());
  } catch(e) { showToast('❌','Failed.'); }
}

function openGrvDetailDB(id) {
  const g = _allGrievances.find(x=>x.id===id)||_myGrievances.find(x=>x.id===id);
  if (!g) { showToast('⚠️','Could not load details.'); return; }
  const name    = g.first_name ? `${g.first_name} ${g.last_name||''}`.trim() : (window._userName||'You');
  const grvId   = `GRV-${String(g.id).padStart(4,'0')}`;
  const prio    = (g.priority||'medium').toLowerCase();
  const prog    = g.status==='resolved'?100:g.status==='review'?55:g.status==='escalated'?80:15;
  const isAdmin = window._userRole==='admin', isOwner = g.user_id===window._userId;
  const votes   = g.vote_count||0, comments = g.comment_count||0, voted = g.user_voted>0;
  const escDays = window._escalationDays || 3;

  document.getElementById('dpHero').className = 'dp-hero grv-bg';
  document.getElementById('dpHero').innerHTML = `📢<button class="dp-close" onclick="closeDetail()">✕</button>`;

  let voteHtml;
  if (isAdmin)
    voteHtml = `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--muted);font-size:.83rem;font-weight:600;cursor:default;">👍 Upvotes <span style="background:rgba(255,255,255,.08);border-radius:20px;padding:1px 7px;font-size:.7rem;">${votes}</span></div>`;
  else if (isOwner)
    voteHtml = `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:8px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);color:#7eb3ff;font-size:.83rem;font-weight:600;opacity:.45;cursor:not-allowed;">👍 Upvote <span style="background:rgba(79,142,247,.2);border-radius:20px;padding:1px 7px;font-size:.7rem;">${votes}</span></div>`;
  else
    voteHtml = `<button id="dp-vote-${g.id}" onclick="quickVote(${g.id},null)" style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:8px;background:${voted?'rgba(79,142,247,.25)':'rgba(79,142,247,.12)'};border:1px solid rgba(79,142,247,.3);color:${voted?'#fff':'#7eb3ff'};font-size:.83rem;font-weight:600;cursor:pointer;outline:none;">👍 <span class="vote-label">${voted?'Voted':'Upvote'}</span><span style="background:rgba(79,142,247,.25);border-radius:20px;padding:1px 7px;font-size:.7rem;"><span class="vc-count">${votes}</span></span></button>`;

  let commentHtml;
  if (!window._loggedIn)
    commentHtml = `<div style="text-align:center;padding:14px;font-size:.82rem;color:var(--muted)"><a href="#" onclick="showPage('login')" class="link">Sign in</a> to comment.</div>`;
  else if (isAdmin)
    commentHtml = `<div style="padding:14px;font-size:.81rem;color:var(--muted);">🛡️ Admins do not comment.</div>`;
  else
    commentHtml = `<div style="border:1px solid rgba(79,142,247,.2);border-top:none;border-radius:0 0 8px 8px;background:rgba(79,142,247,.04);padding:12px;">
      <textarea id="comment-input" placeholder="Share your thoughts…" onkeydown="commentKeydown(event,${g.id})" maxlength="1000" style="background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.3);color:var(--text);width:100%;min-height:90px;box-sizing:border-box;border-radius:8px;padding:8px;font-family:inherit;font-size:.84rem;resize:vertical;" oninput="const h=document.getElementById('char-hint');if(h)h.textContent=this.value.length+' / 1000'"></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span id="char-hint" style="font-size:.7rem;color:var(--muted)">0 / 1000</span>
        <button id="comment-submit-btn" class="btn btn-primary btn-sm" onclick="submitComment(${g.id})">Post</button>
      </div></div>`;

  const escNotice = g.status === 'escalated'
    ? `<span style="font-size:.72rem;padding:4px 10px;border-radius:8px;background:rgba(247,95,95,.12);color:#f75f5f;border:1px solid rgba(247,95,95,.25);font-weight:600;">⏰ Auto-escalated after ${escDays} days</span>`
    : '';

  document.getElementById('dpBody').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span class="tag tag-${g.status||'pending'}">${statusLabel(g.status||'pending')}</span>
      <span class="prio p-${prio}">${prioEmoji(g.priority)} ${g.priority||'Medium'}</span>
      ${escNotice}
    </div>
    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:8px;color:var(--text)">${g.subject||'—'}</div>
    <p style="font-size:.84rem;color:var(--muted2);line-height:1.65;margin-bottom:16px">${g.description||'—'}</p>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
      ${voteHtml}
      <span style="font-size:.82rem;color:var(--muted2)">💬 <span id="dp-comment-count-${g.id}">${comments}</span> comment${comments!==1?'s':''}</span>
    </div>
    <div class="dp-sec"><div class="dp-sec-title">Details</div>
      <div class="dp-field"><label>ID</label><span>${grvId}</span></div>
      <div class="dp-field"><label>Category</label><span>${g.category||'—'}</span></div>
      <div class="dp-field"><label>Location</label><span>${g.location||'—'}</span></div>
      <div class="dp-field"><label>Incident Date</label><span>${g.incident_date||'—'}</span></div>
      <div class="dp-field"><label>Submitted by</label><span>${name}</span></div>
      <div class="dp-field"><label>Assigned To</label><span>${g.assigned_to||'—'}</span></div>
      <div class="dp-field"><label>Submitted On</label><span>${(g.created_at||'').slice(0,10)}</span></div>
    </div>
    ${isAdmin ? `<div class="dp-sec"><div class="dp-sec-title">🛡️ Admin Controls</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
        <div><label class="f-lbl" style="font-size:.73rem">Priority</label>
          <select class="prio-sel" style="width:100%;margin-top:4px" onchange="updateGrvPriority(${g.id},this.value)">
            <option value="Low" ${(g.priority||'')==='Low'?'selected':''}>🟢 Low</option>
            <option value="Medium" ${(g.priority||'Medium')==='Medium'?'selected':''}>🟡 Medium</option>
            <option value="High" ${(g.priority||'')==='High'?'selected':''}>🔴 High</option>
          </select></div>
        <div><label class="f-lbl" style="font-size:.73rem">Status</label>
          <select class="prio-sel" style="width:100%;margin-top:4px" onchange="updateGrvStatus(${g.id},this.value)">
            <option value="pending" ${g.status==='pending'?'selected':''}>Pending</option>
            <option value="review" ${g.status==='review'?'selected':''}>In Review</option>
            <option value="resolved" ${g.status==='resolved'?'selected':''}>Resolved</option>
            <option value="escalated" ${g.status==='escalated'?'selected':''}>Escalated</option>
          </select></div>
      </div>
      <div style="margin-top:10px"><label class="f-lbl" style="font-size:.73rem">Assign To</label>
        <select class="prio-sel" style="width:100%;margin-top:4px" onchange="updateGrvAssignee(${g.id},this.value)">${buildAssigneeOptions(g.category,g.assigned_to)}</select>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" style="background:rgba(247,95,95,.12);color:var(--lost);border:1px solid rgba(247,95,95,.25);width:100%;justify-content:center" onclick="closeDetail();confirmDeleteGrievance(${g.id},'${(g.subject||'').replace(/'/g,"\\'")}')">🗑️ Delete Grievance</button>
      </div></div>` : ''}
    <div class="dp-sec"><div class="dp-sec-title">Progress</div>
      <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-top:5px"><span>Submitted</span><span>In Review</span><span>Resolved</span></div>
    </div>
    <div class="dp-sec"><div class="dp-sec-title">💬 Community Discussion</div>
      <div id="comments-list" style="margin-top:2px;max-height:320px;overflow-y:auto;border-radius:8px;border:1px solid rgba(79,142,247,.2);background:rgba(79,142,247,.04);"></div>
      ${commentHtml}
    </div>`;

  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  loadComments(g.id);
}

async function loadNotifications() {
  try {
    const res  = await fetch('/api/notifications');
    const data = await res.json();
    const unreadCount = data.filter(n => !n.is_read).length;
    const hdr = document.getElementById('notifPanelHeader');
    if (hdr) {
      const badge = unreadCount > 0
        ? `<span style="background:var(--lost);color:#fff;font-size:.6rem;font-weight:800;padding:1px 6px;border-radius:10px;margin-left:6px;">${unreadCount} new</span>`
        : '';
      const markBtn = unreadCount > 0
        ? `<button onclick="markAllNotifRead()" style="font-size:.72rem;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;font-weight:600;">Mark all read</button>`
        : '';
      hdr.innerHTML = `<span>Notifications${badge}</span>${markBtn}`;
    }
    let html = '';
    data.forEach(n => {
      const isEsc  = n.message && n.message.includes('AUTO-ESCALATED');
      const unread = !n.is_read;
      let cls = 'notif-item';
      if (unread) cls += ' notif-unread';
      if (isEsc)  cls += ' notif-esc';
      html += `<div class="${cls}" data-id="${n.id}">${n.message}<div style="font-size:.68rem;color:var(--muted);margin-top:4px">${(n.created_at||'').slice(0,16)}</div></div>`;
    });
    document.getElementById('notifList').innerHTML = html || '<div class="notif-item" style="color:var(--muted)">No notifications yet.</div>';
    fetch('/api/notifications/mark_read', {method:'POST'}).then(() => _pollNotificationBadge());
  } catch(e) {
    document.getElementById('notifList').innerHTML = '<div class="notif-item" style="color:var(--muted)">Failed to load.</div>';
  }
}

async function markAllNotifRead() {
  await fetch('/api/notifications/mark_read', {method:'POST'});
  _pollNotificationBadge();
  loadNotifications();
}

function toggleNotifications() {
  const p = document.getElementById('notifPanel');
  p.classList.toggle('show');
  if (p.classList.contains('show')) {
    loadNotifications();
    setTimeout(() => {
      document.addEventListener('click', _closeNotifOnOutside, {once: true, capture: true});
    }, 50);
  }
}
function _closeNotifOnOutside(e) {
  const panel = document.getElementById('notifPanel');
  const iconBtn = panel?.closest('.tb-r')?.querySelector('.icon-btn');
  if (panel && !panel.contains(e.target) && (!iconBtn || !iconBtn.contains(e.target))) {
    panel.classList.remove('show');
  }
}

/* ═══════════════════════════════════════
   LOST & FOUND
═══════════════════════════════════════ */
let _lfItems = [], _lfTypeFilter = 'all';
function _lfEmoji(cat) {
  const map = {'🎒 Bags & Accessories':'🎒','📱 Electronics':'📱','📄 Documents / ID Cards':'📄',
               '👕 Clothing':'👕','🔑 Keys':'🔑','📚 Books / Stationery':'📚','📦 Other':'📦'};
  return map[cat] || '📦';
}
async function loadLFItems() {
  const grid = document.getElementById('lfGrid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Loading…</div>`;
  try {
    const res = await fetch('/api/lf/items');
    _lfItems = await res.json();
    _applyLFFilter();
    _updateLFKPIs();
  } catch(e) {
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--lost)">Failed to load items.</div>`;
  }
}

/* ─────────────────────────────────────────────────────────
   CHANGE 1 of 2 — _updateLFKPIs refreshes the live count
   shown beside the item total in the browse panel header.
   ───────────────────────────────────────────────────────── */
function _updateLFKPIs() {
  const lostCount  = _lfItems.filter(i => i.type === 'lost').length;
  const foundCount = _lfItems.filter(i => i.type === 'found').length;

  _setText('lfKpiLost',  lostCount);
  _setText('lfKpiFound', foundCount);

  // Live panel count
  const c = document.getElementById('lfItemCount');
  if (c) c.textContent = `${_lfItems.length} item${_lfItems.length !== 1 ? 's' : ''} · Updated just now`;

  // Filter chip count badges
  const lostChip  = document.getElementById('lfChipLost');
  const foundChip = document.getElementById('lfChipFound');
  const allChip   = document.getElementById('lfChipAll');
  if (lostChip)  lostChip.dataset.count  = lostCount;
  if (foundChip) foundChip.dataset.count = foundCount;
  if (allChip)   allChip.dataset.count   = _lfItems.length;

  // ── FIX: update sidebar nav badges (nbLFItems for student, nbLFItemsAdmin for admin) ──
  const nbStudent = document.getElementById('nbLFItems');
  const nbAdmin   = document.getElementById('nbLFItemsAdmin');
  if (nbStudent) nbStudent.textContent = _lfItems.length;
  if (nbAdmin)   nbAdmin.textContent   = _lfItems.length;
}

function _applyLFFilter() {
  let list = _lfItems;
  if (_lfTypeFilter !== 'all') list = list.filter(i=>i.type===_lfTypeFilter);
  _renderLFItems(list);
}
function filterLF(type, el) {
  document.querySelectorAll('#view-lf-browse .fc').forEach(c=>c.classList.remove('active','fc-lost','fc-found'));
  el.classList.add('active');
  if (type==='lost')  el.classList.add('fc-lost');
  if (type==='found') el.classList.add('fc-found');
  _lfTypeFilter = type;
  _applyLFFilter();
}
function handleSearch(q) {
  if (!q) { _applyLFFilter(); return; }
  const l = q.toLowerCase();
  _renderLFItems(_lfItems.filter(i =>
    i.title.toLowerCase().includes(l) ||
    (i.location||'').toLowerCase().includes(l) ||
    (i.description||'').toLowerCase().includes(l)
  ));
}

/* ─────────────────────────────────────────────────────────
   CHANGE 2 of 2 — Button text changed from
   "✋ I Found It" / "✋ I Lost It"  →  "💬 Send Message"
   ───────────────────────────────────────────────────────── */
function _renderLFItems(list) {
  const grid = document.getElementById('lfGrid'); if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--muted)"><div style="font-size:2.5rem;margin-bottom:12px">🗂️</div><div style="font-size:.93rem;margin-bottom:16px">No items found.</div><button class="btn btn-primary btn-sm student-only" onclick="appView('lf-post',null)">➕ Post an Item</button></div>`;
    return;
  }
  grid.innerHTML = list.map(item => {
    const emoji   = _lfEmoji(item.category);
    const dateStr = item.date || (item.created_at ? item.created_at.slice(0,10) : '');
    const hasImg  = item.image_path && item.image_path.trim() !== '';
    const imgHtml = hasImg
      ? `<img src="${item.image_path}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
      : emoji;
    return `<div class="item-card" onclick="openLFDetailDB(${item.id})">
      <div class="item-img img-${item.type}" style="${hasImg?'padding:0;overflow:hidden;':''}">
        ${imgHtml}
        <span class="type-badge badge-${item.type}" style="${hasImg?'position:absolute;top:8px;left:8px;':''}">${item.type.toUpperCase()}</span>
        <span class="urg-badge urg-m">🟡 Medium</span>
      </div>
      <div class="item-body">
        <div class="item-cat">${item.category||'General'}</div>
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-desc">${item.description?escHtml(item.description).slice(0,90)+(item.description.length>90?'…':''):''}</div>
        <div class="item-meta">
          ${item.location    ?`<span class="meta-chip">📍 ${escHtml(item.location)}</span>`:''}
          ${dateStr          ?`<span class="meta-chip">📅 ${dateStr}</span>`:''}
          ${item.color       ?`<span class="meta-chip">🎨 ${escHtml(item.color)}</span>`:''}
          ${item.locker_number&&item.type==='found'?`<span class="meta-chip" style="color:var(--found)">🔐 Locker ${escHtml(item.locker_number)}</span>`:''}
        </div>
        <div class="item-foot">
          <div style="display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--muted2)"><div class="poster-av">👤</div>Anonymous</div>
          ${window._userRole !== 'admin' ? `<button class="btn btn-primary btn-xs"
            onclick="event.stopPropagation();startMessageFromItem(${item.id},'${escHtml(item.title).replace(/'/g,"\\'")}',${item.user_id})">
            💬 Send Message
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════
   LOST & FOUND DETAIL PANEL
═══════════════════════════════════════ */
function openLFDetailDB(id) {
  const item = _lfItems.find(x=>x.id===id);
  if (!item) { showToast('⚠️','Could not load details.'); return; }
  const emoji   = _lfEmoji(item.category);
  const dateStr = item.date || (item.created_at ? item.created_at.slice(0,10) : '');
  const hasImg  = item.image_path && item.image_path.trim() !== '';
  const isOwner = item.user_id === window._userId;

  document.getElementById('dpHero').className = `dp-hero ${item.type}-bg`;
  document.getElementById('dpHero').innerHTML = hasImg
    ? `<img src="${item.image_path}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" /><button class="dp-close" onclick="closeDetail()">✕</button>`
    : `${emoji}<button class="dp-close" onclick="closeDetail()">✕</button>`;

  let msgHtml = '';
  const isAdmin = window._userRole === 'admin';
  if (window._loggedIn && !isOwner && !isAdmin) {
    msgHtml = `
      <div style="margin-top:16px;">
        <button class="btn btn-found btn-sm" style="width:100%;justify-content:center;gap:8px;"
          onclick="startMessageFromItem(${item.id},'${escHtml(item.title).replace(/'/g,"\\'")}',${item.user_id})">
          💬 Send Anonymous Message
        </button>
        <div style="font-size:.68rem;color:var(--muted);text-align:center;margin-top:6px;">🔒 Your identity is never revealed</div>
      </div>`;
  } else if (isOwner && !isAdmin) {
    msgHtml = `
      <div style="margin-top:16px;">
        <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;"
          onclick="appView('messages',document.querySelector('[data-view=\\'messages\\']'));closeDetail();">
          📩 View My Messages
        </button>
      </div>`;
  } else if (!window._loggedIn) {
    msgHtml = `
      <div style="margin-top:16px;">
        <button class="btn btn-found btn-sm" style="width:100%;justify-content:center;"
          onclick="showPage('login')">
          🔒 Sign In to Message
        </button>
      </div>`;
  }

  document.getElementById('dpBody').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <span class="type-badge badge-${item.type}">${item.type.toUpperCase()}</span>
      <span class="tag tag-${item.status||'open'}" style="font-size:.72rem">${item.status==='claimed'?'Claimed':'Open'}</span>
    </div>
    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:6px;color:var(--text)">${escHtml(item.title)}</div>
    <p style="font-size:.84rem;color:var(--muted2);line-height:1.65;margin-bottom:16px">${item.description?escHtml(item.description):'—'}</p>
    <div class="dp-sec"><div class="dp-sec-title">Item Details</div>
      <div class="dp-field"><label>Category</label><span>${item.category||'—'}</span></div>
      <div class="dp-field"><label>Color</label><span>${item.color||'—'}</span></div>
      <div class="dp-field"><label>Brand</label><span>${item.brand||'—'}</span></div>
      <div class="dp-field"><label>Location</label><span>${item.location||'—'}</span></div>
      ${item.locker_number&&item.type==='found'?`<div class="dp-field"><label>🔐 Locker</label><span style="font-weight:700;color:var(--found)">${escHtml(item.locker_number)}</span></div>`:''}
      <div class="dp-field"><label>Date</label><span>${dateStr||'—'}</span></div>
      <div class="dp-field"><label>Posted by</label><span>🔒 ${isOwner?'You (owner)':'Anonymous'}</span></div>
      <div class="dp-field"><label>Reference</label><span>LF-${String(item.id).padStart(4,'0')}</span></div>
    </div>
    ${hasImg?`<div class="dp-sec"><div class="dp-sec-title">📸 Photo</div><img src="${item.image_path}" style="width:100%;border-radius:10px;margin-top:6px;border:1px solid var(--border);" /></div>`:''}
    ${msgHtml}`;

  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

/* ─── SUBMIT LF ─────────────────────────────────────────── */
let lfType = 'lost', _lfImageDataURL = '';
function selectType(type) {
  lfType = type;
  document.getElementById('typeLost').className  = 'type-card' + (type==='lost'  ? ' sel-lost'  : '');
  document.getElementById('typeFound').className = 'type-card' + (type==='found' ? ' sel-found' : '');
  document.getElementById('lfFormTitle').textContent  = type==='lost' ? '📋 Report Lost Item' : '📋 Report Found Item';
  document.getElementById('lfSubmitBtn').className    = 'btn ' + (type==='lost' ? 'btn-lost' : 'btn-found');
  document.getElementById('lfSubmitBtn').textContent  = type==='lost' ? '🚀 Submit Lost Report' : '🚀 Submit Found Report';
  document.getElementById('dateLbl').textContent      = type==='lost' ? 'Date Lost *' : 'Date Found *';
  const req  = document.getElementById('lfPhotoReq');
  const hint = document.getElementById('lfPhotoHint');
  if (req)  req.style.display  = type==='found' ? 'inline' : 'none';
  if (hint) { hint.style.display='inline'; hint.textContent = type==='found' ? '(Required — proof of the item found)' : '(Optional — helps with AI matching)'; }
  const ls = document.getElementById('lfLockerSection');
  if (ls) ls.style.display = type==='found' ? '' : 'none';
}
function selectLoc(el, loc) {
  document.querySelectorAll('.loc-chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('iLocOther').value = loc;
}
function handleLFImageSelect(input) {
  const file = input.files[0]; if (!file) { _lfImageDataURL=''; return; }
  if (!file.type.startsWith('image/')) { showToast('⚠️','Please select an image file.'); input.value=''; _lfImageDataURL=''; return; }
  if (file.size > 5*1024*1024) { showToast('⚠️','Image must be under 5 MB.'); input.value=''; _lfImageDataURL=''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    _lfImageDataURL = e.target.result;
    const preview = document.getElementById('lfImagePreview');
    if (preview) preview.innerHTML = `<img src="${_lfImageDataURL}" style="width:100%;max-height:180px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-top:8px;" /><div style="font-size:.73rem;color:var(--found);margin-top:5px;">✅ ${escHtml(file.name)}</div>`;
    const slot = document.getElementById('lfImgSlot');
    if (slot) { slot.innerHTML=`<img src="${_lfImageDataURL}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" /><span>Change</span>`; slot.classList.add('has-img'); }
  };
  reader.readAsDataURL(file);
}

async function submitLF() {
  if (!window._loggedIn) { showToast('🔒','Please log in.'); return; }
  const title = document.getElementById('iTitle').value.trim();
  if (!title) { showToast('⚠️','Please enter an item name!'); return; }
  if (lfType==='found' && !_lfImageDataURL) {
    showToast('📷','Please upload a photo.');
    document.getElementById('lfPhotoSection').scrollIntoView({behavior:'smooth',block:'nearest'});
    return;
  }
  if (lfType==='found') {
    const locker = (document.getElementById('iLockerNumber')?.value||'').trim();
    const lockerErr = document.getElementById('iLockerErr');
    if (!locker) {
      if (lockerErr) lockerErr.classList.add('show');
      document.getElementById('lfLockerSection').scrollIntoView({behavior:'smooth',block:'nearest'});
      showToast('🔐','Please enter the locker number where you deposited the item.');
      return;
    }
    if (lockerErr) lockerErr.classList.remove('show');
  }
  const payload = {
    type: lfType, title,
    category:      document.getElementById('iCat').value,
    color:         document.getElementById('iColor').value.trim(),
    brand:         document.getElementById('iBrand').value.trim(),
    description:   document.getElementById('iDesc').value.trim(),
    location:      document.getElementById('iLocOther').value.trim(),
    date:          document.getElementById('iDate').value,
    time:          document.getElementById('iTime').value,
    locker_number: (document.getElementById('iLockerNumber')?.value||'').trim(),
    private:       true,
    image:         _lfImageDataURL,
  };
  const btn = document.getElementById('lfSubmitBtn');
  if (btn) { btn.disabled=true; btn.textContent='Submitting…'; }
  try {
    const res  = await fetch('/api/lf/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data = await res.json();
    if (!res.ok || !data.ok) { showToast('❌', data.error||'Submission failed.'); return; }

    // FIX 1: Ensure type is always set correctly from lfType (not just from server response)
    const newItem = { ...data.item, type: data.item.type || lfType };
    _lfItems.unshift(newItem);

    // FIX 2: Update KPIs and re-render grid immediately with correct counts
    _updateLFKPIs();
    _applyLFFilter();

    // ── Reset form ─────────────────────────────────────────────────
    ['iTitle','iDesc','iColor','iBrand','iLocOther','iTime'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    const id2 = document.getElementById('iDate'); if (id2) id2.valueAsDate = new Date();
    const le  = document.getElementById('iLockerNumber'); if (le) le.value = '';
    _lfImageDataURL = '';
    const pv = document.getElementById('lfImagePreview'); if (pv) pv.innerHTML='';
    const slot = document.getElementById('lfImgSlot');
    if (slot) { slot.innerHTML='📷<span>Add Photo</span>'; slot.classList.remove('has-img'); }

    const ref = `LF-${String(data.item.id).padStart(4,'0')}`;
    document.getElementById('modalIcon').textContent  = lfType==='lost' ? '📢' : '🎉';
    document.getElementById('modalTitle').textContent = lfType==='lost' ? 'Lost Item Reported!' : 'Found Item Posted!';
    document.getElementById('modalDesc').textContent  = lfType==='lost'
      ? 'Your report is live. AI is scanning for matches!'
      : 'Your found item is posted. Owner will be notified if matched!';
    document.getElementById('modalRef').textContent   = ref;

    // FIX 3: On modal close, do a full fresh loadLFItems() so counts are always accurate
    document.getElementById('modalBtn').onclick = () => {
      closeModal();
      loadLFItems(); // full server reload — guarantees counts are in sync
      appView('lf-browse', document.querySelector('[data-view="lf-browse"]'));
    };
    document.getElementById('successModal').classList.add('show');

    if (data.instant_matches > 0) {
      setTimeout(_pollNotificationBadge, 500);
      showToast('🤖', `AI found ${data.instant_matches} potential match${data.instant_matches>1?'es':''}!`);
    }
  } catch(e) { showToast('❌','Network error.'); }
  finally { if (btn) { btn.disabled=false; btn.textContent=lfType==='lost'?'🚀 Submit Lost Report':'🚀 Submit Found Report'; } }
}

/* ─── AI MATCHES ────────────────────────────────────────── */
const _lfMinScore = 35;
async function loadLFMatches() {
  const container = document.getElementById('matchesList');
  const hdr       = document.getElementById('matchesSubHdr');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted)"><div style="font-size:2rem;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">🤖</div><div style="font-size:.9rem">Running ML matcher…</div></div>`;
  try {
    const res     = await fetch(`/api/lf/matches?min_score=${_lfMinScore}`);
    const matches = await res.json();
    if (hdr) hdr.textContent = `${matches.length} match${matches.length!==1?'es':''} found · Updated just now`;
    if (!matches.length) {
      container.innerHTML = `<div style="text-align:center;padding:56px 20px;color:var(--muted)"><div style="font-size:3rem;margin-bottom:14px">🔍</div><div style="font-size:.95rem;font-weight:600;color:var(--text);margin-bottom:6px">No matches found yet</div><div style="font-size:.82rem;color:var(--muted2)">As more items are posted, AI will detect similarities.</div></div>`;
      return;
    }
    container.innerHTML = matches.map(m => {
      const lostRef  = `LF-${String(m.lost_id).padStart(4,'0')}`;
      const foundRef = `LF-${String(m.found_id).padStart(4,'0')}`;
      const barColor = m.score>=75?'var(--found)':m.score>=55?'var(--match)':'var(--accent)';
      const lostImg  = m.lost_image  ? `<img src="${m.lost_image}"  style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />` : '🔴';
      const foundImg = m.found_image ? `<img src="${m.found_image}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />` : '🟢';
      return `<div class="match-pair" style="margin-bottom:16px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);background:var(--surface)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);background:var(--surface2)">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:52px;height:52px;border-radius:50%;background:conic-gradient(${barColor} ${m.score}%,var(--border) 0);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:.82rem;font-weight:800;color:var(--text)">${m.score}%</div>
            <div><div style="font-family:'Syne',sans-serif;font-size:.9rem;font-weight:700;color:var(--match)">${m.label}</div><div style="font-size:.7rem;color:var(--muted)">${lostRef} ↔ ${foundRef}</div></div>
          </div>
          <div style="display:flex;gap:7px">
            <button class="btn btn-found btn-sm" onclick="confirmLFMatch(${m.lost_id},${m.found_id},this)">✅ Confirm</button>
            <button class="btn btn-ghost btn-sm" onclick="dismissLFMatch(this)">✕ Dismiss</button>
          </div>
        </div>
        <div style="height:4px;background:var(--border)"><div style="height:100%;width:${m.score}%;background:${barColor};transition:width .6s ease"></div></div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;padding:16px;align-items:center">
          <div style="display:flex;gap:10px;align-items:flex-start"><div style="width:64px;height:64px;border-radius:10px;flex-shrink:0;overflow:hidden;background:rgba(247,95,95,.12);display:flex;align-items:center;justify-content:center;font-size:1.6rem">${lostImg}</div><div><div style="font-size:.8rem;font-weight:700;color:var(--text)">${escHtml(m.lost_title)}</div>${m.lost_location?`<div style="font-size:.71rem;color:var(--muted2)">📍 ${escHtml(m.lost_location)}</div>`:''}<span class="type-badge badge-lost" style="position:static;display:inline-block;margin-top:5px;font-size:.6rem">LOST</span></div></div>
          <div style="text-align:center;color:var(--match);font-size:22px">⇄</div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div style="width:64px;height:64px;border-radius:10px;flex-shrink:0;overflow:hidden;background:rgba(56,226,184,.1);display:flex;align-items:center;justify-content:center;font-size:1.6rem">${foundImg}</div><div><div style="font-size:.8rem;font-weight:700;color:var(--text)">${escHtml(m.found_title)}</div>${m.found_location?`<div style="font-size:.71rem;color:var(--muted2)">📍 ${escHtml(m.found_location)}</div>`:''}<span class="type-badge badge-found" style="position:static;display:inline-block;margin-top:5px;font-size:.6rem">FOUND</span></div></div>
        </div>
        <div style="padding:0 16px 14px;display:flex;gap:6px;flex-wrap:wrap">${m.reasons.map(r=>`<span class="reason-tag">✓ ${r}</span>`).join('')}</div>
      </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--lost)">❌ Failed to load matches.</div>`;
  }
}
function confirmLFMatch(lostId, foundId, btn) {
  btn.disabled = true; btn.textContent = '⏳ Confirming…';
  fetch('/api/lf/confirm_match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lost_id:lostId,found_id:foundId})})
    .then(r=>r.json())
    .then(data => {
      if (data.ok) {
        showToast('✅','Match confirmed!');
        // Remove just this one card instead of reloading everything
        const card = btn.closest('.match-pair');
        if (card) {
          card.style.transition = 'opacity .4s, transform .4s';
          card.style.opacity = '0';
          card.style.transform = 'translateX(30px)';
          setTimeout(() => {
            card.remove();
            // Update the header count
            const remaining = document.querySelectorAll('.match-pair').length;
            const hdr = document.getElementById('matchesSubHdr');
            if (hdr) hdr.textContent = `${remaining} match${remaining !== 1 ? 'es' : ''} found · Updated just now`;
            if (remaining === 0) {
              const container = document.getElementById('matchesList');
              if (container) container.innerHTML = `<div style="text-align:center;padding:56px 20px;color:var(--muted)"><div style="font-size:3rem;margin-bottom:14px">🔍</div><div style="font-size:.95rem;font-weight:600;color:var(--text);margin-bottom:6px">No matches found yet</div><div style="font-size:.82rem;color:var(--muted2)">As more items are posted, AI will detect similarities.</div></div>`;
            }
          }, 400);
        }
      }
      else { btn.disabled=false; btn.textContent='✅ Confirm'; showToast('❌',data.error||'Failed.'); }
    })
    .catch(()=>{ btn.disabled=false; btn.textContent='✅ Confirm'; showToast('❌','Network error.'); });
}
/* ═══════════════════════════════════════
   ANONYMOUS MESSAGING SYSTEM
═══════════════════════════════════════ */
let _activeThreadId  = null;
let _activeItemId    = null;
let _msgPollInterval = null;
let _drawerThreadId  = null;
let _drawerItemId    = null;
let _drawerPollInterval = null;

function _ensureMsgOverlay() {
  if (document.getElementById('msgOverlay')) return;
  const o = document.createElement('div');
  o.id = 'msgOverlay';
  o.style.cssText = [
    'display:none','position:fixed','inset:0','background:rgba(0,0,0,.72)',
    'z-index:9998','align-items:center','justify-content:center',
    'padding:16px','box-sizing:border-box','backdrop-filter:blur(6px)',
  ].join(';');
  document.body.appendChild(o);
}

function updateMsgFabBadge(count) {
  const badge = document.getElementById('msgNavBadge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-flex'; }
  else           { badge.textContent = '';    badge.style.display = 'none'; }
}

function openMsgDrawer(opts) {
  const navEl = document.querySelector('[data-view="messages"]');
  appView('messages', navEl);
  if (opts && opts.threadId && opts.itemId) {
    setTimeout(() => openMsgThread(opts.threadId, opts.itemId), 200);
  }
}

async function openMsgThread(threadId, itemId) {
  if (window._userRole === 'admin') return;
  _drawerThreadId = threadId;
  _drawerItemId   = itemId;
  document.querySelectorAll('.msg-thread-item').forEach(el => {
    el.classList.toggle('active', el.dataset.thread === String(threadId));
  });
  const emptyState   = document.getElementById('msgEmptyState');
  const activeThread = document.getElementById('msgActiveThread');
  if (emptyState)   emptyState.style.display   = 'none';
  if (activeThread) activeThread.style.display = 'flex';
  await _renderDrawerThread(threadId, itemId, false);
  clearInterval(_drawerPollInterval);
  _drawerPollInterval = setInterval(() => _renderDrawerThread(_drawerThreadId, _drawerItemId, true), 5000);
}

async function _renderDrawerThread(threadId, itemId, silent = false) {
  try {
    const res  = await fetch(`/api/messages/thread/${threadId}`);
    const data = await res.json();
    if (data.error) { showToast('❌', data.error); return; }
    const { messages, item } = data;
    if (!silent) {
      const avatarEl = document.getElementById('msgActiveAvatar');
      const nameEl   = document.getElementById('msgActiveName');
      const subEl    = document.getElementById('msgActiveSub');
      const refWrap  = document.getElementById('msgRefTagWrap');
      const refTag   = document.getElementById('msgRefTag');
      if (avatarEl) avatarEl.textContent = (item.title || 'IT').slice(0, 2).toUpperCase();
      if (nameEl)   nameEl.textContent   = item.title || 'Item';
      if (subEl)    subEl.textContent    = `🔒 Anonymous · ${item.status === 'claimed' ? 'Claimed' : 'Open'}`;
      if (refWrap)  refWrap.style.display = 'block';
      if (refTag)   refTag.textContent   = `🔗 LF-${String(itemId).padStart(4, '0')}: ${item.title || ''}`;
    }
    const bodyEl = document.getElementById('msgBody');
    if (!bodyEl) return;
    const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 80;
    bodyEl.innerHTML = _renderDrawerBubbles(messages);
    if (!silent || atBottom) bodyEl.scrollTop = bodyEl.scrollHeight;
    if (!silent) { const inp = document.getElementById('msgComposeInput'); if (inp) inp.focus(); }
    _pollNotificationBadge();
    _refreshThreadListSilent();
  } catch(e) { console.error('[_renderDrawerThread]', e); }
}

function _renderDrawerBubbles(messages) {
  if (!messages.length)
    return `<div style="text-align:center;padding:40px;color:var(--muted);font-size:.82rem">No messages yet. Say hello! 👋</div>`;
  return messages.map(m => {
    const isMe = m.author === 'me';
    let ts = '';
    if (m.created_at) {
      const d = new Date(m.created_at.replace(' ', 'T')), now = new Date();
      ts = d.toDateString() === now.toDateString()
        ? d.toTimeString().slice(0, 5)
        : `${d.getDate()} ${d.toLocaleString('default', {month:'short'})} ${d.toTimeString().slice(0, 5)}`;
    }
    return `<div class="msg-bubble-wrap ${isMe ? 'me' : 'them'}">
      ${!isMe ? `<div class="mt-avatar" style="width:28px;height:28px;font-size:.6rem;background:linear-gradient(135deg,var(--accent),var(--accent2))">AN</div>` : ''}
      <div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
        <div class="msg-bubble">${escHtml(m.body)}</div>
        <div class="msg-btime">${isMe ? 'You' : 'Anonymous'} · ${ts}</div>
      </div>
    </div>`;
  }).join('');
}

async function _refreshThreadListSilent() {
  try {
    const res = await fetch('/api/messages/threads');
    const threads = await res.json();
    const totalUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
    updateMsgFabBadge(totalUnread);
    const unreadEl = document.getElementById('msgUnreadCount');
    if (unreadEl) unreadEl.textContent = totalUnread > 0 ? `${totalUnread} unread` : '';
  } catch(e) {}
}

function filterMsgThreads(query) {
  const q = (query || '').toLowerCase();
  document.querySelectorAll('.msg-thread-item').forEach(el => {
    const name = el.querySelector('.mt-name')?.textContent.toLowerCase() || '';
    el.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

function msgComposeKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsgReply(); }
}

async function sendMsgReply() {
  let inp = null, threadId = null, itemId = null;
  const activeThread = document.getElementById('msgActiveThread');
  const drawerInp    = document.getElementById('msgComposeInput');
  if (activeThread && activeThread.style.display !== 'none' && drawerInp && _drawerThreadId) {
    inp = drawerInp; threadId = _drawerThreadId; itemId = _drawerItemId;
  } else if (_activeThreadId) {
    inp = document.getElementById('msgInput'); threadId = _activeThreadId; itemId = _activeItemId;
  }
  if (!inp || !threadId) return;
  const body = inp.value.trim();
  if (!body) return;
  inp.value = '';
  if (inp.style) inp.style.height = '';
  try {
    const res  = await fetch('/api/messages/reply', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ thread_id: threadId, body }),
    });
    const data = await res.json();
    if (data.ok) {
      if (_drawerThreadId && activeThread && activeThread.style.display !== 'none') {
        await _renderDrawerThread(_drawerThreadId, _drawerItemId, true);
        const bodyEl = document.getElementById('msgBody');
        if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
      }
      if (_activeThreadId && document.getElementById('msgOverlay')?.style.display === 'flex') {
        await _renderThread(_activeThreadId, _activeItemId, true);
        const area = document.getElementById('msgBubbleArea');
        if (area) area.scrollTop = area.scrollHeight;
      }
    } else {
      showToast('❌', data.error || 'Failed to send.');
      inp.value = body;
    }
  } catch(e) { showToast('❌', 'Network error.'); inp.value = body; }
}

async function loadMessageThreads() {
  _ensureMsgOverlay();
  const container = document.getElementById('msgThreadList');
  if (!container) return;
  if (window._userRole === 'admin') {
    container.innerHTML = `<div style="text-align:center;padding:40px 14px;color:var(--muted);font-size:.82rem">🚫 Admins do not have access to anonymous messages.</div>`;
    return;
  }
  container.innerHTML = `<div style="text-align:center;padding:40px 14px;color:var(--muted);font-size:.82rem">Loading conversations…</div>`;
  try {
    const res = await fetch('/api/messages/threads');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const threads = await res.json();
    if (!Array.isArray(threads)) throw new Error('Invalid response from server');
    const totalUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
    const unreadEl = document.getElementById('msgUnreadCount');
    if (unreadEl) unreadEl.textContent = totalUnread > 0 ? `${totalUnread} unread` : '';
    updateMsgFabBadge(totalUnread);
    if (!threads.length) {
      container.innerHTML = `<div style="text-align:center;padding:48px 14px;color:var(--muted)">
        <div style="font-size:2.6rem;margin-bottom:10px">💬</div>
        <div style="font-size:.88rem;font-weight:600;color:var(--text);margin-bottom:5px">No messages yet</div>
        <div style="font-size:.76rem;color:var(--muted2);line-height:1.5">Browse items and click<br>"Send Message" to start a conversation.</div>
      </div>`;
      return;
    }
    container.innerHTML = threads.map(t => {
      const hasImg = t.item_image && t.item_image.trim() !== '';
      const unread = (t.unread || 0) > 0;
      const initials = (t.item_title || 'IT').slice(0, 2).toUpperCase();
      return `<div class="msg-thread-item ${unread ? 'unread' : ''}"
        data-thread="${t.thread_id}"
        onclick="openMsgThread('${t.thread_id}', ${t.lf_item_id})">
        <div class="mt-avatar" style="${t.item_type === 'lost'
          ? 'background:linear-gradient(135deg,#f75f5f,#f7a34f)'
          : 'background:linear-gradient(135deg,#38e2b8,#4f8ef7)'}">
          ${hasImg ? `<img src="${t.item_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : initials}
        </div>
        <div class="mt-info">
          <div class="mt-row1">
            <span class="mt-name">${escHtml(t.item_title || 'Item')}</span>
            <span class="mt-time">${(t.last_at || '').slice(0, 10)}</span>
          </div>
          <div class="mt-preview">${t.msg_count} message${t.msg_count !== 1 ? 's' : ''}</div>
        </div>
        ${unread ? `<span class="mt-badge">${t.unread}</span>` : ''}
      </div>`;
    }).join('');
    const searchVal = document.getElementById('msgSearchInput')?.value;
    if (searchVal) filterMsgThreads(searchVal);
  } catch(e) {
    console.error('[loadMessageThreads]', e);
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--lost);font-size:.82rem">
      ❌ Failed to load messages.<br>
      <span style="font-size:.72rem;color:var(--muted)">Error: ${e.message}</span><br><br>
      <button class="btn btn-ghost btn-sm" onclick="loadMessageThreads()">🔄 Retry</button>
    </div>`;
  }
}

async function openThread(threadId, itemId) {
  _ensureMsgOverlay();
  _activeThreadId = threadId; _activeItemId = itemId;
  const overlay = document.getElementById('msgOverlay');
  overlay.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Loading…</div>`;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await _renderThread(threadId, itemId, false);
  clearInterval(_msgPollInterval);
  _msgPollInterval = setInterval(() => _renderThread(threadId, itemId, true), 5000);
}

async function _renderThread(threadId, itemId, silent = false) {
  try {
    const res  = await fetch(`/api/messages/thread/${threadId}`);
    const data = await res.json();
    if (data.error) { showToast('❌', data.error); closeMsgOverlay(); return; }
    const { messages, item } = data;
    const overlay = document.getElementById('msgOverlay'); if (!overlay) return;
    if (!silent) {
      const hasImg = item.image_path && item.image_path.trim() !== '';
      overlay.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;max-width:560px;width:100%;margin:0 auto;background:var(--surface);border-radius:16px;overflow:hidden;border:1px solid var(--border);max-height:90vh;">
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface2);border-bottom:1px solid var(--border);flex-shrink:0;">
            <div style="width:40px;height:40px;border-radius:8px;flex-shrink:0;overflow:hidden;background:${item.type==='lost'?'rgba(247,95,95,.12)':'rgba(56,226,184,.1)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem">
              ${hasImg?`<img src="${item.image_path}" style="width:100%;height:100%;object-fit:cover;" />`:(item.type==='lost'?'🔴':'🟢')}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.88rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.title||'Item')}</div>
              <div style="font-size:.7rem;color:var(--muted)">🔒 Anonymous · ${item.status==='claimed'?'Claimed':'Open'}</div>
            </div>
            <button onclick="closeMsgOverlay()" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);font-size:.9rem;flex-shrink:0;">✕</button>
          </div>
          <div id="msgBubbleArea" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:0;">
            ${_renderBubbles(messages)}
          </div>
          <div style="padding:12px 14px;border-top:1px solid var(--border);background:var(--surface2);flex-shrink:0;">
            <div style="display:flex;gap:8px;align-items:flex-end;">
              <textarea id="msgInput" placeholder="Type a message… (Enter to send)"
                style="flex:1;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.25);border-radius:10px;color:var(--text);padding:10px 12px;font-size:.83rem;resize:none;min-height:44px;max-height:120px;outline:none;font-family:inherit;box-sizing:border-box;"
                onkeydown="msgKeydown(event)" rows="1"></textarea>
              <button onclick="sendMsgReply()"
                style="background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;font-weight:600;font-size:.83rem;height:44px;flex-shrink:0;white-space:nowrap;">
                Send ↗
              </button>
            </div>
            <div style="font-size:.68rem;color:var(--muted);margin-top:6px;text-align:center;">🔒 Your identity is never revealed to the other person</div>
          </div>
        </div>`;
      requestAnimationFrame(() => {
        const area = document.getElementById('msgBubbleArea');
        if (area) area.scrollTop = area.scrollHeight;
        const inp = document.getElementById('msgInput');
        if (inp) inp.focus();
      });
    } else {
      const area = document.getElementById('msgBubbleArea');
      if (area) {
        const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
        area.innerHTML = _renderBubbles(messages);
        if (atBottom) area.scrollTop = area.scrollHeight;
      }
    }
    _pollNotificationBadge();
  } catch(e) { console.error('[_renderThread]', e); }
}

function _renderBubbles(messages) {
  if (!messages.length)
    return `<div style="text-align:center;padding:32px;color:var(--muted);font-size:.82rem">No messages yet. Say hello! 👋</div>`;
  return messages.map(m => {
    const isMe = m.author === 'me';
    let ts = '';
    if (m.created_at) {
      const d = new Date(m.created_at.replace(' ','T')), now = new Date();
      ts = d.toDateString() === now.toDateString()
        ? d.toTimeString().slice(0,5)
        : `${d.getDate()} ${d.toLocaleString('default',{month:'short'})} ${d.toTimeString().slice(0,5)}`;
    }
    return `<div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};">
      <div style="max-width:78%;background:${isMe?'linear-gradient(135deg,#4f8ef7,#6d6af7)':'rgba(255,255,255,.08)'};color:${isMe?'#fff':'var(--text)'};padding:10px 14px;border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};font-size:.84rem;line-height:1.55;word-break:break-word;box-shadow:${isMe?'0 2px 12px rgba(79,142,247,.3)':'none'};">${escHtml(m.body)}</div>
      <div style="font-size:.65rem;color:var(--muted);margin-top:3px;padding:0 4px;">${isMe?'You':'Anonymous'} · ${ts}</div>
    </div>`;
  }).join('');
}

function msgKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsgReply(); }
}

function closeMsgOverlay() {
  clearInterval(_msgPollInterval);
  _msgPollInterval = null; _activeThreadId = null; _activeItemId = null;
  const o = document.getElementById('msgOverlay');
  if (o) { o.style.display='none'; o.innerHTML=''; }
  document.body.style.overflow = '';
  loadMessageThreads();
}

function openNewMessageModal() {
  showToast('💬', 'Browse items and tap "Send Message" to start a conversation!');
}

async function startMessageFromItem(itemId, itemTitle, ownerId) {
  if (!window._loggedIn)            { showToast('🔒','Please log in.');              return; }
  if (window._userRole === 'admin') { showToast('🚫','Admins cannot send messages.'); return; }
  if (ownerId === window._userId)   { showToast('ℹ️','This is your own item.');        return; }
  try {
    const res = await fetch('/api/messages/threads');
    const threads = await res.json();
    if (Array.isArray(threads)) {
      const existing = threads.find(t => t.lf_item_id === itemId);
      if (existing) { closeDetail(); openMsgDrawer({ threadId: existing.thread_id, itemId }); return; }
    }
  } catch(e) { /* fall through */ }

  const modal = document.createElement('div');
  modal.id = 'newMsgModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px 24px;max-width:440px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <div style="font-family:'Syne',sans-serif;font-size:1.05rem;font-weight:800;color:var(--text);margin-bottom:4px;">💬 Send Anonymous Message</div>
      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:4px;">About: <strong>${escHtml(itemTitle)}</strong></div>
      <div style="font-size:.71rem;color:var(--muted);margin-bottom:14px;">🔒 Your identity will never be revealed to the other person.</div>
      <textarea id="newMsgBody" placeholder="Hi, I think I may have found your item…"
        style="width:100%;min-height:110px;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.25);border-radius:10px;color:var(--text);padding:10px 12px;font-size:.84rem;resize:vertical;font-family:inherit;box-sizing:border-box;outline:none;"
        maxlength="1000"
        onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();submitNewMsg(${itemId});}"></textarea>
      <div style="font-size:.68rem;color:var(--muted);margin-top:4px;text-align:right" id="newMsgCount">0 / 1000</div>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('newMsgModal').remove()">Cancel</button>
        <button class="btn btn-primary btn-sm" id="newMsgSendBtn" onclick="submitNewMsg(${itemId})">📨 Send Message</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  const ta = document.getElementById('newMsgBody');
  if (ta) {
    ta.focus();
    ta.addEventListener('input', () => {
      const c = document.getElementById('newMsgCount');
      if (c) c.textContent = ta.value.length + ' / 1000';
    });
  }
}

async function submitNewMsg(itemId) {
  const bodyEl = document.getElementById('newMsgBody');
  const body   = (bodyEl?.value || '').trim();
  if (!body) { showToast('⚠️','Message cannot be empty.'); return; }
  const btn = document.getElementById('newMsgSendBtn');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  try {
    const res  = await fetch('/api/messages/send', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ lf_item_id: itemId, body }),
    });
    const data = await res.json();
    document.getElementById('newMsgModal')?.remove();
    if (data.ok) {
      showToast('📨','Message sent!');
      _pollNotificationBadge();
      closeDetail();
      openMsgDrawer({ threadId: data.thread_id, itemId });
    } else {
      showToast('❌', data.error || 'Failed to send.');
      if (btn) { btn.disabled=false; btn.textContent='📨 Send Message'; }
    }
  } catch(e) {
    showToast('❌','Network error.');
    if (btn) { btn.disabled=false; btn.textContent='📨 Send Message'; }
  }
}

/* ═══════════════════════════════════════
   GRIEVANCE DUPLICATE DETECTION (TF-IDF)
═══════════════════════════════════════ */
let _dupMatchedId = null;

function _tfidfTokenize(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !['the','and','for','are','was','this','that','with','have','from','they','not','but','our','your','there'].includes(t));
}

function _tfidfScore(queryTokens, docText) {
  const docTokens = _tfidfTokenize(docText);
  if (!docTokens.length || !queryTokens.length) return 0;
  const docSet = {};
  docTokens.forEach(t => { docSet[t] = (docSet[t]||0) + 1; });
  let matches = 0, totalWeight = 0;
  queryTokens.forEach(t => {
    totalWeight++;
    if (docSet[t]) matches += Math.min(1, docSet[t] / docTokens.length * 10);
  });
  return totalWeight ? (matches / totalWeight) : 0;
}

async function checkGrievanceDuplicate() {
  const subject = (document.getElementById('gSubject')?.value || '').trim();
  const desc    = (document.getElementById('gDescription')?.value || '').trim();
  if (!subject && !desc) { submitGrievanceAnyway(); return; }
  const btn = document.getElementById('grvSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '🔍 Checking…'; }
  document.getElementById('grvDuplicateWarn').style.display = 'none';
  _dupMatchedId = null;
  try {
    const grievances = _allGrievances.length ? _allGrievances : await fetch('/api/grievances').then(r=>r.json());
    const queryText   = subject + ' ' + desc;
    const queryTokens = _tfidfTokenize(queryText);
    let best = null, bestScore = 0;
    grievances.forEach(g => {
      if (g.status === 'resolved') return;
      const gText = (g.subject || '') + ' ' + (g.description || '') + ' ' + (g.category || '');
      const score = _tfidfScore(queryTokens, gText);
      if (score > bestScore) { bestScore = score; best = g; }
    });
    const THRESHOLD = 0.42;
    if (bestScore >= THRESHOLD && best) {
      _dupMatchedId = best.id;
      const grvRef  = `GRV-${String(best.id).padStart(4,'0')}`;
      const preview = (best.subject || '').slice(0, 80);
      document.getElementById('grvDuplicateText').innerHTML =
        `<strong>${grvRef}:</strong> "${preview}" — <em>${best.category||'General'}</em> · ${best.vote_count||0} upvotes · Status: ${statusLabel(best.status)}`;
      document.getElementById('grvDuplicateWarn').style.display = 'block';
      document.getElementById('grvDuplicateWarn').scrollIntoView({behavior:'smooth', block:'nearest'});
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Submit Grievance'; }
      return;
    }
    submitGrievanceAnyway();
  } catch(e) { console.error('Duplicate check failed:', e); submitGrievanceAnyway(); }
}

function submitGrievanceAnyway() {
  document.getElementById('grvDuplicateWarn').style.display = 'none';
  const btn = document.getElementById('grvSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  const form = btn?.closest('form');
  if (form) form.submit();
}

async function upvoteExistingGrievance() {
  if (!_dupMatchedId) return;
  try {
    const res  = await fetch(`/api/grievance/${_dupMatchedId}/vote`, {method:'POST'});
    const data = await res.json();
    if (data.ok) {
      showToast('👍', `Upvoted GRV-${String(_dupMatchedId).padStart(4,'0')}!`);
      document.getElementById('gSubject').value     = '';
      document.getElementById('gDescription').value = '';
      document.getElementById('grvDuplicateWarn').style.display = 'none';
      _dupMatchedId = null;
      appView('grievances', document.querySelector('[data-view="grievances"]'));
      await loadAllGrievances();
    } else { showToast('❌', data.error || 'Could not upvote.'); }
  } catch(e) { showToast('❌','Network error.'); }
}

/* ═══════════════════════════════════════
   STUDENT PROFILE
═══════════════════════════════════════ */
async function loadProfile() {
  const av = document.getElementById('topbarProfileAvatar');
  if (av && window._userName) av.textContent = window._userName[0].toUpperCase();
  if (window._userRole !== 'student') return;
  try {
    const res  = await fetch('/api/profile');
    const data = await res.json();
    if (data.error) { showToast('❌', data.error); return; }
    const initials = ((data.first_name||'?')[0] + (data.last_name||'')[0]).toUpperCase().replace(/undefined/g,'') || '?';
    const av = document.getElementById('profileAvatar');      if (av) av.textContent = initials;
    const fn = document.getElementById('profileFullName');    if (fn) fn.textContent = `${data.first_name||''} ${data.last_name||''}`.trim() || '—';
    const em = document.getElementById('profileEmail');       if (em) em.textContent = data.email || '—';
    const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
    setVal('pfFirst', data.first_name); setVal('pfLast', data.last_name);
    setVal('pfRoll',  data.roll);       setVal('pfDept', data.department);
    ['pfCurrPw','pfNewPw','pfConfPw'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    _hideMsg('profileInfoMsg'); _hideMsg('profilePwMsg');
  } catch(e) { showToast('❌','Could not load profile.'); }
}

async function saveProfileInfo() {
  const first = (document.getElementById('pfFirst')?.value || '').trim();
  const last  = (document.getElementById('pfLast')?.value  || '').trim();
  const roll  = (document.getElementById('pfRoll')?.value  || '').trim();
  const dept  = (document.getElementById('pfDept')?.value  || '').trim();
  if (!first) { _showMsg('profileInfoMsg', '❌ First name is required.', 'err'); return; }
  const btn = document.getElementById('pfSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const res  = await fetch('/api/profile/update', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({first_name:first, last_name:last, roll, department:dept}),
    });
    const data = await res.json();
    if (data.ok) {
      window._userName = data.first_name;
      const uname = document.querySelector('.u-name'); if (uname) uname.textContent = data.first_name;
      const av = document.getElementById('profileAvatar');
      if (av) av.textContent = ((first[0]||'') + (last[0]||'')).toUpperCase() || '?';
      const fn = document.getElementById('profileFullName');
      if (fn) fn.textContent = `${first} ${last}`.trim();
      _showMsg('profileInfoMsg', '✅ Profile updated successfully!', 'ok');
      showToast('✅', 'Profile saved!');
    } else { _showMsg('profileInfoMsg', '❌ ' + (data.error || 'Update failed.'), 'err'); }
  } catch(e) { _showMsg('profileInfoMsg', '❌ Network error.', 'err'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; } }
}

async function saveProfilePassword() {
  const curr = document.getElementById('pfCurrPw')?.value  || '';
  const npw  = document.getElementById('pfNewPw')?.value   || '';
  const conf = document.getElementById('pfConfPw')?.value  || '';
  if (!curr || !npw || !conf) { _showMsg('profilePwMsg', '❌ All password fields are required.', 'err'); return; }
  if (npw.length < 8)          { _showMsg('profilePwMsg', '❌ New password must be at least 8 characters.', 'err'); return; }
  if (npw !== conf)             { _showMsg('profilePwMsg', '❌ New passwords do not match.', 'err'); return; }
  const btn = document.getElementById('pfPwBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  try {
    const res  = await fetch('/api/profile/change_password', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({current_password:curr, new_password:npw, confirm_password:conf}),
    });
    const data = await res.json();
    if (data.ok) {
      ['pfCurrPw','pfNewPw','pfConfPw'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
      const sf = document.getElementById('pwStrengthFill');  if (sf) sf.style.width = '0';
      const sl = document.getElementById('pwStrengthLabel'); if (sl) sl.textContent = '';
      _showMsg('profilePwMsg', '✅ Password changed successfully!', 'ok');
      showToast('🔒', 'Password updated!');
    } else { _showMsg('profilePwMsg', '❌ ' + (data.error || 'Failed to update password.'), 'err'); }
  } catch(e) { _showMsg('profilePwMsg', '❌ Network error.', 'err'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🔒 Update Password'; } }
}

function _showMsg(id, text, kind) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = text; el.style.display = 'block';
  el.style.background   = kind === 'ok' ? 'rgba(56,226,184,.1)'  : 'rgba(247,95,95,.1)';
  el.style.border       = kind === 'ok' ? '1px solid rgba(56,226,184,.3)' : '1px solid rgba(247,95,95,.3)';
  el.style.color        = kind === 'ok' ? '#38e2b8' : '#f75f5f';
  el.style.borderRadius = '8px';
}
function _hideMsg(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function togglePwVis(inputId, btn) {
  const inp = document.getElementById(inputId); if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

function checkPwStrength(pw) {
  const fill  = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  if (!fill || !label) return;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    {pct:0,  color:'var(--border)', label:''},
    {pct:20, color:'#f75f5f', label:'Weak'},
    {pct:40, color:'#f7c34f', label:'Fair'},
    {pct:65, color:'#f7c34f', label:'Good'},
    {pct:85, color:'#38e2b8', label:'Strong'},
    {pct:100,color:'#38e2b8', label:'Very strong'},
  ];
  const lvl = levels[Math.min(score, 5)];
  fill.style.width = lvl.pct + '%'; fill.style.background = lvl.color;
  label.textContent = lvl.label;    label.style.color     = lvl.color;
}

/* ═══════════════════════════════════════
   FORM STEPS (grievance wizard)
═══════════════════════════════════════ */
const cats = [
  {icon:'🌐',label:'Infrastructure / IT'},{icon:'📚',label:'Academic'},
  {icon:'🏠',label:'Hostel'},{icon:'🍽️',label:'Canteen / Food'},
  {icon:'🚌',label:'Transport'},{icon:'🏥',label:'Medical / Health'},
  {icon:'💰',label:'Fee / Finance'},{icon:'⚖️',label:'Harassment / Conduct'},
  {icon:'🏋️',label:'Sports / Facilities'},{icon:'📋',label:'Administration'},
];
const locs = [
  'Library','Canteen','Adminstrative building','Auditorium','Principal office',
  'University Examination branch','J hub','CSE Department','ECE Department',
  'EEE Department','Civil Department','Mechanical Department','Chemical Department',
  'CRC','Hostel','Sports Complex',
];
let gStep = 1;
function updateSteps() {
  ['sd1','sd2','sd3'].forEach((id,i) => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove('done','cur');
    if (i+1 < gStep) el.classList.add('done'); else if (i+1 === gStep) el.classList.add('cur');
  });
  ['sl1','sl2'].forEach((id,i) => {
    const l = document.getElementById(id); if (!l) return;
    l.classList.remove('done'); if (i+1 < gStep) l.classList.add('done');
  });
}
function selectCat(cat, el) {
  document.querySelectorAll('.cat-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  const hi = document.getElementById('selectedCategory'); if (hi) hi.value = cat;
  const di = document.getElementById('categoryDisplay');  if (di) di.value = cat;
  gStep = 2; updateSteps();
  document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));
  const s2 = document.getElementById('sf2'); if (s2) s2.classList.add('active');
}
function goPrev() {
  if (gStep <= 1) return;
  gStep--;
  updateSteps();
  document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));
  const p = document.getElementById('sf'+gStep); if (p) p.classList.add('active');
}
function renderCatGrid() {
  const el = document.getElementById('catGrid'); if (!el) return;
  el.innerHTML = cats.map(c=>`<div class="cat-card" onclick="selectCat('${c.label}',this)"><div class="ci">${c.icon}</div><div class="cn">${c.label}</div></div>`).join('');
}
function renderLocGrid() {
  const el = document.getElementById('locGrid'); if (!el) return;
  el.innerHTML = locs.map(l=>`<div class="loc-chip" onclick="selectLoc(this,'${l}')">${l}</div>`).join('');
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function closeDetailEvt(e) {
  if (e.target === document.getElementById('detailOverlay')) closeDetail();
}

/* ═══════════════════════════════════════
   CHATBOT
═══════════════════════════════════════ */
const chatHistory = [];
let _chatBusy = false, _suggestionsLoaded = false;

function initChatbot() {
  const wrap = document.getElementById('chatMessages');
  if (!wrap) return;
  if (wrap.children.length > 0) { if (!_suggestionsLoaded) _loadSuggestions(); return; }
  _appendChat('bot',
    "Hi! 👋 I'm **CampusAI Assistant**.\n\n" +
    "I can help you with:\n" +
    "• **Grievances** — submit, track status, understand escalation\n" +
    "• **Lost & Found** — report items, AI matching, anonymous messages\n" +
    "• **Your data** — your personal grievances and L&F items\n" +
    "• **Campus info** — policies, departments, contacts\n\n" +
    "What do you need today?"
  );
  _loadSuggestions();
}

function _loadSuggestions() {
  const wrap = document.getElementById('chatSuggestions');
  if (!wrap) return;
  fetch('/api/chat/suggestions')
    .then(r => r.json())
    .then(suggestions => {
      if (!Array.isArray(suggestions) || !suggestions.length) return;
      _suggestionsLoaded = true;
      wrap.innerHTML = '';
      suggestions.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'chat-chip'; btn.textContent = text;
        btn.onclick = () => {
          const inp = document.getElementById('chatInput');
          if (inp) inp.value = text;
          wrap.innerHTML = '';
          sendChat();
        };
        wrap.appendChild(btn);
      });
    })
    .catch(() => {});
}

function sendChat() {
  const inp = document.getElementById('chatInput');
  const msg = (inp ? inp.value : '').trim();
  if (!msg || _chatBusy) return;
  inp.value = '';
  const chipWrap = document.getElementById('chatSuggestions');
  if (chipWrap) chipWrap.innerHTML = '';
  _appendChat('user', msg);
  chatHistory.push({ role: 'user', content: msg });
  _setChatBusy(true);
  fetch('/api/chat', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ messages: chatHistory }),
  })
    .then(r => r.json())
    .then(data => {
      _setChatBusy(false);
      if (data.ok && data.reply) {
        _appendChat('bot', data.reply, data.engine, data.quick_action);
        chatHistory.push({ role: 'assistant', content: data.reply });
        if (chatHistory.length > 40) chatHistory.splice(0, chatHistory.length - 40);
      } else { _appendChat('bot', '⚠️ Something went wrong. Please try again.'); }
    })
    .catch(err => {
      _setChatBusy(false);
      console.error('[chatbot]', err);
      _appendChat('bot', '❌ Network error. Please check your connection and try again.');
    });
}

function _appendChat(role, text, engine, quickAction) {
  const wrap = document.getElementById('chatMessages'); if (!wrap) return;
  const outer = document.createElement('div');
  outer.className = role === 'user' ? 'chat-msg chat-user' : 'chat-msg chat-bot';
  const safe = _renderChatMarkdown(text);
  const badgeMap = {
    gemini:   { icon:'✨', label:'Gemini',   cls:'badge-gemini' },
    tfidf:    { icon:'🔍', label:'Local AI', cls:'badge-local'  },
    fallback: { icon:'💬', label:'Basic',    cls:'badge-basic'  },
  };
  let badge = '';
  if (role === 'bot' && engine && badgeMap[engine]) {
    const b = badgeMap[engine];
    badge = `<span class="chat-engine-badge ${b.cls}">${b.icon} ${b.label}</span>`;
  }
  let actionBtn = '';
  if (role === 'bot' && quickAction?.label && quickAction?.target)
    actionBtn = `<button class="chat-quick-action" onclick="openChatQuickAction('${_escAttr(quickAction.target)}')">${_escHtml(quickAction.label)}</button>`;
  outer.innerHTML = `<div class="chat-bubble"><div class="chat-bubble-text">${safe}</div>${actionBtn}${badge}</div>`;
  wrap.appendChild(outer);
  requestAnimationFrame(() => wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' }));
}

function _renderChatMarkdown(text) {
  if (!text) return '';
  let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/```[\s\S]*?```/g, m => {
    const code = m.replace(/^```\w*\n?/,'').replace(/```$/,'');
    return `<pre class="chat-code">${code}</pre>`;
  });
  s = s.replace(/`([^`]+)`/g,'<code class="chat-inline-code">$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,'<em>$1</em>');
  const lines = s.split('\n'), output = [];
  let inList = false, listType = '';
  lines.forEach(line => {
    const bm = line.match(/^(\s*)[•\-\*]\s+(.+)/);
    const nm = line.match(/^(\s*)\d+\.\s+(.+)/);
    const blank = line.trim() === '';
    if (bm) {
      if (!inList || listType !== 'ul') { if (inList) output.push(`</${listType}>`); output.push('<ul class="chat-list">'); inList=true; listType='ul'; }
      output.push(`<li>${bm[2]}</li>`);
    } else if (nm) {
      if (!inList || listType !== 'ol') { if (inList) output.push(`</${listType}>`); output.push('<ol class="chat-list">'); inList=true; listType='ol'; }
      output.push(`<li>${nm[2]}</li>`);
    } else {
      if (inList) { output.push(`</${listType}>`); inList=false; listType=''; }
      output.push(blank ? '<br>' : `<span class="chat-line">${line}</span><br>`);
    }
  });
  if (inList) output.push(`</${listType}>`);
  return output.join('');
}

function openChatQuickAction(viewTarget) {
  if (typeof showView === 'function') { showView(viewTarget); return; }
  const hashMap = {
    grievanceView:'#grievance', myGrievancesView:'#my-grievances',
    allGrievancesView:'#all-grievances', lostFoundView:'#lost-found',
    messagesView:'#messages', analyticsView:'#analytics', notificationsView:'#notifications',
  };
  if (hashMap[viewTarget]) { window.location.hash = hashMap[viewTarget]; return; }
  const navLink = document.querySelector(`[data-view="${viewTarget}"]`);
  if (navLink) navLink.click();
}

function _setChatBusy(on) {
  _chatBusy = on;
  const typing = document.getElementById('chatTyping'); if (typing) typing.style.display = on ? 'flex' : 'none';
  const btn = document.getElementById('chatSendBtn');
  if (btn) { btn.disabled = on; btn.style.opacity = on ? '0.5' : '1'; }
  const inp = document.getElementById('chatInput'); if (inp) inp.disabled = on;
}
function chatKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }
function clearChatHistory() {
  chatHistory.length = 0;
  const wrap = document.getElementById('chatMessages'); if (wrap) wrap.innerHTML = '';
  const chips = document.getElementById('chatSuggestions'); if (chips) chips.innerHTML = '';
  _suggestionsLoaded = false;
  initChatbot();
}
function _escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _escAttr(str) { return (str||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

/* ═══════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════ */
function setRole(btn) {
  document.querySelectorAll('#loginPage .role-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const ri = document.getElementById('loginRoleInput'); if (ri) ri.value = btn.dataset.role||'student';
}
function setRegRole(btn, role) {
  document.querySelectorAll('#registerPage .role-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rollWrap').style.display = role==='student' ? 'block' : 'none';
}
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function handleLogin() {
  let ok = true;
  const e = document.getElementById('lEmail').value.trim();
  const p = document.getElementById('lPass').value;
  ['lEmailErr','lPassErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  if (!validEmail(e)) { document.getElementById('lEmailErr').classList.add('show'); ok=false; }
  if (!p)             { document.getElementById('lPassErr').classList.add('show');  ok=false; }
  if (ok) document.getElementById('loginForm').submit();
}
function handleRegister() {
  let ok = true;
  const first = document.getElementById('rFirst').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const pass  = document.getElementById('rPass').value;
  const conf  = document.getElementById('rConfirm').value;
  const ok2   = document.getElementById('rAgree').checked;
  ['rFirstErr','rEmailErr','rPassErr','rConfErr','rAgreeErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  if (!first)             { document.getElementById('rFirstErr').classList.add('show'); ok=false; }
  if (!validEmail(email)) { document.getElementById('rEmailErr').classList.add('show'); ok=false; }
  if (pass.length<8)      { document.getElementById('rPassErr').classList.add('show');  ok=false; }
  if (pass!==conf)        { document.getElementById('rConfErr').classList.add('show');  ok=false; }
  if (!ok2)               { document.getElementById('rAgreeErr').classList.add('show'); ok=false; }
  if (ok) document.getElementById('registerForm').submit();
}

/* ═══════════════════════════════════════
   MISC HELPERS
═══════════════════════════════════════ */
function fChip(el) {
  el.closest('.filter-row').querySelectorAll('.fc').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  showToast('🔽','Filter applied!');
}
function closeModal()    { document.getElementById('successModal').classList.remove('show'); }
function showToast(icon, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent  = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ═══════════════════════════════════════
   FORGOT PASSWORD
═══════════════════════════════════════ */
function openForgotPassword() {
  const modal = document.getElementById('forgotPwModal'); if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  ['fpSuccBox','fpErrBox'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display='none'; el.textContent=''; }
  });
  const emailErr = document.getElementById('fpEmailErr');
  if (emailErr) emailErr.classList.remove('show');
  const emailInp = document.getElementById('fpEmail');
  const loginEmail = document.getElementById('lEmail');
  if (emailInp && loginEmail) emailInp.value = loginEmail.value.trim();
  if (emailInp) emailInp.focus();
}
function closeForgotPassword() {
  const modal = document.getElementById('forgotPwModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}
async function sendForgotPassword() {
  const emailInp = document.getElementById('fpEmail');
  const email    = emailInp ? emailInp.value.trim() : '';
  const emailErr = document.getElementById('fpEmailErr');
  const succBox  = document.getElementById('fpSuccBox');
  const errBox   = document.getElementById('fpErrBox');
  if (emailErr) emailErr.classList.remove('show');
  if (succBox)  { succBox.style.display='none'; succBox.textContent=''; }
  if (errBox)   { errBox.style.display='none';  errBox.textContent=''; }
  if (!validEmail(email)) { if (emailErr) emailErr.classList.add('show'); return; }
  const btn = document.getElementById('fpSubmitBtn');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  try {
    const res  = await fetch('/api/forgot_password', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.ok) {
      _showBanner('fpSuccBox', '✅ Reset link sent! Check your email inbox.', 'succ');
      if (emailInp) emailInp.disabled = true;
      if (btn) { btn.disabled=true; btn.textContent='Sent ✓'; }
    } else {
      _showBanner('fpErrBox', `❌ ${data.error || 'Could not send reset link.'}`, 'err');
      if (btn) { btn.disabled=false; btn.textContent='Send Reset Link →'; }
    }
  } catch(e) {
    _showBanner('fpErrBox', '❌ Network error. Please try again.', 'err');
    if (btn) { btn.disabled=false; btn.textContent='Send Reset Link →'; }
  }
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  _ensureMsgOverlay();
  renderCatGrid(); renderLocGrid(); updateSteps();
  const gd = document.getElementById('gDate'); if (gd) gd.valueAsDate = new Date();
  const id = document.getElementById('iDate'); if (id) id.valueAsDate = new Date();
  if (document.getElementById('typeLost')) selectType('lost');
  document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));
  const sf1 = document.getElementById('sf1'); if (sf1) sf1.classList.add('active');
  gStep = 1; updateSteps();

  if (window._loggedIn) {
    _pollNotificationBadge();
    setInterval(_pollNotificationBadge, 30000);
    const topAv = document.getElementById('topbarProfileAvatar');
    if (topAv && window._userName) topAv.textContent = window._userName[0].toUpperCase();
  }

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
