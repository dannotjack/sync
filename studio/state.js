import {validSong, validateImport} from '../src/model.js?v=beta11';

export const LIMITS = {songs:1000, sets:50, setSongs:120, file:2_000_000, backup:8_000_000};
const string = (value, name, limit, fallback='') => {
  if(value == null)return fallback;
  if(typeof value !== 'string' || value.length>limit)throw Error('Invalid '+name+'.');
  return value;
};

// Drafts may be incomplete, but their structure must still be safe to restore.
export function normalize(entry, {draft=false}={}) {
  if(!entry || typeof entry!=='object' || Array.isArray(entry))throw Error('Invalid song.');
  if(entry.lyrics!=null && (!Array.isArray(entry.lyrics)||entry.lyrics.some(x=>typeof x!=='string')))throw Error('Invalid lyric lines.');
  const song={
    id:string(entry.id,'song ID',120)||crypto.randomUUID(),
    title:string(entry.title,'title',100), key:string(entry.key,'key',16),
    bpm:entry.bpm==null?0:Number(entry.bpm), order:string(entry.order,'section order',2000),
    source:string(entry.source,'song source',100000,entry.lyrics?.join('\n')||''),
    artist:string(entry.artist,'artist',300),ccli:string(entry.ccli,'CCLI',100),
    origin:string(entry.origin,'origin',300),originPath:string(entry.originPath,'source path',1000)
  };
  if(song.source.length>100000 || !Number.isFinite(song.bpm)||song.bpm<0||song.bpm>300)throw Error('Invalid song length or BPM.');
  if(!draft)validSong(song);
  return song;
}

export function sourceReferences(entries=[]) {
  if(!Array.isArray(entries)||entries.length>LIMITS.songs)throw Error('Invalid source references.');
  return entries.map(entry=>{
    if(!entry||entry.sourceOnly!==true||entry.origin!=='mattgraham/worship'||!/^[a-f0-9]{40}$/.test(entry.sourceRevision||''))throw Error('Invalid linked song source.');
    if(!entry.id?.trim()||!entry.title?.trim()||!entry.originPath?.trim())throw Error('Linked songs need an ID, title and source path.');
    return {id:string(entry.id,'source ID',120),title:string(entry.title,'source title',100),sourceOnly:true,origin:entry.origin,
      originPath:string(entry.originPath,'source path',1000),sourceRevision:entry.sourceRevision};
  });
}

function unique(entries,name) {
  if(new Set(entries.map(s=>s.id)).size!==entries.length)throw Error('Duplicate '+name+' IDs.');
  return entries;
}
export function validateStudioState(raw) {
  if(!raw||!Array.isArray(raw.songs)||raw.songs.length>LIMITS.songs||!Array.isArray(raw.sets)||raw.sets.length>LIMITS.sets)throw Error('Invalid Studio backup.');
  const songs=unique(raw.songs.map(s=>normalize(s,{draft:true})),'song');
  const sets=raw.sets.map(set=>{
    if(!set||!Array.isArray(set.songs)||set.songs.length>LIMITS.setSongs)throw Error('A set can contain at most 120 songs.');
    return {id:string(set.id,'set ID',120)||crypto.randomUUID(),name:string(set.name,'set name',80)||'Untitled set',songs:unique(set.songs.map(s=>normalize(s,{draft:true})),'set song')};
  });
  const references=unique(sourceReferences(raw.references),'source');
  if(new Set([...songs,...references].map(song=>song.id)).size>LIMITS.songs)throw Error('Maximum 1000 master songs, including source references.');
  return {version:1,songs,sets:unique(sets,'set'),references};
}

export function validateSet(data) {
  if(data?.format!=='lyrics-live-set'||data.version!==1||!Array.isArray(data.songs)||data.songs.length>LIMITS.setSongs)throw Error('Choose a Sync Lyrics set with at most 120 songs.');
  return {id:crypto.randomUUID(),name:string(data.name,'set name',80)||'Imported set',songs:data.songs.map(s=>({...normalize(s),id:crypto.randomUUID()}))};
}

export function masterManifest(state) {
  if(state.songs.length>LIMITS.songs)throw Error('Maximum 1000 master songs.');
  const ids=new Set(state.songs.map(s=>s.id));
  const songs=state.songs.map(s=>{const song=normalize(s);return {...song,lyrics:song.source.split('\n'),source:undefined};});
  songs.push(...sourceReferences(state.references).filter(s=>!ids.has(s.id)));
  if(songs.length>LIMITS.songs)throw Error('Maximum 1000 master songs, including source references.');
  if(!songs.length)throw Error('No prepared songs to export. Select a linked title to load it, or create a song first.');
  return {version:1,songs};
}

// Built-in songs are added on every visit, including browsers with saved work.
// A local song with the same ID keeps its edits; local sets remain independent.
export function mergePublishedDefaults(state,manifest) {
  if(manifest?.version!==1||!Array.isArray(manifest.songs)||manifest.songs.length>LIMITS.songs)throw Error('Invalid published library.');
  const published=unique(manifest.songs.filter(song=>!song?.sourceOnly).map(song=>normalize(song)),'published song');
  const references=unique(sourceReferences(manifest.songs.filter(song=>song?.sourceOnly)),'source');
  const songs=[...new Map([...published,...state.songs].map(song=>[song.id,song])).values()];
  if(new Set([...songs,...references].map(song=>song.id)).size>LIMITS.songs)throw Error('Maximum 1000 master songs.');
  return {...state,songs,references};
}

export function backupToSet(data) {
  const backup=validateImport(data);
  const active=backup.sets.find(s=>s.id===data.activeSetId)||backup.sets[0];
  return {id:crypto.randomUUID(),name:active.name,songs:active.songs.map(id=>({...normalize(backup.library.find(s=>s.id===id)),id:crypto.randomUUID()}))};
}

export function encodeDownload(data,limit) {
  const text=JSON.stringify(data,null,2)+'\n';
  if(new Blob([text]).size>limit)throw Error('Export exceeds '+(limit/1_000_000)+' MB. Split it into smaller sets or remove unused songs.');
  return text;
}
