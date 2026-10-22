// Public source links only. Song texts are fetched into each visitor's browser on demand;
// this project does not publish copies of the upstream songs.
export function onsongId(path) {
  let hash = 2166136261;
  for (const char of path) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return 'mattgraham-' + (hash >>> 0).toString(36);
}
export function convertOnSong(text,path='Imported.onsong') {
  const lines=String(text??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  const meta={},body=[];
  const metaNames=new Set(['title','artist','author','composer','key','original key','tempo','bpm','ccli','book','notes','scripture reference(s)','scripture references','copyright','words','music','arrangement','cant key','cant']);
  const section=/^(verse(?:\s+\d+)?|chorus(?:\s+\d+)?|pre[\s-]?chorus(?:\s+\d+)?|bridge(?:\s+\d+)?|intro(?:\s*\/\s*interlude)?(?:\s*\/\s*outro)?|interlude(?:\s+\d+)?|outro|ending|tag(?:\s+\d+)?|refrain|instrumental(?:\s+\d+)?|turnaround|vamp|hook|solo|extra verses|other verses|repeat(?:\s+\d+)?|spontaneous|final chorus|post[\s-]?chorus)\s*:\s*$/i;
  let started=false,heading=false;
  for(const original of lines){
    const line=original.trimEnd();
    const trimmed=line.trim();
    const attribute=/^([A-Za-z][A-Za-z ()/]+):\s*(.*)$/.exec(trimmed);
    if(!started&&attribute&&metaNames.has(attribute[1].toLowerCase())){
      const key=attribute[1].toLowerCase(); meta[key]=attribute[2]; continue;
    }
    if(section.test(trimmed)){
      started=true;heading=true;body.push('['+trimmed.replace(/:\s*$/,'').trim()+']');continue;
    }
    if(!started && !trimmed) continue;
    if(trimmed && !started){started=true;body.push('[Verse 1]');heading=true;}
    // Some songbooks use one-off headings ending in colon. Keep these as headings, not lyric text.
    if(started&&/^[A-Za-z][\w '&/().+-]{1,55}:\s*$/.test(trimmed)&&!/^([A-G](?:#|b)?):$/.test(trimmed)){body.push('['+trimmed.slice(0,-1)+']');heading=true;continue;}
    body.push(line);
  }
  const source=body.join('\n').trim();
  if(!source||!source.replace(/\[[^\]]+\]/g,'').trim())throw Error('Song contains no usable lyrics or chord lines.');
  const filename=decodeURIComponent(String(path).split('/').pop()||'Imported.onsong').replace(/\.onsong$/i,'');
  const k=(meta.key||meta['original key']||'').replace(/^\[([^\]]+)\]$/,'$1').trim();
  return {
    id:onsongId(path),title:(meta.title||filename).trim(),key:k,bpm:Math.max(0,Math.min(300,parseInt(meta.tempo||meta.bpm,10)||0)),
    order:'',source,artist:meta.artist||meta.author||'',ccli:meta.ccli||'',origin:'mattgraham/worship',originPath:path
  };
}
export function onSongRawUrl(commit,path){
  const encoded=String(path).split('/').map(encodeURIComponent).join('/');
  return 'https://raw.githubusercontent.com/mattgraham/worship/'+encodeURIComponent(commit)+'/'+encoded;
}
