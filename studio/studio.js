import {parseSongText,arrangeSections,validSong,chordSegments,validateImport} from '../src/model.js?v=beta9';
import {setupOnSongBrowser} from './source-import.js';
import {onsongId,convertOnSong,onSongRawUrl} from './onsong.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const LS='lyrics-live-studio-v1';
let onsongBrowser;
let catalogIndex=[],catalogCommit='',catalogStatus='Loading external song index…';
let libraryFilter='';
const empty=()=>({version:1,songs:[],sets:[]});
let state=empty(),mode='master',selected='',setId='',display='stage',importMode='master',editing=false,modified=false,previewSlide=0;
let msgTimer;
function notify(t){$('#toast').textContent=t;clearTimeout(msgTimer);msgTimer=setTimeout(()=>$('#toast').textContent='',4600);}
function normalize(entry){return {id:String(entry.id||uid()),title:String(entry.title||''),key:String(entry.key||''),bpm:Number(entry.bpm)||0,order:String(entry.order||''),source:typeof entry.source==='string'?entry.source:(Array.isArray(entry.lyrics)?entry.lyrics.join('\n'):''),artist:String(entry.artist||''),ccli:String(entry.ccli||''),origin:String(entry.origin||''),originPath:String(entry.originPath||'')};}
function safeLoad(){try{const saved=JSON.parse(localStorage.getItem(LS)||'null');if(saved&&Array.isArray(saved.songs)&&Array.isArray(saved.sets)){state={version:1,songs:saved.songs.map(normalize),sets:saved.sets.map(s=>({id:s.id||uid(),name:s.name||'Untitled Set',songs:(s.songs||[]).map(normalize)}))};modified=!!saved.modified;return true;}}catch(e){console.warn(e)}return false;}
function persist(){localStorage.setItem(LS,JSON.stringify({...state,modified}));}
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
 const response=await fetch(onSongRawUrl(catalogCommit,entry.originPath));
 if(!response.ok)throw Error('Could not download song ('+response.status+'). Check your connection.');
 const text=await response.text();
 if(text.length>300000)throw Error('Song source exceeds safe size.');
 const song=normalize(convertOnSong(text,entry.originPath));
 validSong(song);
 const concurrent=state.songs.find(s=>s.id===id);
 if(concurrent)return concurrent;
 state.songs.push(song);
 persist(); // local working copy only — no public GitHub write
 return song;
}
async function loadCatalog(){
 try{
  const response=await fetch('./onsong-catalog.json?v=2',{cache:'no-store'});
  if(!response.ok)throw Error('Could not load OnSong index.');
  const parsed=await response.json();
  if(parsed.version!==1||!Array.isArray(parsed.files)||parsed.files.length!==parsed.count||!/^[a-f0-9]{40}$/.test(parsed.commit))throw Error('Invalid OnSong index.');
  catalogCommit=parsed.commit;
  catalogIndex=parsed.files.map(f=>({id:onsongId(f.path),title:f.path.replace(/\.onsong$/i,''),key:'',bpm:0,order:'',source:'',artist:'',origin:'mattgraham/worship',originPath:f.path,remote:true}));
  catalogStatus=parsed.count+' linked OnSong titles';
 }catch(e){catalogStatus='Source index unavailable · '+e.message;console.warn(e);}
}

