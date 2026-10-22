import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleState,removeOriginalDemoSongs,DEMO_SONG_ID,validSong} from '../src/model.js';

// Historical originals embedded solely to verify exact-match browser migrations.
const originals=[
  {
    "id": "morning",
    "title": "Morning Light",
    "key": "G",
    "source": "[Verse 1]\n[G]When the morning [D]finds us here\n[Em]Hope is rising, [C]clear and near\n---\n[G]Every moment, [D]every breath\n[C]Held in kindness, [G]held in grace\n\n[Chorus]\n# Build gently; all voices in.\n[C]Lead us on into the [G]light\n[D]Hold us through the [Em]darkest night\n---\n[C]Every voice and every [G]song\n[D]Sing of hope that [G]carries on\n\n[Bridge]\n[Em]We will not be [C]overcome\n[G]There's a new day [D]yet to come"
  },
  {
    "id": "waters",
    "title": "Still Waters",
    "key": "D",
    "source": "[Verse 1]\n[D]By the quiet [A]waters stay\n[Bm]Guide my restless [G]heart today\n---\n[D]When the road is [A]hard to see\n[G]Walk the winding [D]path with me\n\n[Chorus]\n[G]Peace like a river, [D]steady and deep\n[A]Love that will hold me, [Bm]love that will keep"
  },
  {
    "id": "new",
    "title": "All Things New",
    "key": "C",
    "source": "[Verse 1]\n[C]Here at the [G]turning of the tide\n[Am]Hope is [F]awakening inside\n\n[Chorus]\n[F]You make [C]all things new\n[G]The morning [Am]breaks through"
  }
];
function historicalState(){
 const state=sampleState();
 state.library=originals.map(song=>validSong(song));
 state.sets[0].songs=originals.map(song=>song.id);
 return state;
}
test('only original unmodified placeholders are removed from historical browser state',()=>{
 const state=historicalState(),clean=removeOriginalDemoSongs(state);
 assert.equal(state.library.length,3,'input state must not be changed');
 assert.deepEqual(clean.library.map(x=>x.id),[DEMO_SONG_ID]);
 assert.deepEqual(clean.sets[0].songs,[DEMO_SONG_ID]);
});
test('edited demo song is treated as user content and survives migration',()=>{
 const state=historicalState();
 state.library[0]=validSong({...state.library[0],source:state.library[0].source+'\n[D]My own edit'});
 const clean=removeOriginalDemoSongs(state);
 assert.equal(clean.library.some(s=>s.id==='morning'),true);
 assert.equal(clean.library.some(s=>s.id==='waters'),false);
 assert.equal(clean.library.some(s=>s.id==='new'),false);
});
test('custom setlists survive cleanup',()=>{
 const state=historicalState();
 state.library.push(validSong({id:'custom',title:'Custom',source:'[Verse]\n[G]My own song'}));
 state.sets.push({id:'friday',name:'Friday',songs:['custom','morning']});
 const clean=removeOriginalDemoSongs(state);
 assert.deepEqual(clean.sets.find(x=>x.id==='friday').songs,['custom']);
 assert.ok(clean.library.find(x=>x.id==='custom'));
});
