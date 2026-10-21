/* Lyrics Live song and session model. No network or DOM dependencies. */
export const STORAGE_KEY = 'lyrics-live-library-v1';
const LIMIT = 100000;
const uid = () => (globalThis.crypto?.randomUUID?.() || ('id-' + Math.random().toString(36).slice(2)));
const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);

export function parseSongText(source) {
  const sections = [];
  let current = null;
  let slide = [];
  function begin(name) {
    flush();
    current = { id: uid(), name: clean(name, 60) || 'Verse', pages: [] };
    sections.push(current);
  }
  function flush() {
    if (!current || !slide.length) return;
    current.pages.push(slide);
    slide = [];
  }
  for (const raw of String(source).replace(/\r\n?/g, '\n').slice(0, LIMIT).split('\n')) {
    const line = raw.trim();
    if (/^\{(?:title|subtitle|artist|key|tempo|time):/i.test(line)) continue;
    const chordOnly = /^\[([A-G](?:#|b)?(?:m|maj|dim|sus|add|aug|\d|\/|\+|\-|\(|\))*?)\]$/.test(line);
    const name = /^\[([^\]]+)\]$/.exec(line);
    if (name && !chordOnly) { begin(name[1]); continue; }
    const chordProStart = /^\{start_of_(verse|chorus|bridge)(?::([^}]+))?\}$/i.exec(line);
    if (chordProStart) { begin(chordProStart[2] || chordProStart[1]); continue; }
    if (/^\{end_of_/.test(line)) { flush(); continue; }
    if (line === '---' || line === '') { flush(); continue; }
    if (!current) begin('Verse 1');
    slide.push(line.slice(0, 300));
    if (slide.length >= 2) flush();
  }
  flush();
  return sections.filter(s => s.pages.length);
}

export function songToText(song) {
  return (song?.sections || []).map(s => `[${s.name}]\n${s.pages.map(p => p.join('\n')).join('\n---\n')}`).join('\n\n');
}

export function sampleState() {
  const library = [
    { id: 'morning', title: 'Morning Light', key: 'G', bpm: 76, source: `[Verse 1]\n[G]When the morning [D]finds us here\n[Em]Hope is rising, [C]clear and near\n---\n[G]Every moment, [D]every breath\n[C]Held in kindness, [G]held in grace\n\n[Chorus]\n[C]Lead us on into the [G]light\n[D]Hold us through the [Em]darkest night\n---\n[C]Every voice and every [G]song\n[D]Sing of hope that [G]carries on\n\n[Bridge]\n[Em]We will not be [C]overcome\n[G]There's a new day [D]yet to come` },
    { id: 'waters', title: 'Still Waters', key: 'D', bpm: 68, source: `[Verse 1]\n[D]By the quiet [A]waters stay\n[Bm]Guide my restless [G]heart today\n---\n[D]When the road is [A]hard to see\n[G]Walk the winding [D]path with me\n\n[Chorus]\n[G]Peace like a river, [D]steady and deep\n[A]Love that will hold me, [Bm]love that will keep` },
    { id: 'new', title: 'All Things New', key: 'C', bpm: 80, source: `[Verse 1]\n[C]Here at the [G]turning of the tide\n[Am]Hope is [F]awakening inside\n\n[Chorus]\n[F]You make [C]all things new\n[G]The morning [Am]breaks through` }
  ].map(s => ({ ...s, sections: parseSongText(s.source) }));
  return {
    rev: 1,
    sessionName: 'Sunday Worship',
    library,
    sets: [{ id: 'sunday', name: 'Sunday Worship', songs: ['morning', 'waters', 'new'] }],
    activeSetId: 'sunday',
    cursor: { song: 0, section: 1, page: 0 },
    blank: false
  };
}

export function activeSet(s) { return s?.sets.find(x => x.id === s.activeSetId) || s?.sets[0]; }
export function activeSong(s) { const set=activeSet(s); return s?.library.find(x=>x.id === set?.songs[s.cursor.song]) || null; }
export function activeSection(s) { return activeSong(s)?.sections[s.cursor.section] || null; }
export function atEnd(s) {
  const set=activeSet(s), song=activeSong(s), section=activeSection(s);
  return !set?.songs.length || (s.cursor.song === set.songs.length-1 && s.cursor.section === song?.sections.length-1 && s.cursor.page === section?.pages.length-1);
}
export function atStart(s) { return s.cursor.song===0 && s.cursor.section===0 && s.cursor.page===0; }

export function validSong(data) {
  const title=clean(data?.title, 100), key=clean(data?.key, 16), bpm=Number(data?.bpm)||0;
  const source=String(data?.source||'').slice(0,LIMIT);
  const sections=parseSongText(source);
  if(!title || !sections.length) throw new Error('Add a song title and at least one lyric line.');
  return { id:clean(data?.id,120)||uid(), title, key, bpm:Math.max(0,Math.min(300,Math.floor(bpm))), source, sections };
}

export function applyAction(state, action) {
  if(!state || !action || typeof action !== 'object') throw new Error('Invalid action.');
  const s = structuredClone(state);
  const set = () => activeSet(s);
  const song = () => activeSong(s);
  const clampCursor = () => {
    if (!set()?.songs.length) { s.cursor={song:0,section:0,page:0}; return; }
    s.cursor.song=Math.max(0,Math.min(s.cursor.song,set().songs.length-1));
    const current=song();
    s.cursor.section=Math.max(0,Math.min(s.cursor.section,Math.max(0,(current?.sections.length||1)-1)));
    const sec=current?.sections[s.cursor.section];
    s.cursor.page=Math.max(0,Math.min(s.cursor.page,Math.max(0,(sec?.pages.length||1)-1)));
  };
  const i = Number(action.index);
  switch(action.kind) {
    case 'step': {
      if (action.dir!==1 && action.dir!==-1) break;
      if(!song() || !activeSection(s)) break;
      if(action.dir===1) {
        if(s.cursor.page<activeSection(s).pages.length-1) s.cursor.page++;
        else if(s.cursor.section<song().sections.length-1) {s.cursor.section++;s.cursor.page=0;}
        else if(s.cursor.song<set().songs.length-1) {s.cursor.song++;s.cursor.section=0;s.cursor.page=0;}
      } else {
        if(s.cursor.page>0) s.cursor.page--;
        else if(s.cursor.section>0) {s.cursor.section--;s.cursor.page=song().sections[s.cursor.section].pages.length-1;}
        else if(s.cursor.song>0) {s.cursor.song--;s.cursor.section=song().sections.length-1;s.cursor.page=activeSection(s).pages.length-1;}
      }
      break;
    }
    case 'jump': {
      if(!Number.isInteger(i)||i<0||i>=set().songs.length) break;
      const selected=s.library.find(x=>x.id===set().songs[i]);
      if(!selected) break;
      s.cursor={ song:i, section:Number(action.section)||0, page:Number(action.page)||0 };
      clampCursor(); break;
    }
    case 'blank': s.blank=!!action.value; break;
    case 'save-song': {
      const edited=validSong(action.song);
      const idx=s.library.findIndex(x=>x.id===edited.id);
      if(idx>=0) s.library[idx]=edited;
      else if(s.library.length<300) s.library.push(edited);
      clampCursor(); break;
    }
    case 'delete-song': {
      const id=clean(action.id,120);
      if(!s.library.some(x=>x.id===id)) break;
      if(activeSong(s)?.id===id) throw new Error('Choose another live song before deleting this song.');
      const liveId=activeSong(s)?.id;
      s.library=s.library.filter(x=>x.id!==id);
      for(const st of s.sets) st.songs=st.songs.filter(x=>x!==id);
      if(liveId)s.cursor.song=Math.max(0,set().songs.indexOf(liveId));
      clampCursor(); break;
    }
    case 'add-to-set': {
      const id=clean(action.id,120);
      if(s.library.some(x=>x.id===id) && set()?.songs.length<120) set().songs.push(id);
      clampCursor(); break;
    }
    case 'remove-from-set': {
      if(Number.isInteger(i)&&i>=0&&i<set().songs.length) {
        if(i===s.cursor.song) throw new Error('Choose another live song before removing this song.');
        set().songs.splice(i,1);
        if(i<s.cursor.song)s.cursor.song--;
      }
      clampCursor(); break;
    }
    case 'move-in-set': {
      const j=i+(action.dir===1?1:-1);
      if(Number.isInteger(i)&&i>=0&&j>=0&&j<set().songs.length) {
        [set().songs[i],set().songs[j]]=[set().songs[j],set().songs[i]];
        if(s.cursor.song===i) s.cursor.song=j;
        else if(s.cursor.song===j) s.cursor.song=i;
      }
      break;
    }
    case 'create-set': {
      if(s.sets.length>=50) break;
      const name=clean(action.name,80);
      if(!name) throw new Error('Give the new set a name.');
      const fresh={id:uid(),name,songs:[]}; s.sets.push(fresh);break;
    }
    case 'rename-set': {
      const name=clean(action.name,80);
      if(!name) throw new Error('Give the set a name.');
      set().name=name;break;
    }
    case 'activate-set': {
      if(s.sets.some(x=>x.id===action.id)) {s.activeSetId=action.id;s.cursor={song:0,section:0,page:0};s.blank=false;}
      break;
    }
    case 'delete-set': {
      if(s.sets.length>1 && s.sets.some(x=>x.id===action.id)) {
        s.sets=s.sets.filter(x=>x.id!==action.id);
        if(s.activeSetId===action.id) {s.activeSetId=s.sets[0].id;s.cursor={song:0,section:0,page:0};}
      }
      break;
    }
    default: throw new Error('Unsupported action.');
  }
  s.rev=(Number(s.rev)||0)+1;
  return s;
}

export function validateImport(parsed) {
  if(!parsed || !Array.isArray(parsed.library) || !Array.isArray(parsed.sets) || parsed.library.length>300 || parsed.sets.length>50) throw new Error('Invalid Lyrics Live backup.');
  const lib=parsed.library.map(validSong);
  const ids=new Set(lib.map(x=>x.id));
  const sets=parsed.sets.map(x=>({id:clean(x.id,120)||uid(),name:clean(x.name,80)||'Set',songs:(Array.isArray(x.songs)?x.songs:[]).filter(id=>ids.has(id)).slice(0,120)}));
  if(!sets.length) sets.push({id:uid(),name:'New Set',songs:[]});
  return {rev:1,sessionName:clean(parsed.sessionName,80)||sets[0].name,library:lib,sets,activeSetId:sets[0].id,cursor:{song:0,section:0,page:0},blank:false};
}

export function chordSegments(input) {
  const segments=[];const re=/\[([^\]]{1,24})\]/g;const s=String(input??'');let last=0,chord='';let m;
  while((m=re.exec(s))!==null) {
    if(m.index>last) segments.push({chord,text:s.slice(last,m.index)});
    chord=m[1];last=re.lastIndex;
  }
  if(last<s.length || !segments.length) segments.push({chord,text:s.slice(last)});
  return segments;
}