function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function masterJSON(){return {version:1,songs:state.songs.map(s=>({id:s.id,title:s.title,key:s.key,bpm:s.bpm,order:s.order||'',artist:s.artist||'',ccli:s.ccli||'',origin:s.origin||'',originPath:s.originPath||'',lyrics:s.source.split('\n')}))};}
function setJSON(){const set=state.sets.find(s=>s.id===setId);if(!set)throw Error('Select a set first');return {format:'lyrics-live-set',version:1,name:set.name,songs:set.songs.map(s=>({id:s.id,title:s.title,key:s.key,bpm:s.bpm,order:s.order,source:s.source}))};}
function button(action,title,extra=''){return '<button data-action="'+action+'" '+extra+'>'+title+'</button>';}
function render(){const song=current(),sets=state.sets,activeSet=sets.find(s=>s.id===setId);$('#app').innerHTML='<div class="shell"><header class="topbar"><div class="brand">Lyrics Live <b>Studio</b><small>not jack. · Prepare without a live session</small></div><div class="top-actions">'+button('import','Import JSON / Text')+button('backup','Backup all')+button('export',mode==='master'?'Export master JSON':'Export set JSON','class="primary"')+'</div></header><nav class="tabs">'+button('master','Master Library',mode==='master'?'class="active"':'')+button('sets','Local Sets',mode==='sets'?'class="active"':'')+'<span class="muted" style="margin-left:auto;align-self:center;font-size:12px">'+(modified?'Local changes · not exported':'Saved in this browser')+'</span></nav><main class="workspace"><aside class="panel"><div class="panel-head"><h2>'+(mode==='master'?'Master songs':'Set songs')+'</h2><span class="muted">'+list().length+'</span></div>'+(mode==='sets'?'<div class="set-tools"><select id="set-picker" aria-label="Choose set">'+sets.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===setId?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select><div class="row">'+button('new-set','+ New set')+button('rename-set','Rename',activeSet?'':'disabled')+button('delete-set','Delete',activeSet?'':'disabled')+'</div>'+button('add-from-master','+ Add from master',activeSet?'':'disabled')+'</div>':'')+'<div class="side-actions">'+button('new-song','+ New song',mode==='sets'&&!activeSet?'disabled':'')+(mode==='master'?button('refresh-master','Fetch published songs')+button('open-onsong','Bulk import OnSong'):'')+'</div><div class="set-tools"><input id="library-filter" type="search" placeholder="Search '+(mode==='master'?'master library':'set songs')+'…" aria-label="Search songs" value="'+esc(libraryFilter)+'"></div><div class="info" style="margin:0 12px 8px">'+(mode==='master'?esc(catalogStatus)+'. Select a linked title to load lyrics and chords privately into this browser.':'Independent copies in this set; changes do not affect your master.')+'</div><div class="songlist">'+(list().length?list().map(s=>'<button class="songitem '+(s.id===selected?'selected':'')+'" data-action="choose" data-id="'+esc(s.id)+'" '+(!s.title.toLowerCase().includes(libraryFilter.toLowerCase())?'hidden':'')+'><span><strong>'+esc(s.title||'Untitled song')+'</strong><small>Key '+esc(s.key||'—')+' · '+(s.remote?'Linked source · load on selection':(s.source.match(/^\[[^\]]+\]/gm)||[]).length+' sections')+'</small></span>'+(mode==='sets'?'<span class="row"><span data-action="move-up" data-id="'+esc(s.id)+'" title="Move up">↑</span><span data-action="move-down" data-id="'+esc(s.id)+'" title="Move down">↓</span></span>':'<span>›</span>')+'</button>').join(''):'<div class="empty">No songs yet. Create one or import a library.</div>')+'</div></aside><section class="panel"><div class="panel-head"><h2>Song Editor</h2><div class="row">'+(song?button('duplicate','Duplicate')+button('delete-song','Delete','class="danger"'):'')+'</div></div>'+(song?.remote?'<div class="empty"><h3>'+esc(song.title)+'</h3><p>Linked song title from the external OnSong catalogue. Lyrics are not stored on this website.</p>'+button('load-selected-source','Load lyrics and chords','class="primary"')+'</div>':song?'<div class="editor"><div class="mainfields"><label>Title<input id="title" maxlength="100" value="'+esc(song.title)+'"></label><label>Key<input id="key" maxlength="16" value="'+esc(song.key)+'"></label><label>BPM<input id="bpm" type="number" min="0" max="300" value="'+esc(song.bpm||'')+'"></label></div><label>Section order<input id="order" value="'+esc(song.order)+'" placeholder="V1, C, V2, C, B, C"></label><div class="info" id="order-help">Write sections once; repeat with order, e.g. V1, C, V2, C</div><div class="row space"><strong>Lyrics + chords</strong><span class="muted">Auto-saved</span></div><div class="toolbar">'+button('insert-verse','Verse')+button('insert-chorus','Chorus')+button('insert-bridge','Bridge')+button('insert-slide','Slide break')+button('insert-note','Stage note')+button('insert-chord','Chord')+'</div><textarea id="source" spellcheck="false" aria-label="Lyrics and chords">'+esc(song.source)+'</textarea><details><summary>Formatting guide</summary><p>[Verse 1] starts a section; --- creates a slide; [G] creates a chord; # creates a stage note. Define a section once, then use Section order to repeat it.</p></details><div class="row">'+button('copy-to-master','Save copy to master',mode==='sets'?'':'hidden')+'<span class="muted">Edits stay in this browser until exported.</span></div></div>':'<div class="empty">Select or create a song to start editing.</div>')+'</section><section class="panel preview-panel"><div class="panel-head"><h2>Live Preview</h2><div class="previewtabs">'+button('preview-stage','Stage',display==='stage'?'class="active"':'')+button('preview-projector','Projector',display==='projector'?'class="active"':'')+'</div></div><div class="preview" id="preview"></div></section></main><footer class="bottom">No GitHub sign-in or database required. Export <b>songs/library.json</b> to publish the master library manually. Local sets export separately for Lyrics Live. <a href="../">Back to Lyrics Live</a></footer></div>';updatePreview();}
function updatePreview(){const p=$('#preview'),s=current();if(!p)return;if(s?.remote){p.innerHTML='<div class="empty">Select this title to load its Stage and Projector preview.</div>';return;}if(!s){p.innerHTML='<div class="empty">Your lyrics preview will appear here.</div>';return;}let sections=[],err='';try{sections=arrangeSections(parseSongText(s.source),s.order);}catch(e){err=e.message;sections=parseSongText(s.source);}$('#order-help').innerHTML=err?'<span class="errors">'+esc(err)+'</span>':sections.length?'<span class="success">'+sections.map(s=>esc(s.name)+' ('+s.pages.length+')').join(' → ')+'</span>':'Add a section and lyrics to start.';
const chordline=line=>'<div class="lyricline">'+chordSegments(line).map(part=>'<span class="chordpiece"><span class="chord">'+esc(part.chord||' ')+'</span><span>'+esc(part.text||' ')+'</span></span>').join('')+'</div>';
const projectorline=line=>'<div class="lyricline">'+esc(chordSegments(line).map(x=>x.text).join(''))+'</div>';
const slides=sections.flatMap(sec=>sec.pages.map((page,i)=>({sec,page,i,notes:sec.notes||[]})));
if(display==='stage'){p.innerHTML='<h3>'+esc(s.title||'Untitled')+' · '+esc(s.key||'—')+'</h3>'+(err?'<p class="errors">'+esc(err)+'</p>':'')+sections.map(sec=>'<div class="previewcard"><h3>'+esc(sec.name)+'</h3>'+(sec.notes||[]).map(n=>'<div class="note"># '+esc(n)+'</div>').join('')+sec.pages.map((page,i)=>'<div class="slide">'+page.map(chordline).join('')+'</div>').join('')+'</div>').join('')||'<p class="muted">Start typing lyrics to see the preview.</p>';}
else{previewSlide=Math.min(Math.max(0,previewSlide),Math.max(0,slides.length-1));let slide=slides[previewSlide];p.innerHTML='<div class="row space"><span class="muted">'+(slide?esc(slide.sec.name)+' · Slide '+(previewSlide+1)+' of '+slides.length:'No slides')+'</span><div class="row">'+button('prev-slide','←')+button('next-slide','→')+'</div></div><div class="previewcard projector">'+(slide?slide.page.map(projectorline).join(''):'<span class="muted">Add lyrics to begin.</span>')+'</div><div class="info">Projector hides chords and stage notes. Use the arrows to inspect each slide.</div>';}
}
function newSong(){const s={id:uid(),title:'New Song',key:'',bpm:0,order:'',source:'[Verse 1]\n'};list().push(s);selected=s.id;modified=true;persist();render();$('#title')?.focus();}
async function pickMaster(){
 const candidates=masterEntries();
 if(!candidates.length){notify('Master library is empty.');return;}
 const query=prompt('Search master song title (partial title is fine):','');
 if(query===null||!query.trim())return;
 const results=candidates.filter(s=>s.title.toLowerCase().includes(query.trim().toLowerCase()));
 if(!results.length){notify('No matching master song.');return;}
 let match=results[0];
 if(results.length>1){
  const names=results.slice(0,15).map((s,i)=>(i+1)+'. '+s.title).join('\n');
  const choice=prompt(results.length+' matches. Enter a song number:\n'+names,'1');
  if(choice===null)return;
  const i=Number(choice)-1;
  if(!Number.isInteger(i)||i<0||i>=Math.min(results.length,15)){notify('Enter a number from the list.');return;}
  match=results[i];
 }
 const hydrated=await hydrateExternal(match.id).catch(err=>{notify(err.message);return null;});
 if(!hydrated)return;
 const copy=structuredClone(hydrated);
 copy.id=uid();
 const set=state.sets.find(x=>x.id===setId);
 if(!set)throw Error('Create a set first.');
 set.songs.push(copy);
 selected=copy.id;modified=true;persist();render();notify('Added an independent copy to this set.');
}
async function applyImport(data,filename){if(importMode==='text'){const s={id:uid(),title:filename.replace(/\.[^.]+$/,'')||'Imported song',key:'',bpm:0,order:'',source:String(data)};list().push(s);selected=s.id;return 'Imported text as a song.';}
if(data?.format==='lyrics-live-set'&&Array.isArray(data.songs)){const newSet={id:uid(),name:String(data.name||'Imported Set'),songs:data.songs.map(s=>({...normalize(s),id:uid()}))};state.sets.push(newSet);mode='sets';setId=newSet.id;selected=newSet.songs[0]?.id||'';return 'Imported local set.';}
if(data?.version===1&&Array.isArray(data.songs)){const entries=data.songs.map(normalize);for(const s of entries){validSong(s);}const replace=confirm('Import '+entries.length+' master songs?\nOK replaces the master working library.\nCancel merges by song ID, keeping other songs.');if(replace)state.songs=entries;else for(const song of entries){const i=state.songs.findIndex(x=>x.id===song.id);if(i>=0)state.songs[i]=song;else state.songs.push(song);}mode='master';selected=entries[0]?.id||'';return 'Imported '+entries.length+' master songs.';}
if(data&&Array.isArray(data.library)&&Array.isArray(data.sets)){const backup=validateImport(data);const newSet={id:uid(),name:backup.sessionName||'Imported set',songs:[]};const active=backup.sets.find(x=>x.id===backup.activeSetId)||backup.sets[0];newSet.songs=(active?.songs||[]).map(id=>backup.library.find(s=>s.id===id)).filter(Boolean).map(s=>({...normalize(s),id:uid()}));state.sets.push(newSet);mode='sets';setId=newSet.id;selected=newSet.songs[0]?.id||'';return 'Imported Lyrics Live backup as local set.';}
if(data?.format==='lyrics-live-studio-backup'&&data.state){if(!confirm('Replace all Studio work with this backup?'))return 'Import cancelled.';state=data.state;mode='master';selected=state.songs[0]?.id||'';setId=state.sets[0]?.id||'';return 'Restored Studio backup.';}
throw Error('Unsupported JSON. Choose a master library, Studio backup, Lyrics Live backup or exported set.');
}
document.addEventListener('input',e=>{
 if(e.target.id==='library-filter'){
  libraryFilter=e.target.value;
  for(const btn of document.querySelectorAll('.songitem'))btn.hidden=!btn.textContent.toLowerCase().includes(libraryFilter.toLowerCase());
  return;
 }
 const ids=['title','key','bpm','order','source'];if(!ids.includes(e.target.id))return;const s=current();if(!s)return;s[e.target.id]=e.target.id==='bpm'?(Number(e.target.value)||0):e.target.value;modified=true;persist();if(e.target.id==='source'||e.target.id==='order')updatePreview();else if(e.target.id==='title'){const b=document.querySelector('.songitem.selected strong');if(b)b.textContent=s.title;}});
document.addEventListener('change',e=>{if(e.target.id==='set-picker'){setId=e.target.value;selected=list()[0]?.id||'';render();}});
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;try{
if(a==='master'||a==='sets'){mode=a==='master'?'master':'sets';libraryFilter='';if(mode==='sets'&&!setId)setId=state.sets[0]?.id||'';selected=(mode==='master'?state.songs[0]?.id:list()[0]?.id)||'';render();return;}
if(a==='move-up'||a==='move-down'){const entries=list(),index=entries.findIndex(x=>x.id===el.dataset.id),next=index+(a==='move-up'?-1:1);if(index>=0&&next>=0&&next<entries.length){[entries[index],entries[next]]=[entries[next],entries[index]];modified=true;persist();render();}return;}
if(a==='load-selected-source'){await hydrateExternal(selected);render();return;}
if(a==='choose'){selected=el.dataset.id;previewSlide=0;
 const target=current();if(target?.remote){notify('Loading original song from source…');await hydrateExternal(target.id);}
 render();return;}
if(a==='preview-stage'||a==='preview-projector'){display=a==='preview-stage'?'stage':'projector';previewSlide=0;render();return;}
if(a==='prev-slide'||a==='next-slide'){previewSlide=Math.max(0,previewSlide+(a==='next-slide'?1:-1));updatePreview();return;}
if(a==='open-onsong'){await onsongBrowser.open();return;}
if(a==='new-song'){libraryFilter='';newSong();return;}
if(a==='new-set'){const name=prompt('Name your new set','Sunday Worship');if(!name)return;const s={id:uid(),name:name.trim(),songs:[]};state.sets.push(s);setId=s.id;selected='';modified=true;persist();render();return;}
if(a==='rename-set'){const s=state.sets.find(x=>x.id===setId);if(!s)return;const name=prompt('Set name',s.name);if(name?.trim()){s.name=name.trim();modified=true;persist();render();}return;}
if(a==='delete-set'){if(!confirm('Delete this local set? This does not affect the master library.'))return;state.sets=state.sets.filter(s=>s.id!==setId);setId=state.sets[0]?.id||'';selected=list()[0]?.id||'';modified=true;persist();render();return;}
if(a==='add-from-master'){await pickMaster();return;}
if(a==='duplicate'){const s=structuredClone(current());s.id=uid();s.title+=' (copy)';list().push(s);selected=s.id;modified=true;persist();render();return;}
if(a==='delete-song'){if(!confirm('Delete this song from '+(mode==='master'?'the working master library':'this set')+'?'))return;const l=list(),i=l.findIndex(x=>x.id===selected);if(i>=0)l.splice(i,1);selected=l[0]?.id||'';modified=true;persist();render();return;}
if(a==='copy-to-master'){const s=structuredClone(current());if(!s)return;s.id=uid();state.songs.push(s);modified=true;persist();notify('Copied to working master. Export master JSON to publish.');return;}
if(a.startsWith('insert-')){const t=$('#source');if(!t)return;const snippets={'insert-verse':'\n[Verse 2]\n','insert-chorus':'\n[Chorus]\n','insert-bridge':'\n[Bridge]\n','insert-slide':'\n---\n','insert-note':'\n# Stage note\n','insert-chord':'[G]'};const snippet=snippets[a];const start=t.selectionStart,end=t.selectionEnd;t.setRangeText(snippet,start,end,'end');t.focus();t.dispatchEvent(new Event('input',{bubbles:true}));return;}
if(a==='export'){if(mode==='master'){for(const s of state.songs)validSong(s);download('library.json',masterJSON());notify('Export includes downloaded and locally created songs, not linked source entries. Review rights before publicly sharing lyrics.');}else{for(const s of list())validSong(s);download((state.sets.find(x=>x.id===setId)?.name||'worship-set').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json',setJSON());}modified=false;persist();render();notify('JSON downloaded.');return;}
if(a==='backup'){download('lyrics-live-studio-backup.json',{format:'lyrics-live-studio-backup',version:1,state});notify('Full Studio backup downloaded.');return;}
if(a==='import'){const choice=prompt('Import type:\n1 = JSON library / set / backup\n2 = Plain lyrics text','1');if(choice===null)return;importMode=choice.trim()==='2'?'text':'master';$('#import-file').accept=importMode==='text'?'.txt,.cho,.pro,text/plain':'.json,application/json';$('#import-file').click();return;}
if(a==='refresh-master'){if(!confirm('Fetch the published GitHub master library? Unexported master edits could be overwritten where IDs match.'))return;const res=await fetch('../songs/library.json?time='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('Cannot load published library');const m=await res.json();const old=importMode;importMode='master';const message=await applyImport(m,'library.json');importMode=old;modified=true;persist();render();notify(message);return;}
}catch(err){notify(err.message||'Something went wrong.');}});
$('#import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2000000)throw Error('File is too large (2 MB maximum).');const raw=await file.text();const data=importMode==='text'?raw:JSON.parse(raw);const result=await applyImport(data,file.name);modified=true;persist();render();notify(result);}catch(err){notify(err.message||'Import failed.');}});
async function init(){onsongBrowser=setupOnSongBrowser({isImported:id=>state.songs.some(s=>s.id===id),addSongs:items=>{let added=0,skipped=0;for(const raw of items){try{const item=normalize(raw);validSong(item);if(state.songs.some(s=>s.id===item.id)||state.songs.length>=1000){skipped++;continue;}state.songs.push(item);added++;}catch(e){skipped++;console.warn('Skipped OnSong:',e);}}if(added){modified=true;persist();mode='master';render();}return {added,skipped};},notify});const saved=safeLoad();if(!saved){try{const response=await fetch('../songs/library.json',{cache:'no-store'});if(response.ok){const manifest=await response.json();if(manifest.version===1&&Array.isArray(manifest.songs))state.songs=manifest.songs.map(normalize);}}catch(e){console.warn('Published library unavailable',e);}persist();}setId=state.sets[0]?.id||'';selected=state.songs[0]?.id||'';await loadCatalog();render();}
init();