import {sampleState,validSong} from '../src/model.js';

// Synthetic navigation fixtures; never shipped as example songs in Lyrics Live.
export function multiSongFixture(){
  const s=sampleState();
  const a=validSong({id:'morning',title:'Morning Light',key:'G',source:'[Verse 1]\n[G]First verse\n---\n[D]Second slide\n[Chorus]\n[Em]First chorus\n---\n[C]Second chorus\n[Bridge]\n[G]Bridge'});
  const b=validSong({id:'waters',title:'Still Waters',key:'D',source:'[Verse 1]\n[G]First verse\n---\n[D]Second slide\n[Chorus]\n[C]Other chorus'});
  const c=validSong({id:'new',title:'All Things New',key:'C',source:'[Verse 1]\n[C]New song'});
  s.library=[a,b,c];s.sets[0].songs=[a.id,b.id,c.id];s.cursor={song:0,section:1,page:0};
  return s;
}
