/* ═══════════════════════════════════════
   ANONYMOUS MESSAGING SYSTEM
   ─ Fully active & wired up
   ─ /api/messages/send  → first message (new thread)
   ─ /api/messages/reply → reply in existing thread
   ─ /api/messages/thread/<id> → full thread (marks read)
   ─ /api/messages/threads → list all threads
═══════════════════════════════════════ */
let _activeThreadId  = null;
let _activeItemId    = null;
let _msgPollInterval = null;

/* Ensure the global overlay exists in DOM */
function _ensureMsgOverlay() {
  if (document.getElementById('msgOverlay')) return;
  const o = document.createElement('div');
  o.id = 'msgOverlay';
  o.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    'background:rgba(0,0,0,.72)',
    'z-index:9998',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
    'box-sizing:border-box',
    'backdrop-filter:blur(6px)',
  ].join(';');
  document.body.appendChild(o);
}

/* ─── Open a thread INSIDE the drawer right panel ─── */
let _drawerThreadId = null, _drawerItemId = null, _drawerPollInterval = null;

async function openMsgThread(threadId, itemId) {
  if (window._userRole === 'admin') return;
  _drawerThreadId = threadId;
  _drawerItemId   = itemId;

  // Highlight active thread in list
  document.querySelectorAll('.msg-thread-item').forEach(el => {
    el.classList.toggle('active', el.dataset.thread === String(threadId));
  });

  // Show the active thread panel, hide empty state
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
      // Update header
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

    // Update message bubbles
    const bodyEl = document.getElementById('msgBody');
    if (!bodyEl) return;
    const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 80;
    bodyEl.innerHTML = _renderDrawerBubbles(messages);
    if (!silent || atBottom) bodyEl.scrollTop = bodyEl.scrollHeight;

    // Focus compose input
    if (!silent) {
      const inp = document.getElementById('msgComposeInput');
      if (inp) inp.focus();
    }

    _pollNotificationBadge();
    // Refresh thread list unread counts silently
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
      const d = new Date(m.created_at.replace(' ', 'T'));
      const now = new Date();
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
    const res     = await fetch('/api/messages/threads');
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

/* override sendMsgReply to use DRAWER compose input */
async function sendMsgReply() {
  // Try drawer input first, fall back to overlay input
  const drawerInp  = document.getElementById('msgComposeInput');
  const overlayInp = document.getElementById('msgInput');
  const inp  = drawerInp && document.getElementById('msgDrawer')?.classList.contains('open') ? drawerInp : overlayInp;
  const body = (inp ? inp.value : '').trim();
  const threadId = _drawerThreadId || _activeThreadId;
  const itemId   = _drawerItemId   || _activeItemId;
  if (!body || !threadId) return;
  if (inp) { inp.value = ''; inp.style.height = ''; }
  try {
    const res  = await fetch('/api/messages/reply', {
      method:  'POST',
      headers: {'Content-Type':'application/json'},
      body:    JSON.stringify({ thread_id: threadId, body }),
    });
    const data = await res.json();
    if (data.ok) {
      if (_drawerThreadId) {
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
      if (inp) inp.value = body;
    }
  } catch(e) {
    showToast('❌','Network error.');
    if (inp) inp.value = body;
  }
}

async function loadMessageThreads() {
  _ensureMsgOverlay();
  const container = document.getElementById('msgThreadList'); if (!container) return;

  // Admin cannot use messaging
  if (window._userRole === 'admin') {
    container.innerHTML = `<div style="text-align:center;padding:40px 14px;color:var(--muted);font-size:.82rem">🚫 Admins do not have access to anonymous messages.</div>`;
    return;
  }

  container.innerHTML = `<div style="text-align:center;padding:40px 14px;color:var(--muted);font-size:.82rem">Loading conversations…</div>`;
  try {
    const res     = await fetch('/api/messages/threads');
    const threads = await res.json();

    // update unread count label in drawer header
    const totalUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
    const unreadEl = document.getElementById('msgUnreadCount');
    if (unreadEl) unreadEl.textContent = totalUnread > 0 ? `${totalUnread} unread` : '';
    updateMsgFabBadge(totalUnread);

    if (!threads.length) {
      container.innerHTML = `<div style="text-align:center;padding:48px 14px;color:var(--muted)">
        <div style="font-size:2.6rem;margin-bottom:10px">💬</div>
        <div style="font-size:.88rem;font-weight:600;color:var(--text);margin-bottom:5px">No messages yet</div>
        <div style="font-size:.76rem;color:var(--muted2);line-height:1.5">Browse items and click<br>"I Found It" or "I Lost It" to start a conversation.</div>
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
        <div class="mt-avatar" style="${t.item_type === 'lost' ? 'background:linear-gradient(135deg,#f75f5f,#f7a34f)' : 'background:linear-gradient(135deg,#38e2b8,#4f8ef7)'}">
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

    // re-apply search filter if active
    const searchVal = document.getElementById('msgSearchInput')?.value;
    if (searchVal) filterMsgThreads(searchVal);

  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--lost);font-size:.82rem">❌ Failed to load messages.</div>`;
  }
}

async function openThread(threadId, itemId) {
  _ensureMsgOverlay();
  _activeThreadId = threadId;
  _activeItemId   = itemId;
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
          <!-- Header -->
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
          <!-- Messages -->
          <div id="msgBubbleArea" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:0;">
            ${_renderBubbles(messages)}
          </div>
          <!-- Input -->
          <div style="padding:12px 14px;border-top:1px solid var(--border);background:var(--surface2);flex-shrink:0;">
            <div style="display:flex;gap:8px;align-items:flex-end;">
              <textarea id="msgInput"
                placeholder="Type a message… (Enter to send)"
                style="flex:1;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.25);border-radius:10px;color:var(--text);padding:10px 12px;font-size:.83rem;resize:none;min-height:44px;max-height:120px;outline:none;font-family:inherit;box-sizing:border-box;"
                onkeydown="msgKeydown(event)"
                rows="1"></textarea>
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
      // Silent poll — only update bubble area
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
      const d   = new Date(m.created_at.replace(' ','T'));
      const now = new Date();
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
  _msgPollInterval = null;
  _activeThreadId  = null;
  _activeItemId    = null;
  const o = document.getElementById('msgOverlay');
  if (o) { o.style.display='none'; o.innerHTML=''; }
  document.body.style.overflow = '';
  loadMessageThreads();
}

/* ─── "New Message" button in drawer — guides user to browse items ─── */
function openNewMessageModal() {
  showToast('💬', 'Browse items and tap "I Found It" or "I Lost It" to start a conversation!');
}

/* ─── Start a NEW thread from item card / detail panel ─── */
async function startMessageFromItem(itemId, itemTitle, ownerId) {
  if (!window._loggedIn) { showToast('🔒','Please log in.'); return; }
  if (window._userRole === 'admin') { showToast('🚫','Admins cannot send messages.'); return; }
  if (ownerId === window._userId) { showToast('ℹ️','This is your own item.'); return; }

  // If a thread already exists for this item, open it directly
  try {
    const res     = await fetch('/api/messages/threads');
    const threads = await res.json();
    const existing = threads.find(t => t.lf_item_id === itemId);
    if (existing) {
      closeDetail();
      openMsgDrawer({ threadId: existing.thread_id, itemId: itemId });
      return;
    }
  } catch(e) { /* fall through to compose modal */ }

  // No existing thread — show compose modal
  const modal = document.createElement('div');
  modal.id = 'newMsgModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px 24px;max-width:440px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <div style="font-family:'Syne',sans-serif;font-size:1.05rem;font-weight:800;color:var(--text);margin-bottom:4px;">💬 Send Anonymous Message</div>
      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:4px;">About: <strong>${escHtml(itemTitle)}</strong></div>
      <div style="font-size:.71rem;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:5px;">🔒 Your identity will never be revealed to the other person.</div>
      <textarea id="newMsgBody"
        placeholder="Hi, I think I may have found your item…"
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
  ta.focus();
  ta.addEventListener('input', () => {
    const c = document.getElementById('newMsgCount'); if (c) c.textContent = ta.value.length + ' / 1000';
  });
}

async function submitNewMsg(itemId) {
  const body = (document.getElementById('newMsgBody')?.value || '').trim();
  if (!body) { showToast('⚠️','Message cannot be empty.'); return; }

  const btn = document.getElementById('newMsgSendBtn');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }

  try {
    const res  = await fetch('/api/messages/send', {
      method:  'POST',
      headers: {'Content-Type':'application/json'},
      body:    JSON.stringify({ lf_item_id: itemId, body }),
    });
    const data = await res.json();
    document.getElementById('newMsgModal')?.remove();

    if (data.ok) {
      showToast('📨','Message sent!');
      _pollNotificationBadge();
      closeDetail();
      // Open the drawer and go to the new thread
      openMsgDrawer({ threadId: data.thread_id, itemId: itemId });
    } else {
      showToast('❌', data.error || 'Failed to send.');
      if (btn) { btn.disabled=false; btn.textContent='📨 Send Message'; }
    }
  } catch(e) {
    showToast('❌','Network error.');
    if (btn) { btn.disabled=false; btn.textContent='📨 Send Message'; }
  }
}
