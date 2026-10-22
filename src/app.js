import { STORAGE_KEY, sampleState, validateImport, validSong, songToText, applyAction, activeSet, activeSong, activeSection, atStart, atEnd, chordSegments, SONG_SYNTAX_EXAMPLE, parseSongText, arrangeSections, mergeRepositorySongs } from './model.js?v=beta8';
import { LyricsPeer } from './sync.js?v=beta8';
const $ = (query, root=document) => root.querySelector(query);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  monitor:'<rect x="2.5" y="3" width="19" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  stage:'<path d="M4 19V5h16v14M2 19h20M8 5v14M16 5v14"/>',
  controls:'<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/>',
  left:'<path d="m15 18-6-6 6-6"/>', right:'<path d="m9 18 6-6-6-6"/>',
  blank:'<rect x="2.5" y="4" width="19" height="15" rx="2"/><path d="m5 6 14 11"/>',
  show:'<rect x="2.5" y="4" width="19" height="15" rx="2"/><path d="M8 11h8"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-1.8 1.8M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7L12.8 19"/>',
  edit:'<path d="m16 4 4 4M4 20l5-.8L20 8a3 3 0 0 0-4-4L5 15z"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  check:'<path d="m5 12 5 5L20 7"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  wifi:'<path d="M2 8c6-5 14-5 20 0M5 12c4-3 10-3 14 0M9 16c2-1.5 4-1.5 6 0"/><path d="M12 20h.01"/>',
  lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  circle:'<circle cx="12" cy="12" r="9"/>',
  arrowUp:'<path d="M12 19V5m-6 6 6-6 6 6"/>',arrowDown:'<path d="M12 5v14m-6-6 6 6 6-6"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  library:'<path d="M4 4v16M9 4v16M14 7v13m-1-13 3-.5 3 13.5"/>',
  external:'<path d="M14 4h6v6m0-6-9 9M20 14v6H4V4h6"/>'
})[name]||''}</svg>`;

function loadSaved(){
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return sampleState();
    const saved=JSON.parse(raw), clean=validateImport(saved);
    clean.activeSetId=clean.sets.some(x=>x.id===saved.activeSetId)?saved.activeSetId:clean.sets[0].id;
    const cursor=saved.cursor;
    if(cursor && Number.isInteger(cursor.song)&&Number.isInteger(cursor.section)&&Number.isInteger(cursor.page))clean.cursor=cursor;
    clean.blank=true;
    return clean;
  }catch(e){console.warn('Could not load library, using sample data',e);return sampleState();}
}
function persist(){if(app.isHost&&app.screen!=='demo'&&app.data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(app.data));}catch(e){toast('Browser storage is full. Export a backup.');}}}
async function loadRepositorySongs(state){
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),5000);
  try{
    const response=await fetch(new URL('./songs/library.json',location.href),{cache:'no-store',signal:abort.signal});
    if(!response.ok)throw new Error('Library file could not load.');
    const text=await response.text();if(text.length>2000000)throw new Error('Library file exceeds 2 MB.');
    let manifest;try{manifest=JSON.parse(text);}catch{throw new Error('Check the JSON formatting in songs/library.json.');}
    return await mergeRepositorySongs(state,manifest);
  }finally{clearTimeout(timer);}
}
function sessionCode(){const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=new Uint32Array(6);crypto.getRandomValues(r);return [...r].map(n=>abc[n%abc.length]).join('');}
function sessionLink(view=''){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('join',app.code);if(view)url.searchParams.set('view',view);return url.toString();}
const params=new URLSearchParams(location.search);
const app={
  screen:'welcome',isHost:false,code:'',password:'',role:'control',authorized:false,
  data:null,peer:null,status:'idle',peers:0,tab:'lyrics',editingSet:false,editSetId:null,editor:null,
  showInvite:false,showReadingOptions:false,showProjectorTools:false,showChords:true,font:1,projectorFont:2,follow:true,
  scrollTop:0,programScroll:false,modal:'',message:'',pendingCode:(params.get('join')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),
  pendingView:params.get('view')||'',connectLock:false,generation:0
};
let toastTimer;
function toast(message){app.message=message;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{app.message='';renderToast();},4000);}
function renderToast(){const el=$('#toast-root');if(el)el.innerHTML=app.message?`<div class="toast" role="status">${escape(app.message)}</div>`:'';}
function statusLabel(){return ({'connecting':'Connecting…','host-ready':'Hosting session','connected':'Synced','searching':'Finding host…','disconnected':'Disconnected','reconnecting':'Reconnecting…','error':'Connection error','idle':'Offline preview'})[app.status]||'Waiting…';}
function indicator(){const ok=app.isHost?app.status==='host-ready':app.status==='connected';return `<span class="connection ${ok?'good':'warning'}"><span class="status-dot"></span><span>${escape(statusLabel())}</span></span>`;}
function currentSong(){return activeSong(app.data);}
function editingSet(){return app.data?.sets.find(s=>s.id===app.editSetId)||activeSet(app.data);}
function setName(){return editingSet()?.name||'Untitled set';}
function canControl(){return app.isHost||app.authorized;}
async function dispatch(action){
  if(!canControl())throw new Error('Controller password required.');
  if(!app.data)throw new Error('Waiting for the host.');
  if(!app.peer && app.screen!=='demo')throw new Error('Session not ready.');
  if(app.isHost || app.screen==='demo') {
    const prior=app.data;
    app.data=applyAction(prior,action);persist();render();
    if(['step','jump','blank'].includes(action.kind)&&prior.cursor.song===app.data.cursor.song&&prior.activeSetId===app.data.activeSetId)app.peer?.broadcastLive(prior.rev);
    else app.peer?.sendSnapshot();
  }else await app.peer.command(action);
}
async function startSession({host,code,password,role,name=''}){
  if(app.connectLock)return;
  app.connectLock=true;
  const generation=++app.generation;
  app.isHost=host;app.code=code;app.password=password;app.role=role;
  app.authorized=host;app.screen='session';app.status='connecting';app.tab='lyrics';
  app.data=host?loadSaved():null;
  if(host){app.data.blank=true;app.data.liveSong=structuredClone(activeSong(app.data));}
  if(host)app.data.sessionName=String(name||app.data.sessionName||'Worship Session').trim().slice(0,80);
  app.showInvite=host;render();
  if(host){
    try{
      const updated=await loadRepositorySongs(app.data);
      if(app.generation!==generation)return;
      app.data=updated;app.data.liveSong=null;app.data.liveSong=structuredClone(activeSong(app.data));persist();render();
    }catch(error){if(app.generation!==generation)return;toast('GitHub songs unavailable. Using saved library. '+(error.message||''));}
  }
  const peer=new LyricsPeer({code,isHost:host,password:host?password:role==='control'?password:'',
    onStatus:(value,detail)=>{app.status=value;if(detail)toast(detail);renderStatus();},
    onState:snap=>{const prior=app.data?.cursor;app.data=snap;render();if(!prior||JSON.stringify(prior)!==JSON.stringify(snap.cursor))followLive();},
    onCommand:action=>dispatch(action),
    onAuth:(ok,reason)=>{app.authorized=ok;if(!ok&&reason!=='reconnecting'){app.modal='auth';toast('Incorrect controller password.');}else if(ok&&app.modal==='auth')app.modal='';render();},
    onPresence:n=>{app.peers=n;renderStatus();}
  });
  peer.getSnapshot=()=>app.data;
  app.peer=peer;
  try {await peer.start();}
  catch(error){app.status='error';toast(error.message||'Could not connect.');if(!host)app.modal='connect-failed';render();}
  finally{if(app.generation===generation)app.connectLock=false;}
}
async function leave(){
  app.generation++;app.connectLock=false;
  const peer=app.peer;app.peer=null;app.screen='welcome';app.status='idle';app.isHost=false;app.data=null;app.authorized=false;app.showInvite=false;app.modal='';app.editingSet=false;
  render();await peer?.close();
}
function preview(){app.screen='demo';app.isHost=true;app.role='control';app.authorized=true;app.code='DEMO';app.status='idle';app.data=loadSaved();app.showInvite=false;render();}
function jumpLocal(role){
  if(role==='control'&&!canControl()){app.modal='auth';render();return;}
  app.role=role;app.tab='lyrics';app.follow=true;app.scrollTop=0;render();followLive();
}
function renderStatus(){const el=$('#connection-slot');if(el)el.innerHTML=indicator();const c=$('#peer-count');if(c)c.textContent=`${app.peers} connected`;}
function wordmark(){return `<span class="brand-name">Sync Lyrics</span>`;}
function welcome(){return `<div class="photo-home"><img class="home-photo" src="./assets/home-room.jpg" width="1376" height="768" alt="" fetchpriority="high"><header class="photo-title"><h1>Sync Lyrics</h1><p class="photo-credit">not jack.</p></header><main class="photo-controls"><p class="photo-tagline">Peer-to-peer lyrics syncing.</p>
<button class="btn primary wide large" data-action="show-create">Create session ${icon('plus',18)}</button>
<div class="home-divider">or join</div><form id="join-form"><label for="join-code">SESSION CODE</label><div class="join-inline"><input id="join-code" name="code" class="code-input" placeholder="A7K92B" maxlength="6" autocomplete="off" autocapitalize="characters" value="${escape(app.pendingCode)}" required><button class="btn outline" type="submit">Join ${icon('right',17)}</button></div></form>
<button class="demo-link" data-action="preview">Try demo ${icon('right',15)}</button><a class="demo-link" href="./studio/" style="display:block;text-align:center;margin-top:12px;color:#f3d569;text-decoration:none">Open Lyrics Live Studio →</a></main></div>`;}
function createView(){return `<div class="welcome-shell"><header class="welcome-top"><div class="brand">${wordmark()}</div><button class="quiet-btn" data-action="home">${icon('left',16)} Back</button></header><main class="form-shell"><h1 class="form-title">Create session</h1><p class="intro">Keep this browser open and this device awake.</p><form id="create-form" class="form-card">
  <label for="create-name">SESSION NAME</label><input id="create-name" name="name" value="Sunday Worship" maxlength="80" required>
  <label for="create-password">CONTROL PASSWORD</label><input id="create-password" name="password" type="password" minlength="6" maxlength="100" autocomplete="new-password" placeholder="At least 6 characters" required>
  <p class="help">The password is for additional controllers. Stage and Projector don't need it.</p>

  <button type="submit" class="btn primary wide large">Start session ${icon('right',18)}</button></form></main></div>`;}
function joinView(){return `<div class="welcome-shell"><header class="welcome-top"><div class="brand">${wordmark()}</div><button class="quiet-btn" data-action="home">${icon('left',16)} Back</button></header><main class="form-shell"><h1 class="form-title">Join session</h1><form id="join-role-form" class="form-card">
   <label for="role-code">SESSION CODE</label><input id="role-code" class="code-input" name="code" value="${escape(app.pendingCode)}" maxlength="6" required autocapitalize="characters" autocomplete="off">
   <label>YOUR VIEW</label><div class="role-picks">
    ${[['projector','monitor','Projector','Lyrics only'],['stage','music','Stage','Lyrics + chords'],['control','controls','Control','Manage the slides']].map(([v,i,n,d])=>`<label class="role-pick"><input type="radio" name="role" value="${v}" ${app.pendingView===v || (!app.pendingView&&v==='stage')?'checked':''}><span class="role-pick-content">${icon(i,23)}<strong>${n}</strong><small>${d}</small></span></label>`).join('')}
   </div><div id="join-password-slot">${app.pendingView==='control'?passwordField():''}</div>
   <button type="submit" class="btn primary wide large">Connect to session ${icon('right',18)}</button>
   </form></main></div>`;}
function passwordField(){return `<label for="join-password">CONTROL PASSWORD</label><input id="join-password" name="password" type="password" autocomplete="off" placeholder="Enter controller password" required minlength="6">`;}
function topbar(){return `<header class="app-header"><div class="app-header-left"><div class="brand small-brand">${wordmark()}</div><div class="session-chip"><span>SESSION</span><strong>${escape(app.code)}</strong><button title="Copy session link" data-action="copy-link">${icon('link',16)}</button></div></div>
    <div class="app-header-right"><div id="connection-slot">${indicator()}</div><span class="peer-count" id="peer-count">${app.peers} connected</span>
    <button class="icon-button" title="Session options" aria-label="Session options" data-action="invite">${icon('more')}</button></div></header>`;}
function viewNav(){return `<div class="view-nav"><div class="view-segments">${[['projector','monitor','Projector'],['stage','music','Stage'],['control','controls','Control']].map(([v,ic,label])=>`<button class="view-button ${app.role===v?'selected':''}" data-action="view" data-view="${v}">${icon(ic,17)}<span>${label}</span>${v==='control'&&!canControl()?icon('lock',12):''}</button>`).join('')}</div></div>`;}
function bodyHeader(){
  const s=currentSong();const set=activeSet(app.data);const blank=app.data?.blank;
  return `<div class="song-header"><div><h1>${escape(s?.title||'No song selected')}</h1><div class="song-meta">${s?`<span>Key <b>${escape(s.key||'—')}</b></span>${s.bpm?`<span>${s.bpm} BPM</span>`:''}<span>Song ${app.data.cursor.song+1} of ${set?.songs.length||0}</span>`:''}</div></div><span class="live-badge ${blank?'is-blank':''}"><span class="status-dot"></span>${blank?'BLANK':'LIVE'}</span></div>`;
}
function songTabs(){return `<div class="song-tabs"><button class="song-tab ${app.tab==='lyrics'?'active':''}" data-action="tab" data-tab="lyrics">${icon('music',17)} Lyrics & chords</button><button class="song-tab ${app.tab==='setlist'?'active':''}" data-action="tab" data-tab="setlist">${icon('list',17)} Setlist</button></div>`;}
function lineMarkup(line,showChords=app.showChords){
  const segments=chordSegments(line);
  return `<div class="lyric-line">${segments.map((s,i)=>`<span class="chord-pair">${showChords?`<span class="chord-name">${escape(s.chord)||'&nbsp;'}</span>`:''}<span class="lyric-words">${escape(s.text)||'&nbsp;'}</span></span>`).join('')}</div>`;
}
function lyricsView(){
  const s=currentSong(), cursor=app.data?.cursor, control=app.role==='control'&&canControl();
  if(!s)return `<div class="empty-lyrics">${icon('music',36)}<h2>This set is empty</h2><p>Open Setlist to add your first song.</p></div>`;
  return `<div class="reading-toolbar"><button class="quiet-btn" data-action="reading-options" aria-expanded="${app.showReadingOptions}">${icon('settings',16)} Display</button></div><div class="reading-options" ${app.showReadingOptions?'':'hidden'}><label class="toggle-label"><input type="checkbox" id="chords-toggle" ${app.showChords?'checked':''}><span>Show chords</span></label><div class="font-controls"><button class="small-icon" data-action="font-less" aria-label="Smaller lyrics" ${app.font===0?'disabled':''}>${icon('minus',16)}</button><span>Aa</span><button class="small-icon" data-action="font-more" aria-label="Larger lyrics" ${app.font===2?'disabled':''}>${icon('plus',16)}</button></div></div>

  <div class="lyrics-scroll font-${app.font}" id="lyrics-scroll">${s.sections.map((section,si)=>`<div class="section-card ${si===cursor.section?'current':''}"><button class="section-heading ${control?'actionable':''}" ${control?`data-action="jump" data-song="${cursor.song}" data-section="${si}" data-page="0"`:''}><span>${escape(section.name)}</span>${si===cursor.section?'<small>CURRENT SECTION</small>':''}${control?icon('right',16):''}</button>
  ${(section.notes||[]).length?`<div class="stage-notes" aria-label="Stage notes">${section.notes.map(note=>`<div class="stage-note"><span>NOTE</span> ${escape(note)}</div>`).join('')}</div>`:''}
  ${section.pages.map((page,pi)=>{const isLive=si===cursor.section&&pi===cursor.page;return `<${control?'button':'div'} class="lyric-slide ${isLive?'on-air':''} ${control?'actionable':''}" ${control?`data-action="jump" data-song="${cursor.song}" data-section="${si}" data-page="${pi}"`:''} ${isLive?'data-current-slide="true"':''}><div class="slide-lines">${page.map(line=>lineMarkup(line)).join('')}</div>${isLive?`<span class="onair-text">${icon('monitor',14)} ON PROJECTOR</span>`:''}</${control?'button':'div'}>`;}).join('')}</div>`).join('')}</div><button class="return-to-live" id="return-to-live" data-action="return-live" ${app.follow?'hidden':''}>${icon('monitor',15)} Return to live</button>`;
}
function setlistView(){
  const editing=app.editingSet&&app.role==='control'&&canControl();
  const set=editing?editingSet():activeSet(app.data),current=set.id===app.data.activeSetId?app.data.cursor.song:-1;
  const library=app.data.library;
  return `<div class="setlist-content"><div class="set-toolbar"><div class="set-title-wrap"><div class="overline">CURRENT SET</div><h2>${escape(set?.name||'Setlist')}</h2></div>${app.role==='control'&&canControl()?`<button class="btn outline small" data-action="toggle-edit">${icon(editing?'check':'edit',16)} ${editing?'Done':'Edit Setlist'}</button>`:''}</div>
   ${editing?`<div class="editing-tools"><label>Edit set <select id="set-select" data-action="set-select">${app.data.sets.map(st=>`<option value="${escape(st.id)}" ${st.id===set.id?'selected':''}>${escape(st.name)}</option>`).join('')}</select></label><button class="btn primary small" data-action="take-set-live">Go live with this set</button><button data-action="new-set" class="btn outline small">${icon('plus',15)} New set</button><button data-action="rename-set" class="btn outline small">Rename</button><button data-action="open-library" class="btn outline small">${icon('library',15)} Song library</button></div>`:''}
   <div class="setlist-rows">${(set?.songs||[]).length?set.songs.map((id,i)=>{const song=library.find(x=>x.id===id);if(!song)return '';return `<div class="set-row ${i===current?'active':''}">${editing?`<input class="set-position" type="number" min="1" max="${set.songs.length}" step="1" value="${i+1}" data-position-index="${i}" aria-label="Position for ${escape(song.title)}">`:`<span class="track-number">${String(i+1).padStart(2,'0')}</span>`}<div class="set-row-copy"><strong>${escape(song.title)}</strong><span>${escape(song.key||'—')} ${i===current?'· ON AIR':''}${i===current&&app.data.liveSong&&(song.source!==app.data.liveSong.source||song.order!==app.data.liveSong.order||song.title!==app.data.liveSong.title)?' · SAVED CHANGES':''}</span></div>${editing?`<div class="mini-actions"><button data-action="move" data-index="${i}" data-dir="-1" title="Move up" ${i===0?'disabled':''}>${icon('arrowUp',17)}</button><button data-action="move" data-index="${i}" data-dir="1" title="Move down" ${i===set.songs.length-1?'disabled':''}>${icon('arrowDown',17)}</button><button data-action="remove" data-index="${i}" title="Remove from set">${icon('close',17)}</button></div>`:app.role==='control'&&canControl()?`<button class="btn outline small" data-action="go-song" data-index="${i}">${i===current?'Go live / reload':'Go live'}</button>`:i===current?`<span class="live-mark">${icon('monitor',17)}</span>`:''}</div>`;}).join(''):`<div class="empty-list">No songs yet. Add one from the library.</div>`}</div>
   ${editing?`<button class="add-song-button" data-action="open-library">${icon('plus',18)} Add songs from library</button>`:''}
   ${app.role==='control'&&canControl()&&!editing?`<p class="setlist-helper">Tap “Go live” to switch songs. Saved edits stay in the library. Go live / reload applies them to the screen.</p>`:''}
  </div>`;
}
function controlDock(){if(!app.data||app.role!=='control'||!canControl())return '';
  const s=app.data,c=app.data.cursor,part=activeSection(s);
  return `<div class="control-dock"><div class="dock-caption"><span><b>${escape(part?.name||'No section')}</b>${part?` <span class="caption-sep">·</span> Slide ${c.page+1} / ${part.pages.length}`:''}</span><span class="controller-indicator">${icon('controls',15)} LIVE CONTROL</span></div>
   <div class="dock-buttons"><button class="dock-button back" data-action="back" ${atStart(s)?'disabled':''}>${icon('left',26)}<strong>Back</strong></button><button class="dock-button next" data-action="next" ${atEnd(s)?'disabled':''}><strong>Next</strong>${icon('right',26)}</button><button class="dock-button blank ${s.blank?'active':''}" data-action="blank">${icon(s.blank?'show':'blank',25)}<strong>${s.blank?'Go live':'Blank'}</strong></button></div></div>`;
}
function stageScreen(){return `${topbar()}<main class="performance-shell">${viewNav()}<div class="performance-panel">${app.data?`${bodyHeader()}${songTabs()}${app.tab==='lyrics'?lyricsView():setlistView()}`:`<div class="waiting-host"><span class="spin"></span><h2>Waiting for the host</h2><p>Keep this page open while the host connects. Your screen will populate automatically.</p></div>`}${controlDock()}</div></main>`;}
function projectedText(){const sec=activeSection(app.data),c=app.data?.cursor;return sec?.pages[c.page]?.map(s=>chordSegments(s).map(x=>x.text).join(''))||[];}
function projectorScreen(){return `<div class="projector-shell" id="projector-shell"><div class="projection-frame ${app.data?.blank?'is-black':''} projection-font-${app.projectorFont}">
  ${app.data&&!app.data.blank?`<div class="projected-lines">${projectedText().map(t=>`<div>${escape(t)}</div>`).join('')||(activeSection(app.data)?'':'<div class="projector-placeholder">Waiting for lyrics</div>')}</div>`:!app.data?'<div class="projected-lines projector-placeholder">Waiting for host…</div>':''}
  </div><div class="projector-tools ${app.showProjectorTools?'open':''}"><div class="projector-tools-head"><span>${escape(currentSong()?.title||'Sync Lyrics')} ${activeSection(app.data)?'· '+escape(activeSection(app.data).name):''}</span>${indicator()}</div><div class="projector-tool-row"><button class="btn outline small" data-action="projector-font-less" ${app.projectorFont===0?'disabled':''}>${icon('minus',17)} A</button><button class="btn outline small" data-action="projector-font-more" ${app.projectorFont===4?'disabled':''}>${icon('plus',17)} A</button><button class="btn outline small" data-action="fullscreen">${icon('fullscreen',16)} Fullscreen</button><button class="btn outline small" data-action="projection-options">${icon('settings',17)} ${app.showProjectorTools?'Hide':'Options'}</button><button class="btn outline small" data-action="projector-return">${icon('left',17)} Leave view</button></div></div>
 <button class="projection-gear" data-action="projection-options" title="Projector settings" aria-label="Projector settings">${icon('settings',23)}</button></div>`;}
function updateOrderPreview(){
  const form=$('#song-editor-form'),out=$('#order-preview');if(!form||!out)return;
  const sections=parseSongText(form.elements.source.value),order=form.elements.order.value;
  try{const result=arrangeSections(sections,order);out.classList.remove('invalid');out.innerHTML=result.length?`<span class="preview-label">${order.trim()?'WILL PLAY':'LYRICS ORDER'}</span><div class="order-chips">${result.map(s=>`<span>${escape(s.name)} <small>· ${s.pages.length} ${s.pages.length===1?'slide':'slides'}</small></span>`).join('<b aria-hidden="true">→</b>')}</div>`:'Add section headings and lyrics or # stage notes to see the order.';}
  catch(error){out.classList.add('invalid');out.textContent=error.message;}
}
document.addEventListener('input',e=>{if(e.target.closest('#song-editor-form')&&['source','order'].includes(e.target.name))updateOrderPreview();});
function syntaxExamples(){
  const examples=[
    ['Sections & slides','[Verse 1]\nFirst line\nSecond line\n---\nThird line\nFourth line\n\n[Verse 2]\nNext verse begins here'],
    ['Chords','[Chorus]\n[G]Amazing [D/F#]grace\n[Em7]How sweet the [C]sound'],
    ['Stage notes','[Verse 1]\n# Guitar only. Sing softly.\n[G]Only the lyric words reach the projector'],
    ['Instrumental section','[Outro]\n# Guitar only, four bars.']
  ];
  return examples.map(([title,source])=>{
    const sections=parseSongText(source);
    return `<div class="syntax-example"><h3>${escape(title)}</h3><div class="syntax-columns"><div><div class="syntax-label">TYPE THIS</div><pre>${escape(source)}</pre></div><div><div class="syntax-label">STAGE / CONTROL</div><div class="syntax-stage">${sections.map(section=>`<div class="syntax-section">${escape(section.name)}</div>${(section.notes||[]).map(n=>`<div class="stage-note">${escape(n)}</div>`).join('')}${section.pages.map(page=>`<div class="syntax-slide">${page.map(line=>lineMarkup(line,true)).join('')}</div>`).join('')}`).join('')}</div><div class="syntax-label">PROJECTOR</div><div class="syntax-projector">${sections.flatMap(section=>section.pages).map(page=>`<div class="syntax-slide">${page.map(line=>`<div>${escape(chordSegments(line).map(x=>x.text).join(''))}</div>`).join('')}</div>`).join('')}</div></div></div></div>`;
  }).join('')+`<div class="syntax-example"><h3>Section order</h3><pre>V1, C, V2, C, B, C</pre><p class="help">Plays Verse 1 → Chorus → Verse 2 → Chorus → Bridge → Chorus. Define each section once in the lyrics. Repeated sections keep their chords and notes.</p></div>`;
}
function modal(){if(app.showInvite && (app.screen==='session'||app.screen==='demo'))return inviteModal();
  if(!app.modal)return '';
  const wrap=content=>`<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" role="dialog" aria-modal="true" >${content}</div></div>`;
  const close=`<button class="icon-button close-modal" aria-label="Close" data-action="close-modal">${icon('close')}</button>`;
  if(app.modal==='auth')return wrap(`${close}<span class="modal-symbol">${icon('lock',24)}</span><h2>Controller access</h2><p>Enter the session's Control password. Stage and Projector don't require it.</p><form id="reauth-form"><label>CONTROL PASSWORD</label><input type="password" name="password" autocomplete="off" required minlength="6"><button class="btn primary wide large" type="submit">Unlock Control</button></form>`);
  if(app.modal==='connect-failed')return wrap(`${close}<span class="modal-symbol">${icon('wifi',24)}</span><h2>Connection unavailable</h2><p>The signaling connection couldn't start. Check your internet connection and make sure the VDO.Ninja SDK isn't blocked.</p><button class="btn primary wide" data-action="leave">Return home</button>`);
  if(app.modal==='create-set')return wrap(`${close}<h2>Create a set</h2><p>Organize songs for another service or rehearsal.</p><form id="create-set-form"><label>SET NAME</label><input name="name" maxlength="80" placeholder="Friday Night Worship" required><button type="submit" class="btn primary wide large">Create set</button></form>`);
  if(app.modal==='rename-set')return wrap(`${close}<h2>Rename set</h2><form id="rename-set-form"><label>SET NAME</label><input name="name" maxlength="80" value="${escape(setName())}" required><button type="submit" class="btn primary wide large">Save name</button></form>`);
  if(app.modal==='import-set')return wrap(`${close}<h2>Import prepared set</h2><p>Choose a JSON set exported from Lyrics Live Studio. Songs are added to the host's library with new IDs, preserving all existing sets. Nothing currently live changes.</p><button class="btn primary wide large" data-action="choose-set-import">Choose set JSON</button>`);
  if(app.modal==='library')return wrap(`<div class="modal-wide">${close}<div class="overline">SONG LIBRARY</div><h2>Your songs</h2><p>Add songs to the set or create a song.</p><p class="help"><a class="github-library-link" href="https://github.com/dannotjack/sync/edit/main/songs/library.json" target="_blank" rel="noopener noreferrer">Edit shared library on GitHub ${icon('external',13)}</a> · Loads when a host session starts. App edits stay with the host.</p><div class="library-list">${app.data.library.map(song=>`<div class="library-entry"><div><strong>${escape(song.title)}</strong><small>Key ${escape(song.key||'—')} · ${song.sections.length} sections</small></div><div class="mini-actions"><button data-action="edit-song" data-id="${escape(song.id)}" title="Edit song">${icon('edit',17)}</button><button data-action="add-song" data-id="${escape(song.id)}" title="Add to set">${icon('plus',20)}</button></div></div>`).join('')}</div><button class="btn primary wide large" data-action="new-song">${icon('plus',17)} Create new song</button></div>`);
  if(app.modal==='song-editor'){
    const song=app.editor||{id:'',title:'',key:'',bpm:0,order:'',source:''};
    return wrap(`<div class="modal-wide song-editor-modal">${close}<div class="overline">SONG EDITOR</div><h2>${song.id?'Edit song':'New song'}</h2><form id="song-editor-form"><input type="hidden" name="id" value="${escape(song.id||'')}"><div class="editor-fields"><label>Song title<input name="title" maxlength="100" required value="${escape(song.title)}"></label><label>Key<input name="key" maxlength="16" value="${escape(song.key)}" placeholder="G"></label><label>BPM<input name="bpm" type="number" min="0" max="300" value="${Number(song.bpm)||''}" placeholder="Optional"></label></div><label>SECTION ORDER<input name="order" maxlength="2000" value="${escape(song.order||'')}" placeholder="Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus" aria-describedby="order-preview"></label><div id="order-preview" class="order-preview" aria-live="polite"></div><p class="help">Optional. Use headings, V1 / C / B, or section numbers separated by commas. Leave empty to follow the lyrics below.</p><label>LYRICS + CHORDS</label><textarea name="source" spellcheck="false" rows="13" placeholder="${escape(SONG_SYNTAX_EXAMPLE)}" required>${escape(song.source)}</textarea><p class="help">[Verse 1] starts a section. --- starts another slide in that section. The next heading starts a new section. Blank lines are spacing only.</p><details class="syntax-guide"><summary>How to write lyrics</summary><p class="help">Four things: [Section], --- for slides, [G] for chords, # for stage notes. No closing tags needed.</p>${syntaxExamples()}<details><summary>Full song example</summary><pre>${escape(SONG_SYNTAX_EXAMPLE)}</pre></details></details><div class="editor-actions"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save song ${icon('check',17)}</button></div></form></div>`);
  }
  return '';
}
function inviteModal(){return `<div class="modal-backdrop" data-action="close-invite"><div class="modal-card" role="dialog" aria-modal="true" ><button class="icon-button close-modal" data-action="close-invite" aria-label="Close">${icon('close')}</button><div class="overline">YOUR LIVE SESSION</div><h2>Invite your team</h2><p>Open the same website on another device and enter the code. Or share the link.</p><div class="code-display">${escape(app.code)}</div><div class="invite-link">${escape(sessionLink())}</div><div class="invite-actions"><button class="btn primary" data-action="copy-link">${icon('link',16)} Copy invite link</button><button class="btn outline" data-action="open-projector">${icon('external',16)} Open projector tab</button></div><div class="modal-note">${app.screen==='demo'?'Demo mode does not connect to other devices.':'Keep the host browser open and prevent the computer from sleeping.'}</div><div class="modal-divider"></div><div class="backups">${app.isHost?'<button data-action="show-set-import">Import Studio set</button>':''}<button data-action="export">${icon('download',18)} Export backup</button>${app.isHost?`<button data-action="import">${icon('upload',18)} Import backup</button>`:''}</div><button class="btn outline wide" data-action="leave">${icon('left',17)} ${app.isHost?'End host session':'Leave session'}</button></div></div>`;}
let renderedModalKey='';
function render(){
  const el=$('#app');if(!el)return;
  const isPerformance=(app.screen==='session'||app.screen==='demo');
  const keepScroll=app.tab==='lyrics' && app.role!=='projector' && !app.follow ? ($('.lyrics-scroll')?.scrollTop??app.scrollTop):0;
  const modalKey=isPerformance?(app.showInvite?'invite':app.modal):'';
  const held=modalKey&&modalKey===renderedModalKey?$('.modal-backdrop'):null;
  const focused=held?.contains(document.activeElement)?document.activeElement:null;
  const selection=focused&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;
  if(held)held.remove();
  const projector=isPerformance&&app.role==='projector'?$('#projector-shell'):null;
  if(projector){
    const tmp=document.createElement('div');tmp.innerHTML=projectorScreen();
    projector.innerHTML=tmp.firstElementChild.innerHTML;
    el.querySelectorAll('.modal-backdrop,#toast-root').forEach(n=>n.remove());
  }else el.innerHTML= app.screen==='welcome'?welcome():app.screen==='create'?createView():app.screen==='join'?joinView():app.role==='projector'?projectorScreen():stageScreen();
  if(held){el.appendChild(held);focused?.focus({preventScroll:true});if(selection)focused.setSelectionRange(...selection);}
  else if(isPerformance)el.insertAdjacentHTML('beforeend',modal());
  renderedModalKey=modalKey;
  if(app.modal==='song-editor')updateOrderPreview();
  if(!$('#toast-root'))el.insertAdjacentHTML('beforeend','<div id="toast-root"></div>');renderToast();
  if(!app.follow && $('.lyrics-scroll'))$('.lyrics-scroll').scrollTop=keepScroll;
  if(app.follow && isPerformance && app.tab==='lyrics' && app.role!=='projector')followLive();
}
function followLive(){if(!app.follow)return;requestAnimationFrame(()=>{
  const sc=$('.lyrics-scroll'),live=$('[data-current-slide="true"]');if(!sc||!live)return;
  app.programScroll=true;
  sc.scrollTop=Math.max(0,sc.scrollTop+live.getBoundingClientRect().top-sc.getBoundingClientRect().top-sc.clientHeight*0.35);
  requestAnimationFrame(()=>{app.programScroll=false;});
 });}
