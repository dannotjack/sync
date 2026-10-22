import {parseSongText,arrangeSections,validSong,chordSegments,SONG_SYNTAX_EXAMPLE} from '../src/model.js?v=beta11';
import {normalize,validateStudioState,validateSet,masterManifest,backupToSet,encodeDownload,sourceReferences,mergePublishedDefaults,LIMITS} from './state.js?v=beta12';
import {setupOnSongBrowser} from './source-import.js?v=beta11';
import {onsongId,convertOnSong,onSongRawUrl} from './onsong.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const LS='lyrics-live-studio-v1';
let onsongBrowser;
let catalogIndex=[],catalogCommit='',catalogStatus='Loading external song index…';
let libraryFilter='';
const empty=()=>({version:1,songs:[],sets:[],references:[]});
let mobilePane='songs',savingState='Saved in this browser',storageFailed=false,recoveryRaw='';
let state=empty(),mode='master',selected='',setId='',display='stage',importMode='master',modified=false,previewSlide=0;
let msgTimer,renderedSongId='';
function notify(t){$('#toast').textContent=t;clearTimeout(msgTimer);msgTimer=setTimeout(()=>$('#toast').textContent='',4600);}
const oldExamples={
  morning:{title:'Morning Light',length:422,hash:'6c9db5b8'},
  waters:{title:'Still Waters',length:255,hash:'dbd350f3'},
  new:{title:'All Things New',length:153,hash:'a44421a0'}
};
function untouchedExample(song){
  const sig=oldExamples[song.id];
  if(!sig||song.title!==sig.title||song.source?.length!==sig.length)return false;
  let hash=2166136261;
  for(const char of song.source){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16)===sig.hash;
}
function cleanOldStudioExamples(){state.songs=state.songs.filter(song=>!untouchedExample(song));}
function safeLoad(){
 const raw=localStorage.getItem(LS);
 if(!raw)return false;
 try{const saved=JSON.parse(raw);state=validateStudioState(saved);modified=!!saved.modified;cleanOldStudioExamples();return true;}
 catch(error){recoveryRaw=raw;storageFailed=true;savingState='Stored work needs recovery';notify('Stored Studio work could not be read. Download the recovery file before resetting.');return true;}
}
function updateSaveStatus(){
 const status=$('[data-save-status]');if(status)status.textContent=savingState;
 const warning=$('#save-warning');if(warning)warning.hidden=!storageFailed;
}
function persist(){
 savingState='Saving…';updateSaveStatus();
 try{
  if(recoveryRaw)throw Error('Download stored work before resetting Studio.');
  localStorage.setItem(LS,JSON.stringify({...state,modified}));
  storageFailed=false;savingState='Saved in this browser';updateSaveStatus();return true;
 }catch(error){storageFailed=true;savingState='Not saved · download a backup';updateSaveStatus();return false;}
}
function workingList(){return mode==='master'?state.songs:(state.sets.find(x=>x.id===setId)?.songs||[]);}
function addWorking(song){
 if(mode==='sets'&&!state.sets.some(set=>set.id===setId))throw Error('Create a set first.');
 const entries=workingList(),limit=mode==='master'?LIMITS.songs:LIMITS.setSongs;
 if(entries.length>=limit)throw Error('Maximum '+limit+' songs reached.');
 entries.push(song);
}
function dialog(title,content,buttons){
 const previous=document.activeElement,el=document.createElement('dialog');el.className='studio-dialog';el.setAttribute('aria-label',title);
 el.innerHTML='<h2>'+esc(title)+'</h2>'+content+'<div class="row dialog-actions">'+buttons.map(b=>'<button type="button" data-dialog-value="'+esc(b.value)+'" '+(b.primary?'class="primary"':'')+'>'+esc(b.label)+'</button>').join('')+'</div>';
 document.body.appendChild(el);
 return new Promise(resolve=>{
  const finish=value=>{el.close();el.remove();previous?.focus();resolve(value);};
  el.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  el.addEventListener('click',event=>{const button=event.target.closest('[data-dialog-value]');if(button)finish(button.dataset.dialogValue);});
  el.showModal();el.querySelector('input,button')?.focus();
 });
}
function masterEntries(){
 const localIds=new Set(state.songs.map(s=>s.id));
 return [...state.songs,...catalogIndex.filter(song=>!localIds.has(song.id))].sort((a,b)=>a.title.localeCompare(b.title));
}
function list(){return mode==='master'?masterEntries():(state.sets.find(x=>x.id===setId)?.songs||[]);}
function current(){return list().find(x=>x.id===selected);}
async function hydrateExternal(id) {
 const existing=state.songs.find(s=>s.id===id);
 if(existing)return existing;
 const entry=catalogIndex.find(s=>s.id===id);
 if(!entry)throw Error('Song not found in master index.');
 notify('Loading song…');
 const response=await fetch(onSongRawUrl(catalogCommit,entry.originPath),{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Could not download song ('+response.status+'). Check your connection.');
 const text=await response.text();
 if(text.length>300000)throw Error('Song source exceeds safe size.');
 const song=normalize(convertOnSong(text,entry.originPath));
 if(state.songs.length>=LIMITS.songs)throw Error('Maximum 1000 master songs.');
 validSong(song);
 const concurrent=state.songs.find(s=>s.id===id);
 if(concurrent)return concurrent;
 state.songs.push(song);
 modified=true;persist(); // local working copy only — no public GitHub write
 return song;
}
async function loadCatalog(){
 try{
  const response=await fetch('./onsong-catalog.json?v=2',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Could not load OnSong index.');
  const parsed=await response.json();
  if(parsed.version!==1||!Array.isArray(parsed.files)||parsed.files.length!==parsed.count||!/^[a-f0-9]{40}$/.test(parsed.commit))throw Error('Invalid OnSong index.');
  catalogCommit=parsed.commit;
  catalogIndex=parsed.files.map(f=>({id:onsongId(f.path),title:f.path.replace(/\.onsong$/i,''),key:'',bpm:0,order:'',source:'',artist:'',origin:'mattgraham/worship',originPath:f.path,remote:true}));
  catalogStatus=parsed.count+' linked OnSong titles';
 }catch(e){catalogStatus='Source index unavailable · '+e.message;console.warn(e);}
}

function download(name,obj,limit=LIMITS.file){const text=typeof obj==='string'?obj:encodeDownload(obj,limit);const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function masterJSON(){return masterManifest(state);}
function setJSON(){const set=state.sets.find(s=>s.id===setId);if(!set)throw Error('Select a set first');const result={format:'lyrics-live-set',version:1,name:set.name,songs:set.songs};validateSet(result);return result;}
function button(action,title,extra=''){return '<button data-action="'+action+'" '+extra+'>'+title+'</button>';}
function songRow(song,index){
 const hidden=!song.title.toLowerCase().includes(libraryFilter.toLowerCase());
 const extra=mode==='sets'?'<input class="song-position" type="number" min="1" max="'+list().length+'" value="'+(index+1)+'" data-song-position="'+esc(song.id)+'" aria-label="Position for '+esc(song.title)+'">':'';
 return '<div class="songitem '+(song.id===selected?'selected':'')+'" '+(hidden?'hidden':'')+'>'+extra+'<button class="song-select" data-action="choose" data-id="'+esc(song.id)+'"><strong>'+esc(song.title||'Untitled song')+'</strong><small>'+esc(song.remote?'Linked source · load on selection':'Key '+(song.key||'—')+' · '+(song.source.match(/^\[[^\]]+\]/gm)||[]).length+' sections')+'</small></button></div>';
}
function render(){const song=current(),sets=state.sets,activeSet=sets.find(s=>s.id===setId);const focused=document.activeElement,sameSong=song?.id===renderedSongId,focusId=sameSong?focused?.id:'',selection=focused&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;$('#app').innerHTML='<div class="shell" data-mobile-pane="'+mobilePane+'"><header class="topbar"><div class="brand">Sync Lyrics <b>Studio</b><small>not jack. · Prepare without a live session</small></div><div class="top-actions">'+button('import','Import JSON / Text')+button('backup','Backup all')+button('export',mode==='master'?'Export master JSON':'Export set JSON','class="primary"')+'</div></header><nav class="tabs">'+button('master','Master Library',mode==='master'?'class="active"':'')+button('sets','Local Sets',mode==='sets'?'class="active"':'')+'<span class="muted" data-save-status style="margin-left:auto;align-self:center;font-size:12px">'+esc(savingState)+'</span></nav><div id="save-warning" class="save-warning" '+(storageFailed?'':'hidden')+'>Changes are only in memory. Download a backup before leaving. '+button('backup','Download backup')+(recoveryRaw?button('recovery','Download recovery file')+button('reset-recovery','Reset stored work'):'')+'</div><nav class="mobile-panes" aria-label="Studio workspace">'+['songs','editor','preview'].map(p=>button('pane-'+p,p[0].toUpperCase()+p.slice(1),mobilePane===p?'class="active" aria-pressed="true"':'aria-pressed="false"')).join('')+'</nav><main class="workspace"><aside class="panel library-panel"><div class="panel-head"><h2>'+(mode==='master'?'Master songs':'Set songs')+'</h2><span class="muted">'+list().length+'</span></div>'+(mode==='sets'?'<div class="set-tools"><select id="set-picker" aria-label="Choose set">'+sets.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===setId?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select><div class="row">'+button('new-set','+ New set')+button('rename-set','Rename',activeSet?'':'disabled')+button('delete-set','Delete',activeSet?'':'disabled')+'</div>'+button('add-from-master','+ Add from master',activeSet?'':'disabled')+'</div>':'')+'<div class="side-actions">'+button('new-song','+ New song',mode==='sets'&&!activeSet?'disabled':'')+(mode==='master'?button('refresh-master','Fetch published songs')+button('open-onsong','Bulk import OnSong'):'')+'</div><div class="set-tools"><input id="library-filter" type="search" placeholder="Search '+(mode==='master'?'master library':'set songs')+'…" aria-label="Search songs" value="'+esc(libraryFilter)+'"></div><div class="info" style="margin:0 12px 8px">'+(mode==='master'?esc(catalogStatus)+'. '+state.songs.length+' downloaded / local songs. Linked titles load on selection; exports include prepared songs and published source references.':'Independent copies in this set; changes do not affect your master.')+'</div><div class="songlist">'+(list().length?list().map(songRow).join(''):'<div class="empty">No songs yet. Create one or import a library.</div>')+'</div></aside><section class="panel editor-panel"><div class="panel-head"><h2>Song Editor</h2><div class="row">'+(song?button('duplicate','Duplicate',song.remote?'disabled':'')+button('delete-song','Delete','class="danger" '+(song.remote?'disabled':'')):'')+'</div></div>'+(song?.remote?'<div class="empty"><h3>'+esc(song.title)+'</h3><p>Linked song title from the external OnSong catalogue. Lyrics are not stored on this website.</p>'+button('load-selected-source','Load lyrics and chords','class="primary"')+'</div>':song?'<div class="editor"><div class="mainfields"><label>Title<input id="title" maxlength="100" value="'+esc(song.title)+'"></label><label>Key<input id="key" maxlength="16" value="'+esc(song.key)+'"></label><label>BPM<input id="bpm" type="number" min="0" max="300" value="'+esc(song.bpm||'')+'"></label></div><label>Section order<input id="order" maxlength="2000" value="'+esc(song.order)+'" placeholder="V1, C, V2, C, B, C"></label><div class="info" id="order-help">Write sections once; repeat with order, e.g. V1, C, V2, C</div><div class="row space"><strong>Lyrics + chords</strong><span class="muted">Saved locally while you type</span></div><div class="toolbar">'+button('insert-verse','Verse')+button('insert-chorus','Chorus')+button('insert-bridge','Bridge')+button('insert-slide','Slide break')+button('insert-note','Stage note')+button('insert-chord','Chord')+'</div><textarea id="source" maxlength="100000" spellcheck="false" placeholder="'+esc(SONG_SYNTAX_EXAMPLE)+'" aria-label="Lyrics and chords">'+esc(song.source)+'</textarea><details><summary>Formatting guide</summary><p>[Verse 1] starts a section; --- creates a slide; [G] creates a chord; # creates a stage note. Define a section once, then use Section order to repeat it.</p><pre>'+esc(SONG_SYNTAX_EXAMPLE)+'</pre><p>Use the Stage and Projector preview to see exactly how your text displays.</p></details><div class="row">'+button('copy-to-master','Save copy to master',mode==='sets'?'':'hidden')+'<span class="muted">Edits stay in this browser until exported.</span></div></div>':'<div class="empty">Select or create a song to start editing.</div>')+'</section><section class="panel preview-panel"><div class="panel-head"><h2>Live Preview</h2><div class="previewtabs">'+button('preview-stage','Stage',display==='stage'?'class="active"':'')+button('preview-projector','Projector',display==='projector'?'class="active"':'')+'</div></div><div class="preview" id="preview"></div></section></main><footer class="bottom">No GitHub sign-in or database required. Export <b>songs/library.json</b> to publish the master library manually. Local sets export separately for Sync Lyrics. <a href="../">Back to Sync Lyrics</a></footer></div>';renderedSongId=song?.id||'';updatePreview();if(focusId){const replacement=document.getElementById(focusId);replacement?.focus({preventScroll:true});if(selection)replacement?.setSelectionRange(...selection);}}
function updatePreview(){const p=$('#preview'),s=current();if(!p)return;if(s?.remote){p.innerHTML='<div class="empty">Select this title to load its Stage and Projector preview.</div>';return;}if(!s){p.innerHTML='<div class="empty">Your lyrics preview will appear here.</div>';return;}let sections=[],err='';try{sections=arrangeSections(parseSongText(s.source),s.order);}catch(e){err=e.message;sections=parseSongText(s.source);}$('#order-help').innerHTML=err?'<span class="errors">'+esc(err)+'</span>':sections.length?'<span class="success">'+sections.map(s=>esc(s.name)+' ('+s.pages.length+')').join(' → ')+'</span>':'Add a section and lyrics to start.';
const chordline=line=>'<div class="lyricline">'+chordSegments(line).map(part=>'<span class="chordpiece"><span class="chord">'+esc(part.chord||' ')+'</span><span>'+esc(part.text||' ')+'</span></span>').join('')+'</div>';
const projectorline=line=>'<div class="lyricline">'+esc(chordSegments(line).map(x=>x.text).join(''))+'</div>';
const slides=sections.flatMap(sec=>sec.pages.map((page,i)=>({sec,page,i,notes:sec.notes||[]})));
if(display==='stage'){p.innerHTML='<h3>'+esc(s.title||'Untitled')+' · '+esc(s.key||'—')+'</h3>'+(err?'<p class="errors">'+esc(err)+'</p>':'')+sections.map(sec=>'<div class="previewcard"><h3>'+esc(sec.name)+'</h3>'+(sec.notes||[]).map(n=>'<div class="note"># '+esc(n)+'</div>').join('')+sec.pages.map((page,i)=>'<div class="slide">'+page.map(chordline).join('')+'</div>').join('')+'</div>').join('')||'<p class="muted">Start typing lyrics to see the preview.</p>';}
else{previewSlide=Math.min(Math.max(0,previewSlide),Math.max(0,slides.length-1));let slide=slides[previewSlide];p.innerHTML='<div class="row space"><span class="muted">'+(slide?esc(slide.sec.name)+' · Slide '+(previewSlide+1)+' of '+slides.length:'No slides')+'</span><div class="row">'+button('prev-slide','←')+button('next-slide','→')+'</div></div><div class="projector-preview-frame"><div id="projector-preview-lines">'+(slide?slide.page.map(projectorline).join(''):'<span class="muted">Add lyrics to begin.</span>')+'</div></div><p id="preview-overflow" class="errors" hidden>This slide may exceed a projector screen. Add a --- slide break or reduce projector text size.</p><div class="info">Projector hides chords and stage notes. 16:9 preview at the default text size. Use the arrows to inspect each slide.</div>';requestAnimationFrame(checkPreviewFit);}
}
function checkPreviewFit(){const frame=$('.projector-preview-frame'),lines=$('#projector-preview-lines'),warning=$('#preview-overflow');if(!frame||!lines||!warning||!frame.clientWidth)return;const padding=getComputedStyle(frame);warning.hidden=lines.scrollHeight<=frame.clientHeight-parseFloat(padding.paddingTop)-parseFloat(padding.paddingBottom)+2&&lines.scrollWidth<=frame.clientWidth-parseFloat(padding.paddingLeft)-parseFloat(padding.paddingRight)+2;}
window.addEventListener('resize',checkPreviewFit);
function newSong(){const s={id:uid(),title:'New Song',key:'',bpm:0,order:'',source:'[Verse 1]\n'};addWorking(s);selected=s.id;mobilePane='editor';modified=true;persist();render();$('#title')?.focus();}
async function pickMaster(){
 const targetSet=state.sets.find(set=>set.id===setId);
 if(!state.sets.some(x=>x.id===setId))throw Error('Create a set first.');
 const candidates=masterEntries();if(!candidates.length){notify('Master library is empty.');return;}
 const selection=dialog('Add from master','<label>Search songs<input id="master-picker-search" type="search" autocomplete="off"></label><div class="picker-results" id="master-picker-results"></div>',[{value:'cancel',label:'Cancel'}]);
 const results=$('#master-picker-results'),search=$('#master-picker-search');
 const draw=()=>{const query=search.value.trim().toLowerCase();results.innerHTML=candidates.filter(s=>s.title.toLowerCase().includes(query)).map(s=>'<button data-dialog-value="'+esc(s.id)+'">'+esc(s.title)+'<small>'+esc(s.remote?'Linked source':s.key||'Local song')+'</small></button>').join('')||'<p>No matching songs.</p>';};
 search.addEventListener('input',draw);draw();
 const id=await selection;if(!id||id==='cancel')return;
 const hydrated=await hydrateExternal(id);const copy=structuredClone(hydrated);copy.id=uid();
 if(!state.sets.includes(targetSet))throw Error('That set no longer exists.');if(targetSet.songs.length>=LIMITS.setSongs)throw Error('Maximum 120 songs per set.');targetSet.songs.push(copy);mode='sets';setId=targetSet.id;selected=copy.id;mobilePane='editor';modified=true;persist();render();notify('Added an independent copy to this set.');
}
async function applyImport(data,filename){
 if(importMode==='text'){const song=normalize({id:uid(),title:filename.replace(/\.[^.]+$/,'')||'Imported song',source:String(data)});addWorking(song);selected=song.id;mobilePane='editor';return 'Imported text as a song.';}
 if(data?.format==='lyrics-live-studio-backup'){
  if(data.version!==1)throw Error('Unsupported Studio backup version.');
  const restored=validateStudioState(data.state);
  if(!confirm('Replace all Studio work with this backup?'))return null;
  state=restored;recoveryRaw='';mode='master';selected=state.songs[0]?.id||'';setId=state.sets[0]?.id||'';return 'Restored Studio backup.';
 }
 if(data?.format==='lyrics-live-set'||(data&&Array.isArray(data.library)&&Array.isArray(data.sets))){
  if(state.sets.length>=LIMITS.sets)throw Error('Maximum 50 sets.');
  const newSet=data.format==='lyrics-live-set'?validateSet(data):backupToSet(data);
  state.sets.push(newSet);mode='sets';setId=newSet.id;selected=newSet.songs[0]?.id||'';mobilePane='editor';return 'Imported local set. Review it before going live.';
 }
 if(data?.version===1&&Array.isArray(data.songs)){
  if(data.songs.length>LIMITS.songs)throw Error('Maximum 1000 master songs.');
  const entries=data.songs.filter(s=>!s?.sourceOnly).map(s=>normalize(s));
  const references=sourceReferences(data.songs.filter(s=>s?.sourceOnly));
  if(new Set([...entries,...references].map(s=>s.id)).size!==entries.length+references.length)throw Error('Duplicate song IDs.');
  const choice=await dialog('Import master library','<p>'+entries.length+' prepared songs and '+references.length+' source references.</p>',[{value:'merge',label:'Merge',primary:true},{value:'replace',label:'Replace working master'},{value:'cancel',label:'Cancel'}]);
  if(!choice||choice==='cancel')return null;
  const songs=choice==='replace'?entries:[...new Map([...state.songs,...entries].map(song=>[song.id,song])).values()];
  const refs=choice==='replace'?references:[...new Map([...(state.references||[]),...references].map(song=>[song.id,song])).values()];
  if(new Set([...songs,...refs].map(song=>song.id)).size>LIMITS.songs)throw Error('Maximum 1000 master songs.');
  state.songs=songs;state.references=refs;mode='master';selected=entries[0]?.id||songs[0]?.id||'';return 'Imported master library into this browser.';
 }
 throw Error('Unsupported JSON. Choose a master library, Studio backup, Sync Lyrics backup or exported set.');
}
document.addEventListener('input',e=>{
 if(e.target.id==='library-filter'){
  libraryFilter=e.target.value;
  for(const btn of document.querySelectorAll('.songitem'))btn.hidden=!btn.textContent.toLowerCase().includes(libraryFilter.toLowerCase());
  return;
 }
 const ids=['title','key','bpm','order','source'];if(!ids.includes(e.target.id))return;const s=current();if(!s)return;s[e.target.id]=e.target.id==='bpm'?Math.max(0,Math.min(300,Math.floor(Number(e.target.value)||0))):e.target.value;modified=true;persist();updatePreview();if(e.target.id==='title'){const b=document.querySelector('.songitem.selected strong');if(b)b.textContent=s.title;}});
document.addEventListener('change',e=>{if(e.target.dataset.songPosition){const entries=workingList(),from=entries.findIndex(s=>s.id===e.target.dataset.songPosition),to=Number(e.target.value)-1;if(from>=0&&Number.isInteger(to)&&to>=0&&to<entries.length){entries.splice(to,0,entries.splice(from,1)[0]);modified=true;persist();render();}else{notify('Enter a position from 1 to '+entries.length);e.target.value=from+1;}return;}if(e.target.id==='set-picker'){setId=e.target.value;selected=list()[0]?.id||'';render();}});
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;try{
if(a.startsWith('pane-')){mobilePane=a.slice(5);document.querySelector('.shell').dataset.mobilePane=mobilePane;document.querySelectorAll('.mobile-panes button').forEach(b=>{const active=b.dataset.action===a;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});updatePreview();return;}
if(a==='recovery'){download('sync-lyrics-recovery.json',recoveryRaw,LIMITS.backup);return;}
if(a==='reset-recovery'){if(!confirm('Reset stored Studio work? Download the recovery file first.'))return;recoveryRaw='';persist();render();return;}
if(a==='master'||a==='sets'){mode=a==='master'?'master':'sets';libraryFilter='';if(mode==='sets'&&!setId)setId=state.sets[0]?.id||'';selected=(mode==='master'?state.songs[0]?.id:list()[0]?.id)||'';render();return;}
if(a==='move-up'||a==='move-down'){const entries=list(),index=entries.findIndex(x=>x.id===el.dataset.id),next=index+(a==='move-up'?-1:1);if(index>=0&&next>=0&&next<entries.length){[entries[index],entries[next]]=[entries[next],entries[index]];modified=true;persist();render();}return;}
if(a==='load-selected-source'){await hydrateExternal(selected);render();return;}
if(a==='choose'){selected=el.dataset.id;previewSlide=0;
 const target=current();mobilePane='editor';render();if(target?.remote){notify('Loading original song from source…');await hydrateExternal(target.id);render();}return;}
if(a==='preview-stage'||a==='preview-projector'){display=a==='preview-stage'?'stage':'projector';previewSlide=0;render();return;}
if(a==='prev-slide'||a==='next-slide'){previewSlide=Math.max(0,previewSlide+(a==='next-slide'?1:-1));updatePreview();return;}
if(a==='open-onsong'){await onsongBrowser.open();return;}
if(a==='new-song'){libraryFilter='';newSong();return;}
if(a==='new-set'){const name=prompt('Name your new set','Sunday Worship');if(!name)return;if(state.sets.length>=LIMITS.sets)throw Error('Maximum 50 sets.');const s={id:uid(),name:name.trim().slice(0,80),songs:[]};state.sets.push(s);setId=s.id;selected='';modified=true;persist();render();return;}
if(a==='rename-set'){const s=state.sets.find(x=>x.id===setId);if(!s)return;const name=prompt('Set name',s.name);if(name?.trim()){s.name=name.trim().slice(0,80);modified=true;persist();render();}return;}
if(a==='delete-set'){if(!confirm('Delete this local set? This does not affect the master library.'))return;state.sets=state.sets.filter(s=>s.id!==setId);setId=state.sets[0]?.id||'';selected=list()[0]?.id||'';modified=true;persist();render();return;}
if(a==='add-from-master'){await pickMaster();return;}
if(a==='duplicate'){const s=structuredClone(current());s.id=uid();s.title+=' (copy)';addWorking(s);selected=s.id;modified=true;persist();render();return;}
if(a==='delete-song'){if(!confirm('Delete this song from '+(mode==='master'?'the working master library':'this set')+'?'))return;const l=workingList(),i=l.findIndex(x=>x.id===selected);if(i>=0)l.splice(i,1);selected=l[0]?.id||'';modified=true;persist();render();return;}
if(a==='copy-to-master'){const s=structuredClone(current());if(!s)return;if(state.songs.length>=LIMITS.songs)throw Error('Maximum 1000 master songs.');s.id=uid();state.songs.push(s);modified=true;persist();notify('Copied to working master. Export master JSON to publish.');return;}
if(a.startsWith('insert-')){const t=$('#source');if(!t)return;const snippets={'insert-verse':'\n[Verse 2]\n','insert-chorus':'\n[Chorus]\n','insert-bridge':'\n[Bridge]\n','insert-slide':'\n---\n','insert-note':'\n# Stage note\n','insert-chord':'[G]'};const snippet=snippets[a];const start=t.selectionStart,end=t.selectionEnd;t.setRangeText(snippet,start,end,'end');t.focus();t.dispatchEvent(new Event('input',{bubbles:true}));return;}
if(a==='export'){
 const payload=mode==='master'?masterJSON():setJSON();
 const title=mode==='master'?'Export master library':'Export local set';
 const message=mode==='master'?state.songs.length+' prepared songs · '+payload.songs.filter(s=>s.sourceOnly).length+' published source references. Other linked catalogue titles are excluded. Downloading does not update GitHub.':payload.songs.length+' songs. Import this file from the live app’s Setlist tab.';
 encodeDownload(payload,LIMITS.file);
 const choice=await dialog(title,'<p>'+esc(message)+'</p>',[{value:'download',label:'Download JSON',primary:true},{value:'cancel',label:'Cancel'}]);
 if(choice!=='download')return;
 download(mode==='master'?'library.json':(state.sets.find(x=>x.id===setId)?.name||'worship-set').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json',payload);notify('JSON downloaded. Your working copy remains in this browser.');return;
}
if(a==='backup'){download('sync-lyrics-studio-backup.json',{format:'lyrics-live-studio-backup',version:1,state},LIMITS.backup);notify('Full Studio backup downloaded.');return;}
if(a==='import'){
 const choice=await dialog('Import','<p>Choose a JSON library, set or backup, or import one song as plain text.</p>',[{value:'json',label:'JSON file',primary:true},{value:'text',label:'Lyrics text'},{value:'cancel',label:'Cancel'}]);
 if(!choice||choice==='cancel')return;
 importMode=choice==='text'?'text':'master';$('#import-file').accept=importMode==='text'?'.txt,.cho,.pro,text/plain':'.json,application/json';$('#import-file').click();return;
}
if(a==='refresh-master'){if(!confirm('Fetch the published GitHub master library? Unexported master edits could be overwritten where IDs match.'))return;const res=await fetch('../songs/library.json?time='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Cannot load published library');const m=await res.json();const old=importMode;importMode='master';const message=await applyImport(m,'library.json');importMode=old;if(message){modified=true;persist();render();notify(message);}return;return;}
}catch(err){notify(err.message||'Something went wrong.');}});
$('#import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>LIMITS.backup)throw Error('File is too large (8 MB maximum).');const raw=await file.text();const data=importMode==='text'?raw:JSON.parse(raw);const backup=data?.format==='lyrics-live-studio-backup'||Array.isArray(data?.library);if(!backup&&file.size>LIMITS.file)throw Error('Library and set files must be under 2 MB.');const result=await applyImport(data,file.name);if(!result)return;modified=true;persist();render();notify(storageFailed?'Imported in memory only. Download a backup before leaving.':result);}catch(err){notify(err.message||'Import failed.');}});
async function init(){
 onsongBrowser=setupOnSongBrowser({isImported:id=>state.songs.some(s=>s.id===id),addSongs:items=>{
  let added=0,skipped=0;for(const raw of items){try{const item=normalize(raw);if(state.songs.some(s=>s.id===item.id)||state.songs.length>=LIMITS.songs){skipped++;continue;}state.songs.push(item);added++;}catch(error){skipped++;}}
  if(added){modified=true;persist();mode='master';render();}return {added,skipped};
 },notify});
 let saved=false;try{saved=safeLoad();}catch(error){storageFailed=true;savingState='Browser storage unavailable';}
 setId=state.sets[0]?.id||'';selected=state.songs[0]?.id||'';render();
 const catalogueTask=loadCatalog().then(()=>render());
 if(!storageFailed){
  try{const response=await fetch('../songs/library.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Could not fetch published songs.');const manifest=await response.json();state=mergePublishedDefaults(state,manifest);selected=selected||state.songs[0]?.id||'';persist();}
  catch(error){notify('Published songs unavailable. You can create or import songs, or retry Fetch published songs.');}
 }
 await catalogueTask;render();
}
init().catch(error=>{document.querySelector('#app').textContent='Studio could not start. Reload the page or try another browser.';notify(error.message);});
