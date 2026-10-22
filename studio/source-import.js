import {convertOnSong,onsongId,onSongRawUrl} from './onsong.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupOnSongBrowser({isImported,addSongs,notify}){
  let catalogue=null,selected=new Set(),query='',busy=false,stop=false,message='',failures=[];
  const mount=document.createElement('div');mount.id='onsong-browser';document.body.appendChild(mount);
  const title=file=>file.path.replace(/\.onsong$/i,'');
  const filtered=()=>catalogue?.files.filter(f=>title(f).toLowerCase().includes(query.toLowerCase()))||[];
  const available=()=>catalogue?.files.filter(f=>!isImported(onsongId(f.path)))||[];
  function resultList(){
    return filtered().map(f=>{const id=onsongId(f.path),loaded=isImported(id);
      return '<label class="onsong-entry"><input type="checkbox" data-onsong-check="'+esc(f.path)+'" '+(selected.has(f.path)?'checked':'')+' '+(loaded?'disabled':'')+'><span>'+esc(title(f))+'</span>'+(loaded?'<small>Imported</small>':'')+'</label>';
    }).join('')||'<p class="muted">No matching songs.</p>';
  }
  function updateCounters(){
    const badge=mount.querySelector('#onsong-count');
    if(badge)badge.textContent=(catalogue?.count||0)+' available · '+selected.size+' selected · '+(catalogue?.count-available().length||0)+' imported';
    const status=mount.querySelector('#onsong-status');
    if(status)status.textContent=message;
  }
  function redraw(){
    if(!catalogue){mount.innerHTML='<div class="onsong-overlay"><div class="onsong-dialog" role="dialog" aria-modal="true"><h2>Loading song catalogue…</h2><p class="muted">Reading song metadata only.</p></div></div>';return;}
    mount.innerHTML='<div class="onsong-overlay"><section class="onsong-dialog" role="dialog" aria-modal="true" aria-label="Import OnSong collection">'+
      '<div class="row space"><div><h2>Import OnSong collection</h2><p class="muted">Matt Graham worship songbook · Client-side import into your local master library</p></div><button data-onsong-action="close" '+(busy?'disabled':'')+'>Close</button></div>'+
      '<p class="info">These songs may be copyrighted. Their upstream repository provides no explicit redistribution licence. Import and display only songs you have rights to use. Lyrics Live does not publish upstream lyrics automatically.</p>'+
      '<input id="onsong-query" type="search" placeholder="Search 677 song titles…" value="'+esc(query)+'" aria-label="Search song catalogue" '+(busy?'disabled':'')+'>'+
      '<div class="row" style="margin:9px 0">'+
        '<button data-onsong-action="select-filtered" '+(busy?'disabled':'')+'>Select matching</button>'+
        '<button data-onsong-action="clear" '+(busy?'disabled':'')+'>Clear selection</button>'+
        '<button data-onsong-action="import-selected" class="primary" '+(busy?'disabled':'')+'>Import selected</button>'+
        '<button data-onsong-action="import-all" '+(busy?'disabled':'')+'>Import all missing</button>'+
        (busy?'<button class="danger" data-onsong-action="stop">Stop after current batch</button>':'')+
      '</div><p class="muted" id="onsong-count"></p>'+
      '<div class="onsong-items" id="onsong-items">'+resultList()+'</div>'+
      '<p class="muted" id="onsong-status" aria-live="polite"></p>'+
      (failures.length?'<details><summary>Skipped files ('+failures.length+')</summary><p class="errors">'+esc(failures.slice(0,12).join('; '))+'</p></details>':'')+
    '</section></div>';
    updateCounters();
  }
  async function open(){
    mount.hidden=false;mount.innerHTML='<div class="onsong-overlay"><div class="onsong-dialog"><h2>Loading catalogue…</h2></div></div>';
    try{
      if(!catalogue){
        const response=await fetch(new URL('./onsong-catalog.json',import.meta.url),{cache:'no-store'});
        if(!response.ok)throw Error('Catalogue failed to load.');
        const parsed=await response.json();
        if(parsed.version!==1||!Array.isArray(parsed.files)||parsed.files.length!==parsed.count||!/^[a-f0-9]{40}$/.test(parsed.commit))throw Error('Unsupported catalogue.');
        catalogue=parsed;
      }
      redraw();
    }catch(e){mount.innerHTML='<div class="onsong-overlay"><div class="onsong-dialog"><h2>Could not open source catalogue</h2><p>'+esc(e.message)+'</p><button data-onsong-action="close">Close</button></div></div>';}
  }
  async function importFiles(files){
    if(!files.length){notify('No new songs selected.');return;}
    if(!confirm('Import '+files.length+' OnSong files into your local master library? Existing songs are preserved; imports remain in this browser until you export.'))return;
    busy=true;stop=false;failures=[];let added=0,skipped=0,finished=0;
    redraw();
    try{
      for(let start=0;start<files.length&&!stop;start+=8){
        const batch=files.slice(start,start+8);
        const loaded=await Promise.all(batch.map(async file=>{
          try{
            const res=await fetch(onSongRawUrl(catalogue.commit,file.path));
            if(!res.ok)throw Error('HTTP '+res.status);
            const body=await res.text();
            if(body.length>300000)throw Error('File too large');
            return {song:convertOnSong(body,file.path)};
          }catch(e){return {error:file.path+': '+e.message};}
        }));
        const successful=loaded.filter(x=>x.song).map(x=>x.song);
        if(successful.length){const n=addSongs(successful);added+=n.added;skipped+=n.skipped;}
        failures.push(...loaded.filter(x=>x.error).map(x=>x.error));
        finished+=batch.length;
        message='Processed '+finished+' / '+files.length+' · '+added+' added · '+failures.length+' failed';
        updateCounters();
      }
    }finally{
      busy=false;selected.clear();
      message='Finished: '+added+' added'+(skipped?' · '+skipped+' already present':'')+(failures.length?' · '+failures.length+' could not convert':'')+(stop?' · stopped early':'')+'.';
      redraw();
      notify(message);
    }
  }
  mount.addEventListener('input',e=>{
    if(e.target.id==='onsong-query'){query=e.target.value;mount.querySelector('#onsong-items').innerHTML=resultList();updateCounters();}
    const path=e.target.dataset.onsongCheck;
    if(path){if(e.target.checked)selected.add(path);else selected.delete(path);updateCounters();}
  });
  mount.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-onsong-action]');if(!btn)return;
    const action=btn.dataset.onsongAction;
    if(action==='stop'){stop=true;message='Stopping after the current batch…';updateCounters();return;}
    if(busy)return;
    if(action==='close'){mount.hidden=true;mount.innerHTML='';return;}
    if(action==='select-filtered'){for(const file of filtered())if(!isImported(onsongId(file.path)))selected.add(file.path);redraw();return;}
    if(action==='clear'){selected.clear();redraw();return;}
    if(action==='import-selected')await importFiles(catalogue.files.filter(f=>selected.has(f.path)&&!isImported(onsongId(f.path))));
    if(action==='import-all')await importFiles(available());
  });
  mount.hidden=true;
  return {open};
}