function downloadJson(){
  if(!app.data)return;const text=JSON.stringify({...app.data,blank:false},null,2);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sync-lyrics-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
async function copyText(value){try{await navigator.clipboard.writeText(value);toast('Link copied.');}catch(e){toast('Could not copy automatically. Select the link shown to copy it.');}}
async function handleAction(btn){
  const action=btn.dataset.action;
  if(action==='show-create'){app.screen='create';render();}
  if(action==='home'){app.screen='welcome';app.pendingView='';render();}
  if(action==='preview'){preview();}
  if(action==='close-modal'){app.modal='';render();}
  if(action==='close-invite'){app.showInvite=false;render();}
  if(action==='invite'){app.showInvite=true;render();}
  if(action==='view'){jumpLocal(btn.dataset.view);}
  if(action==='tab'){app.tab=btn.dataset.tab;app.follow=true;app.scrollTop=0;render();}
  if(action==='chords-toggle'){app.showChords=!app.showChords;render();}
  if(action==='reading-options'){app.showReadingOptions=!app.showReadingOptions;render();}
  if(action==='font-less'){app.font=Math.max(0,app.font-1);render();}
  if(action==='font-more'){app.font=Math.min(2,app.font+1);render();}
  if(action==='projector-font-less'){app.projectorFont=Math.max(0,app.projectorFont-1);render();}
  if(action==='projector-font-more'){app.projectorFont=Math.min(4,app.projectorFont+1);render();}
  if(action==='projection-options'){app.showProjectorTools=!app.showProjectorTools;render();}
  if(action==='projector-return'){if(app.isHost||app.authorized)jumpLocal('control');else jumpLocal('stage');}
  if(action==='fullscreen'){const el=$('#projector-shell');if(document.fullscreenElement)await document.exitFullscreen();else await el?.requestFullscreen?.();}
  if(action==='back')await dispatch({kind:'step',dir:-1});
  if(action==='next')await dispatch({kind:'step',dir:1});
  if(action==='blank')await dispatch({kind:'blank',value:!app.data.blank});
  if(action==='jump'){await dispatch({kind:'jump',index:Number(btn.dataset.song),section:Number(btn.dataset.section),page:Number(btn.dataset.page)});}
  if(action==='go-song'){await dispatch({kind:'take-song-live',index:Number(btn.dataset.index),section:0,page:0});app.tab='lyrics';render();}
  if(action==='return-live'){app.follow=true;render();followLive();}
  if(action==='toggle-edit'){app.editingSet=!app.editingSet;if(app.editingSet)app.editSetId=app.data.activeSetId;render();}
  if(action==='take-set-live'){await dispatch({kind:'activate-set',id:editingSet().id});app.editingSet=false;app.tab='lyrics';render();}
  if(action==='new-set'){app.modal='create-set';render();}
  if(action==='rename-set'){app.modal='rename-set';render();}
  if(action==='open-library'){app.modal='library';render();}
  if(action==='new-song'){app.editor=null;app.modal='song-editor';render();}
  if(action==='edit-song'){app.editor=app.data.library.find(x=>x.id===btn.dataset.id);app.modal='song-editor';render();}
  if(action==='add-song'){await dispatch({kind:'add-to-set',setId:editingSet().id,id:btn.dataset.id});toast('Added to setlist.');}
  if(action==='move'){await dispatch({kind:'move-in-set',setId:editingSet().id,index:Number(btn.dataset.index),dir:Number(btn.dataset.dir)});}
  if(action==='remove'){await dispatch({kind:'remove-from-set',setId:editingSet().id,index:Number(btn.dataset.index)});}
  if(action==='copy-link')copyText(sessionLink());
  if(action==='open-projector'){
    if(app.screen==='demo'){toast('Projector tabs need a live session.');return;}
    window.open(sessionLink('projector'),'_blank','noopener,noreferrer');
  }
  if(action==='export')downloadJson();
  if(action==='import')$('#backup-input').click();
  if(action==='show-set-import'){app.showInvite=false;app.modal='import-set';render();}
  if(action==='choose-set-import')$('#set-import-input').click();
  if(action==='leave'){
    if(app.isHost&&!confirm('End hosting? Other devices will lose live synchronization.'))return;
    await leave();
  }
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-action]');if(!btn)return;
  if(btn.matches('.modal-backdrop')&&e.target!==btn)return;
  e.preventDefault();handleAction(btn).catch(err=>toast(err.message||'Action failed.'));
});
document.addEventListener('change',async e=>{
 try {
  if(e.target.name==='role'){app.pendingView=e.target.value;const slot=$('#join-password-slot');if(slot)slot.innerHTML=e.target.value==='control'?passwordField():'';}
  if(e.target.matches('.set-position')){await dispatch({kind:'position-in-set',setId:editingSet().id,index:Number(e.target.dataset.positionIndex),position:Number(e.target.value)});}
  if(e.target.id==='chords-toggle'){app.showChords=e.target.checked;render();}
  if(e.target.id==='set-select'){app.editSetId=e.target.value;render();}
 }catch(error){toast(error.message);render();}
});
document.addEventListener('scroll',e=>{
  if(e.target.id==='lyrics-scroll'&&!app.programScroll){app.scrollTop=e.target.scrollTop;app.follow=false;const b=$('#return-to-live');if(b)b.hidden=false;}
},true);
document.addEventListener('submit',async e=>{
  const form=e.target;if(!(form instanceof HTMLFormElement))return;e.preventDefault();const values=Object.fromEntries(new FormData(form).entries());const formId=form.getAttribute('id');
  try {
    if(formId==='join-form') {app.pendingCode=String(values.code).trim().toUpperCase();app.screen='join';render();}
    if(formId==='create-form') {await startSession({host:true,code:sessionCode(),password:String(values.password),role:'control',name:values.name});}
    if(formId==='join-role-form') {
      const code=String(values.code).toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6)throw new Error('Enter a six-character code.');
      await startSession({host:false,code,password:values.password||'',role:values.role||'stage'});
      app.pendingView='';
    }
    if(formId==='reauth-form'){
      app.password=String(values.password);app.peer.password=app.password;if(!app.peer.hostUuid)throw new Error('Host not connected yet. Try again once connected.');app.peer.send({kind:'auth',password:app.password},app.peer.hostUuid);
      app.role='control';app.modal='';render();
    }
    if(formId==='create-set-form'){await dispatch({kind:'create-set',name:values.name});app.modal='';render();toast('Set created. Select it to edit; Go live publishes it.');}
    if(formId==='rename-set-form'){await dispatch({kind:'rename-set',setId:editingSet().id,name:values.name});app.modal='';render();}
    if(formId==='song-editor-form') {
      const song=validSong(values);await dispatch({kind:'save-song',song});app.modal='library';app.editor=null;render();toast('Saved to library. Go live / reload applies changes.');
    }
  }catch(error){toast(error.message||'Could not continue.');}
});
document.addEventListener('keydown',async e=>{
  const editable=e.target.closest('input,textarea,select,[contenteditable="true"]');
  if(e.key==='Escape'&&(app.modal||app.showInvite)){app.modal='';app.showInvite=false;render();return;}
  if(editable||!app.data||app.modal||app.showInvite||!canControl()||(app.screen!=='session'&&app.screen!=='demo'))return;
  try {
  if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();await dispatch({kind:'step',dir:1});}
  if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();await dispatch({kind:'step',dir:-1});}
  if(e.key.toLowerCase()==='b'){e.preventDefault();await dispatch({kind:'blank',value:!app.data.blank});}
  }catch(error){toast(error.message);}
});
const setImportInput=document.createElement('input');setImportInput.type='file';setImportInput.id='set-import-input';setImportInput.accept='.json,application/json';setImportInput.hidden=true;document.body.appendChild(setImportInput);
setImportInput.addEventListener('change',async()=>{
 const file=setImportInput.files?.[0];setImportInput.value='';if(!file)return;
 if(!app.isHost||!app.data){toast('Only the host can import a set.');return;}
 try{
  if(file.size>2_000_000)throw new Error('Set file exceeds 2 MB.');
  const manifest=JSON.parse(await file.text());
  if(manifest.format!=='lyrics-live-set'||manifest.version!==1||!Array.isArray(manifest.songs)||manifest.songs.length>120)throw new Error('Choose a set exported by Lyrics Live Studio.');
  const prepared=manifest.songs.map(item=>validSong({...item,id:crypto.randomUUID()}));
  if(app.data.library.length+prepared.length>300)throw new Error('Library cannot exceed 300 songs.');
  if(app.data.sets.length>=50)throw new Error('Maximum 50 sets reached.');
  const next=structuredClone(app.data);
  next.library.push(...prepared);
  const set={id:crypto.randomUUID(),name:String(manifest.name||'Imported set').trim().slice(0,80)||'Imported set',songs:prepared.map(song=>song.id)};
  next.sets.push(set);next.rev=(Number(next.rev)||0)+1;
  app.data=next;app.editSetId=set.id;app.editingSet=true;app.tab='setlist';app.modal='';
  persist();app.peer?.sendSnapshot();render();toast('Imported set safely. Review it before Go live.');
 }catch(e){toast(e.message||'Set import failed.');}
});
const backupInput=document.createElement('input');backupInput.id='backup-input';backupInput.type='file';backupInput.accept='.json,application/json';backupInput.hidden=true;document.body.appendChild(backupInput);
backupInput.addEventListener('change',async()=>{
  const file=backupInput.files?.[0];backupInput.value='';if(!file)return;
  if(!app.isHost){toast('Import backups on the host device.');return;}
  try {
    if(file.size>2_000_000)throw new Error('Backup is too large (2 MB limit).');
    if(!confirm('Replace the host song library and sets with this backup?'))return;
    const restored=validateImport(JSON.parse(await file.text()));restored.rev=app.data.rev+1;app.data=restored;persist();app.peer?.sendSnapshot();app.showInvite=false;render();toast('Backup imported.');
  }catch(e){toast(e.message||'Import failed.');}
});
if(app.pendingCode.length===6){app.screen='join';}
if(params.get('demo')==='1') preview();
else render();
// Projector deep links auto-join without an extra role selection step.
if(app.screen==='join' && ['projector','stage'].includes(app.pendingView))startSession({host:false,code:app.pendingCode,password:'',role:app.pendingView});
