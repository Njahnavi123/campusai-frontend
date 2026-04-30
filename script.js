/* ════════════════════════════════
   THEME TOGGLE
════════════════════════════════ */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('campusai-theme', isDark ? 'light' : 'dark');
  showToast(isDark ? '☀️' : '🌙', isDark ? 'Light mode on!' : 'Dark mode on!');
}
// Restore saved theme
(function(){
  const saved = localStorage.getItem('campusai-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

/* ════════════════════════════════
   PAGE SYSTEM (Landing/Login/Register/App)
════════════════════════════════ */
function showPage(name) {
  // hide all
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('appSidebar').style.display = 'none';
  document.getElementById('appMain').style.display = 'none';

  if (name === 'landing') {
    document.getElementById('landingPage').style.display = 'block';
  } else if (name === 'login') {
    document.getElementById('loginPage').style.display = 'block';
  } else if (name === 'register') {
    document.getElementById('registerPage').style.display = 'block';
  } else if (name === 'app') {
    document.getElementById('appSidebar').style.display = 'flex';
    document.getElementById('appMain').style.display = 'flex';
    appView('grievances', document.querySelector('.nav-item'));
  }
  window.scrollTo(0,0);
}

// Start on landing
showPage('landing');

/* ════════════════════════════════
   APP VIEW SWITCHING
════════════════════════════════ */
const viewMeta = {
  'grievances':   ['Grievance Management', 'Track and manage campus grievances'],
  'submit-grv':   ['Submit a Grievance', 'File a new complaint'],
  'my-grv':       ['My Grievances', 'Grievances submitted by you'],
  'lf-browse':    ['Lost & Found', 'Browse all lost and found items'],
  'lf-post':      ['Post an Item', 'Report a lost or found item'],
  'lf-matches':   ['AI Matches', '5 potential matches found'],
  'admin':        ['Admin Panel', 'Manage all grievances & items'],
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
  document.getElementById('pageSub').textContent = sub;
}

/* ════════════════════════════════
   DATA
════════════════════════════════ */
const grievances = [
  {id:'GRV-2025-0047',emoji:'🌐',title:'WiFi outage in Block C — Room 204',cat:'Infrastructure',priority:'high',status:'review',assignee:'IT Dept',date:'Apr 14',submitter:'Rahul S.'},
  {id:'GRV-2025-0046',emoji:'🍽️',title:'Canteen food quality — stale items served',cat:'Canteen',priority:'medium',status:'pending',assignee:'—',date:'Apr 13',submitter:'Priya M.'},
  {id:'GRV-2025-0045',emoji:'📚',title:'Library books return system issue',cat:'Academic',priority:'low',status:'resolved',assignee:'Library',date:'Apr 12',submitter:'Arjun K.'},
  {id:'GRV-2025-0044',emoji:'🏠',title:'Hostel room water supply disrupted',cat:'Hostel',priority:'high',status:'escalated',assignee:'Facilities',date:'Apr 11',submitter:'Sneha R.'},
  {id:'GRV-2025-0043',emoji:'📋',title:'Exam timetable clash — CSE 4th sem',cat:'Academic',priority:'high',status:'review',assignee:'Academic Off.',date:'Apr 10',submitter:'Vikram P.'},
];

const myGrvData = [
  {id:'GRV-2025-0047',title:'WiFi outage in Block C',cat:'Infrastructure',priority:'high',status:'review',progress:55,date:'Apr 14, 2025'},
  {id:'GRV-2025-0039',title:'Lab computer RAM upgrade request',cat:'Academic',priority:'medium',status:'pending',progress:15,date:'Apr 8, 2025'},
  {id:'GRV-2025-0031',title:'Canteen closes too early on weekends',cat:'Canteen',priority:'low',status:'resolved',progress:100,date:'Mar 25, 2025'},
];

const lfItems = [
  {id:'LF-2025-0083',type:'lost',emoji:'🎒',cat:'Bags & Accessories',title:'Blue North Face Backpack',desc:'Navy blue North Face backpack with red zipper. Contains laptop, charger, notebooks.',color:'Navy Blue',loc:'Library — Reading Room B',date:'Apr 14',poster:'Rahul S.',posterInit:'RS',urgency:'h',match:87},
  {id:'LF-2025-0084',type:'found',emoji:'📱',cat:'Electronics',title:'iPhone 14 (Black)',desc:'Found a black iPhone 14 near the cafeteria. Screen cracked slightly. Locked.',color:'Black',loc:'Cafeteria Entrance',date:'Apr 15',poster:'Priya M.',posterInit:'PM',urgency:'h',match:0},
  {id:'LF-2025-0085',type:'lost',emoji:'📄',cat:'Documents',title:'Student ID + Bank Card',desc:'Lost college ID card and SBI bank card in a red card holder. Very urgent — exams next week.',color:'Red Holder',loc:'Exam Block',date:'Apr 15',poster:'Arjun K.',posterInit:'AK',urgency:'h',match:0},
  {id:'LF-2025-0082',type:'found',emoji:'🔑',cat:'Keys',title:'Bunch of Keys (4 keys)',desc:'Found 4 keys with a blue lanyard near Block D staircase. Has a small torch keychain.',color:'Blue Lanyard',loc:'Block D — Staircase',date:'Apr 13',poster:'Sneha R.',posterInit:'SR',urgency:'m',match:0},
  {id:'LF-2025-0081',type:'lost',emoji:'🎧',cat:'Electronics',title:'Sony WH-1000XM5 Headphones',desc:'Black Sony noise-cancelling headphones in grey case. Left in the seminar hall.',color:'Black + Grey',loc:'Seminar Hall A',date:'Apr 12',poster:'Vikram P.',posterInit:'VP',urgency:'m',match:74},
  {id:'LF-2025-0080',type:'found',emoji:'👕',cat:'Clothing',title:'Blue Denim Jacket',desc:'Found a blue denim jacket size M on a chair in the CS lab. Has a unique pin badge.',color:'Blue Denim',loc:'CS Lab — 2nd Floor',date:'Apr 12',poster:'Ananya T.',posterInit:'AT',urgency:'l',match:0},
];

const matches = [
  {lostId:'LF-2025-0083',foundId:'LF-2025-0078',score:87,lostEmoji:'🎒',foundEmoji:'🎒',lostTitle:'Blue North Face Backpack',foundTitle:'Dark Blue Wildcraft Bag',lostLoc:'Library',foundLoc:'Canteen',reasons:['Similar category','Color match','Nearby location','Same day range']},
  {lostId:'LF-2025-0081',foundId:'LF-2025-0084',score:74,lostEmoji:'🎧',foundEmoji:'📱',lostTitle:'Sony Headphones',foundTitle:'Black Electronics Found',lostLoc:'Seminar Hall A',foundLoc:'Cafeteria',reasons:['Electronics category','Black color','Campus proximity']},
];

const cats = [
  {icon:'🌐',label:'Infrastructure / IT'},{icon:'📚',label:'Academic'},
  {icon:'🏠',label:'Hostel'},{icon:'🍽️',label:'Canteen / Food'},
  {icon:'🚌',label:'Transport'},{icon:'🏥',label:'Medical / Health'},
  {icon:'💰',label:'Fee / Finance'},{icon:'⚖️',label:'Harassment / Conduct'},
  {icon:'🏋️',label:'Sports / Facilities'},{icon:'📋',label:'Administration'},
];

const locs = ['Library','Canteen','Block A','Block B','Block C','Block D','Hostel','Lab','Exam Block','Seminar Hall','Sports Ground','Parking'];

/* ════════════════════════════════
   RENDERERS
════════════════════════════════ */
function statusLabel(s){return{pending:'Pending',review:'In Review',resolved:'Resolved',escalated:'Escalated'}[s]||s;}

function renderGrvTable() {
  document.getElementById('grvTable').innerHTML = grievances.map(g=>`
    <tr onclick="openGrvDetail('${g.id}')">
      <td><div class="g-id">${g.id}</div></td>
      <td><div class="g-title">${g.title}</div><div class="g-sub">By ${g.submitter}</div></td>
      <td><div class="g-sub">${g.cat}</div></td>
      <td><span class="prio p-${g.priority}">${g.priority}</span></td>
      <td><span class="tag tag-${g.status}">${statusLabel(g.status)}</span></td>
      <td style="font-size:.8rem;color:var(--muted2)">${g.assignee}</td>
      <td style="font-size:.78rem;color:var(--muted)">${g.date}</td>
      <td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openGrvDetail('${g.id}')">View</button></td>
    </tr>`).join('');
}

function renderMyGrv() {
  document.getElementById('myGrvList').innerHTML = myGrvData.map(g=>`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;cursor:pointer;transition:all .2s" onclick="openGrvDetail('${g.id}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px">
        <div><div class="g-id" style="margin-bottom:4px">${g.id} · ${g.date}</div><div style="font-weight:600;font-size:.93rem;color:var(--text)">${g.title}</div><div style="font-size:.78rem;color:var(--muted);margin-top:2px">${g.cat}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px"><span class="tag tag-${g.status}">${statusLabel(g.status)}</span><span class="prio p-${g.priority}">${g.priority}</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-bottom:5px"><span>Progress</span><span>${g.progress}%</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${g.progress}%"></div></div>
    </div>`).join('');
}

function renderLFItems(list) {
  const urgLabel = u => u==='h'?'🔴 Urgent':u==='m'?'🟡 Medium':'🟢 Low';
  const urgCls   = u => u==='h'?'urg-h':u==='m'?'urg-m':'urg-l';
  document.getElementById('lfGrid').innerHTML = list.map(item=>`
    <div class="item-card" onclick="openLFDetail(${JSON.stringify(item).replace(/"/g,'&quot;')})">
      <div class="item-img img-${item.type}">
        ${item.emoji}
        <span class="type-badge badge-${item.type}">${item.type.toUpperCase()}</span>
        <span class="urg-badge ${urgCls(item.urgency)}">${urgLabel(item.urgency)}</span>
      </div>
      <div class="item-body">
        <div class="item-cat">${item.cat}</div>
        <div class="item-title">${item.title}</div>
        <div class="item-desc">${item.desc}</div>
        <div class="item-meta">
          <span class="meta-chip">📍 ${item.loc}</span>
          <span class="meta-chip">📅 ${item.date}</span>
          ${item.color?`<span class="meta-chip">🎨 ${item.color}</span>`:''}
        </div>
        ${item.match>0?`<div style="background:rgba(247,195,79,.08);border:1px solid rgba(247,195,79,.18);border-radius:7px;padding:6px 9px;margin-bottom:9px;font-size:.73rem;color:var(--match)">🤖 AI Match: <strong>${item.match}% confidence</strong></div>`:''}
        <div class="item-foot">
          <div style="display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--muted2)"><div class="poster-av">${item.posterInit}</div>${item.poster}</div>
          <button class="btn ${item.type==='lost'?'btn-found':'btn-lost'} btn-xs" onclick="event.stopPropagation();showToast('📧','Contact sent!')">${item.type==='lost'?'✋ I Found It':'✋ I Lost It'}</button>
        </div>
      </div>
    </div>`).join('');
}

function renderMatches() {
  document.getElementById('matchesList').innerHTML = matches.map(m=>`
    <div class="match-pair">
      <div class="match-hdr">
        <div style="display:flex;align-items:center;gap:10px"><div class="score-ring">${m.score}%</div><div><div style="font-family:'Syne',sans-serif;font-size:.88rem;font-weight:700;color:var(--match)">${m.score>=80?'🔥 Strong Match':'⚡ Possible Match'}</div><div style="font-size:.72rem;color:var(--muted)">${m.lostId} ↔ ${m.foundId}</div></div></div>
        <div style="display:flex;gap:7px"><button class="btn btn-found btn-sm" onclick="showToast('✅','Match confirmed! Owner notified.')">✅ Confirm</button><button class="btn btn-ghost btn-sm" onclick="showToast('✕','Dismissed.')">Dismiss</button></div>
      </div>
      <div class="match-body">
        <div class="m-item"><div class="m-img mi-lost">${m.lostEmoji}</div><div class="m-item-info"><h5>${m.lostTitle}</h5><p>📍 ${m.lostLoc}</p><span class="type-badge badge-lost" style="position:static;display:inline-block;margin-top:5px">LOST</span></div></div>
        <div style="text-align:center;color:var(--match);font-size:20px">⇄</div>
        <div class="m-item"><div class="m-img mi-found">${m.foundEmoji}</div><div class="m-item-info"><h5>${m.foundTitle}</h5><p>📍 ${m.foundLoc}</p><span class="type-badge badge-found" style="position:static;display:inline-block;margin-top:5px">FOUND</span></div></div>
      </div>
      <div style="padding:0 16px 14px;display:flex;gap:6px;flex-wrap:wrap">${m.reasons.map(r=>`<span class="reason-tag">✓ ${r}</span>`).join('')}</div>
    </div>`).join('');
}

function renderCatGrid() {
  document.getElementById('catGrid').innerHTML = cats.map(c=>`
    <div class="cat-card" onclick="selectCat('${c.label}',this)"><div class="ci">${c.icon}</div><div class="cn">${c.label}</div></div>`).join('');
}

function renderLocGrid() {
  document.getElementById('locGrid').innerHTML = locs.map(l=>`
    <div class="loc-chip" onclick="selectLoc(this,'${l}')">${l}</div>`).join('');
}

function renderAdminTable() {
  const allItems = [...grievances.map(g=>({...g,itemType:'grievance'})), ...lfItems.map(i=>({...i,itemType:'lostfound'}))];
  document.getElementById('adminTable').innerHTML = allItems.map(item=>`
    <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='rgba(79,142,247,.03)'" onmouseout="this.style.background='transparent'">
      <td style="padding:11px 14px;font-size:.73rem;color:var(--muted)">${item.id}</td>
      <td style="padding:11px 14px"><div style="font-size:.83rem;font-weight:600;color:var(--text)">${item.emoji||''} ${item.title}</div><div style="font-size:.71rem;color:var(--muted)">${item.cat||''}</div></td>
      <td style="padding:11px 14px"><span style="font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:100px;background:${item.itemType==='grievance'?'rgba(79,142,247,.12)':'rgba(56,226,184,.1)'};color:${item.itemType==='grievance'?'var(--accent)':'var(--found)'}">${item.itemType==='grievance'?'Grievance':'Lost & Found'}</span></td>
      <td style="padding:11px 14px;font-size:.8rem;color:var(--muted2)">${item.submitter||item.poster||'—'}</td>
      <td style="padding:11px 14px"><span class="tag tag-${item.status||'pending'}">${statusLabel(item.status||'pending')}</span></td>
      <td style="padding:11px 14px"><div style="display:flex;gap:5px"><button class="btn btn-found btn-xs" onclick="showToast('✅','Resolved!')">✅</button><button class="btn btn-ghost btn-xs" onclick="showToast('🔺','Escalated!')">🔺</button><button class="btn btn-danger btn-xs" onclick="showToast('✕','Removed.')">✕</button></div></td>
    </tr>`).join('');
}

/* ════════════════════════════════
   DETAIL PANELS
════════════════════════════════ */
function openGrvDetail(id) {
  const g = grievances.find(x=>x.id===id)||grievances[0];
  document.getElementById('dpHero').className='dp-hero grv-bg';
  document.getElementById('dpHero').innerHTML=`${g.emoji||'📢'}<button class="dp-close" onclick="closeDetail()">✕</button>`;
  document.getElementById('dpBody').innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:12px"><span class="tag tag-${g.status}">${statusLabel(g.status)}</span><span class="prio p-${g.priority}">${g.priority}</span></div>
    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:8px;color:var(--text)">${g.title}</div>
    <div class="dp-sec"><div class="dp-sec-title">Details</div>
      <div class="dp-field"><label>Category</label><span>${g.cat}</span></div>
      <div class="dp-field"><label>Submitted by</label><span>${g.submitter}</span></div>
      <div class="dp-field"><label>Assigned To</label><span>${g.assignee}</span></div>
      <div class="dp-field"><label>Date</label><span>${g.date}, 2025</span></div>
    </div>
    <div class="dp-sec"><div class="dp-sec-title">Progress</div>
      <div class="prog-bar"><div class="prog-fill" style="width:${g.status==='resolved'?100:g.status==='review'?55:20}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-top:5px"><span>Submitted</span><span>In Review</span><span>Resolved</span></div>
    </div>
    <div class="dp-sec"><div class="dp-sec-title">Activity</div>
      <div class="tl-item"><div class="tl-dot tld-b">🔍</div><div><div class="tl-title">Assigned to ${g.assignee}</div><div class="tl-meta">${g.date}, 2025 · Admin</div></div></div>
      <div class="tl-item"><div class="tl-dot tld-m">📝</div><div><div class="tl-title">Grievance submitted</div><div class="tl-meta">${g.date}, 2025 · ${g.submitter}</div></div></div>
    </div>
    <div class="dp-sec"><div class="dp-sec-title">Add Comment</div>
      <div class="comment-box"><textarea placeholder="Write an update..."></textarea>
      <div style="display:flex;justify-content:flex-end;gap:7px;margin-top:7px"><button class="btn btn-ghost btn-sm">Cancel</button><button class="btn btn-primary btn-sm" onclick="showToast('💬','Comment added!')">Post</button></div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn btn-success btn-sm" onclick="showToast('✅','Resolved!')">✅ Resolve</button>
      <button class="btn btn-ghost btn-sm" onclick="showToast('🔺','Escalated!')">🔺 Escalate</button>
      <button class="btn btn-danger btn-sm" onclick="showToast('✕','Closed.')">Close</button>
    </div>`;
  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow='hidden';
}

function openLFDetail(item) {
  document.getElementById('dpHero').className=`dp-hero ${item.type}-bg`;
  document.getElementById('dpHero').innerHTML=`${item.emoji}<button class="dp-close" onclick="closeDetail()">✕</button>`;
  document.getElementById('dpBody').innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:12px"><span class="type-badge badge-${item.type}">${item.type.toUpperCase()}</span></div>
    <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:6px;color:var(--text)">${item.title}</div>
    <p style="font-size:.84rem;color:var(--muted2);line-height:1.65;margin-bottom:16px">${item.desc}</p>
    ${item.match>0?`<div class="ai-box"><h4>🤖 AI Analysis</h4><p>Found <strong style="color:var(--match)">possible matches</strong> — ${item.match}% confidence. Check the AI Matches view.</p></div>`:''}
    <div class="dp-sec"><div class="dp-sec-title">Item Details</div>
      <div class="dp-field"><label>Category</label><span>${item.cat}</span></div>
      <div class="dp-field"><label>Color</label><span>${item.color||'—'}</span></div>
      <div class="dp-field"><label>Location</label><span>${item.loc}</span></div>
      <div class="dp-field"><label>Date</label><span>${item.date}, 2025</span></div>
      <div class="dp-field"><label>Posted by</label><span>${item.poster}</span></div>
      <div class="dp-field"><label>Reference</label><span>${item.id}</span></div>
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
  document.body.style.overflow='hidden';
}

function closeDetail(){document.getElementById('detailOverlay').classList.remove('show');document.body.style.overflow='';}
function closeDetailEvt(e){if(e.target===document.getElementById('detailOverlay'))closeDetail();}

/* ════════════════════════════════
   GRIEVANCE FORM STEPS
════════════════════════════════ */
let gStep=2, selCat='Infrastructure / IT';

function updateSteps(){
  ['sd1','sd2','sd3'].forEach((id,i)=>{const el=document.getElementById(id);el.className='s-dot'+(i+1<gStep?' done':i+1===gStep?' cur':'');});
  ['sl1','sl2'].forEach((id,i)=>{document.getElementById(id).className='s-line'+(i+1<gStep?' done':'');});
}

function selectCat(label, el){
  document.querySelectorAll('.cat-card').forEach(c=>{c.classList.remove('selected');});
  el.classList.add('selected');
  selCat=label;
  document.getElementById('rv-cat').textContent=label;
  setTimeout(()=>{gStep=2;updateSteps();document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));document.getElementById('sf2').classList.add('active');},280);
}

function goPrev(){if(gStep>1){gStep--;document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));document.getElementById('sf'+gStep).classList.add('active');updateSteps();}}

function goNext(){
  const title=document.getElementById('gTitle').value.trim();
  if(!title){showToast('⚠️','Please enter a subject!');return;}
  document.getElementById('rv-title').textContent=title;
  document.getElementById('rv-prio').textContent=document.getElementById('gPriority').value||'Medium';
  document.getElementById('rv-loc').textContent=document.getElementById('gLoc').value||'Not specified';
  document.getElementById('rv-desc').textContent=document.getElementById('gDesc').value||'No description provided.';
  gStep=3;updateSteps();
  document.querySelectorAll('.step-form').forEach(f=>f.classList.remove('active'));
  document.getElementById('sf3').classList.add('active');
}

function submitGrv(){
  const ref='GRV-2025-0'+(Math.floor(Math.random()*90)+10);
  document.getElementById('modalIcon').textContent='🎉';
  document.getElementById('modalTitle').textContent='Grievance Submitted!';
  document.getElementById('modalDesc').textContent='Your grievance has been registered. Track it using your ID below.';
  document.getElementById('modalRef').textContent=ref;
  document.getElementById('modalBtn').onclick=()=>{closeModal();appView('my-grv',null);};
  document.getElementById('successModal').classList.add('show');
}

/* ════════════════════════════════
   LF POST
════════════════════════════════ */
let lfType='lost';
function selectType(type){
  lfType=type;
  document.getElementById('typeLost').className='type-card'+(type==='lost'?' sel-lost':'');
  document.getElementById('typeFound').className='type-card'+(type==='found'?' sel-found':'');
  document.getElementById('lfFormTitle').textContent=type==='lost'?'📋 Report Lost Item':'📋 Report Found Item';
  document.getElementById('lfSubmitBtn').className='btn '+(type==='lost'?'btn-lost':'btn-found');
  document.getElementById('lfSubmitBtn').textContent=type==='lost'?'🚀 Submit Lost Report':'🚀 Submit Found Report';
  document.getElementById('dateLbl').textContent=type==='lost'?'Date Lost *':'Date Found *';
}

function selectLoc(el,loc){
  document.querySelectorAll('.loc-chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('iLocOther').value=loc;
}

function submitLF(){
  const title=document.getElementById('iTitle').value.trim();
  if(!title){showToast('⚠️','Please enter an item name!');return;}
  const ref=(lfType==='lost'?'LF':'FF')+'-2025-0'+(Math.floor(Math.random()*90)+10);
  document.getElementById('modalIcon').textContent=lfType==='lost'?'📢':'🎉';
  document.getElementById('modalTitle').textContent=lfType==='lost'?'Lost Item Reported!':'Found Item Posted!';
  document.getElementById('modalDesc').textContent=lfType==='lost'?'Your report is live. AI is scanning for matches.':'Your found item is posted. Owner will be notified if matched.';
  document.getElementById('modalRef').textContent=ref;
  document.getElementById('modalBtn').onclick=()=>{closeModal();appView('lf-browse',null);};
  document.getElementById('successModal').classList.add('show');
}

/* ════════════════════════════════
   LF FILTER
════════════════════════════════ */
function filterLF(type,el){
  document.querySelectorAll('#view-lf-browse .fc').forEach(c=>{c.classList.remove('active','fc-lost','fc-found');});
  el.classList.add('active');
  if(type==='lost')el.classList.add('fc-lost');
  if(type==='found')el.classList.add('fc-found');
  const filtered=type==='all'?lfItems:lfItems.filter(i=>i.type===type);
  document.getElementById('lfItemCount').textContent=filtered.length+' items · Updated now';
  renderLFItems(filtered);
}

function handleSearch(q){
  if(!q){renderLFItems(lfItems);return;}
  renderLFItems(lfItems.filter(i=>i.title.toLowerCase().includes(q.toLowerCase())||i.loc.toLowerCase().includes(q.toLowerCase())));
}

/* ════════════════════════════════
   AUTH
════════════════════════════════ */
function setRole(btn){document.querySelectorAll('#loginPage .role-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
function setRegRole(btn,role){document.querySelectorAll('#registerPage .role-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('rollWrap').style.display=role==='student'?'block':'none';}

function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}

function handleLogin(){
  let ok=true;
  const e=document.getElementById('lEmail').value.trim();
  const p=document.getElementById('lPass').value;
  document.getElementById('lEmailErr').classList.remove('show');
  document.getElementById('lPassErr').classList.remove('show');
  if(!validEmail(e)){document.getElementById('lEmailErr').classList.add('show');ok=false;}
  if(!p){document.getElementById('lPassErr').classList.add('show');ok=false;}
  if(ok){
    document.getElementById('loginSucc').classList.add('show');
    showToast('✅','Login successful!');
    setTimeout(()=>{document.getElementById('loginSucc').classList.remove('show');showPage('app');},1400);
  }
}

function handleRegister(){
  let ok=true;
  const first=document.getElementById('rFirst').value.trim();
  const email=document.getElementById('rEmail').value.trim();
  const pass=document.getElementById('rPass').value;
  const conf=document.getElementById('rConfirm').value;
  const agreed=document.getElementById('rAgree').checked;
  ['rFirstErr','rEmailErr','rPassErr','rConfErr','rAgreeErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  if(!first){document.getElementById('rFirstErr').classList.add('show');ok=false;}
  if(!validEmail(email)){document.getElementById('rEmailErr').classList.add('show');ok=false;}
  if(pass.length<8){document.getElementById('rPassErr').classList.add('show');ok=false;}
  if(pass!==conf){document.getElementById('rConfErr').classList.add('show');ok=false;}
  if(!agreed){document.getElementById('rAgreeErr').classList.add('show');ok=false;}
  if(ok){
    document.getElementById('regSucc').classList.add('show');
    showToast('🎉','Account created!');
    setTimeout(()=>{document.getElementById('regSucc').classList.remove('show');showPage('login');showToast('👋','Sign in with your new account!');},2000);
  }
}

/* ════════════════════════════════
   MISC
════════════════════════════════ */
function fChip(el){el.closest('.filter-row').querySelectorAll('.fc').forEach(c=>c.classList.remove('active'));el.classList.add('active');showToast('🔽','Filter applied!');}
function closeModal(){document.getElementById('successModal').classList.remove('show');}
function showToast(icon,msg){
  const t=document.getElementById('toast');
  document.getElementById('toastIcon').textContent=icon;
  document.getElementById('toastMsg').textContent=msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove('show'),3000);
}

/* ════════════════════════════════
   INIT
════════════════════════════════ */
renderGrvTable();
renderMyGrv();
renderLFItems(lfItems);
renderMatches();
renderCatGrid();
renderLocGrid();
renderAdminTable();
updateSteps();
document.getElementById('gDate').valueAsDate=new Date();
document.getElementById('iDate').valueAsDate=new Date();
selectType('lost');