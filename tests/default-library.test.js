import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleState,mergeRepositorySongs,DEMO_SONG_ID,DEMO_FALLBACK_SOURCE} from '../src/model.js';
import {mergePublishedDefaults} from '../studio/state.js';
import {onsongId} from '../studio/onsong.js';

const manifest=JSON.parse(readFileSync(new URL('../songs/library.json',import.meta.url),'utf8'));
test('built-in Common Worship songs load by default without duplicating the demo or repeat visits',async()=>{
 assert.equal(manifest.name,'Common Worship');assert.equal(manifest.songs.length,57);
 for(const song of manifest.songs){assert.equal(song.sourceOnly,undefined);assert.ok(song.lyrics.length);assert.equal(song.id,onsongId(song.originPath));}
 let host=await mergeRepositorySongs(sampleState(),manifest);
 assert.equal(host.library.length,57);assert.notEqual(host.library.find(s=>s.id===DEMO_SONG_ID).source,DEMO_FALLBACK_SOURCE);
 host=await mergeRepositorySongs(host,manifest);assert.equal(host.library.length,57);
});
test('Studio adds defaults to saved work and preserves local edits and independent sets',()=>{
 const original=manifest.songs[0];
 const local={id:original.id,title:'My local title',key:'D',bpm:80,order:'',source:'[Verse 1]\nMy local words'};
 const set={id:'service',name:'My service',songs:[{...local,id:'set-copy'}]};
 const saved={version:1,songs:[local],sets:[set],references:[]};
 const next=mergePublishedDefaults(saved,manifest);
 assert.equal(next.songs.length,57);assert.equal(next.songs.find(s=>s.id===original.id).title,'My local title');
 assert.equal(next.sets,saved.sets);assert.deepEqual(saved.songs,[local]);
 assert.equal(mergePublishedDefaults(next,manifest).songs.length,57);
});
test('invalid published defaults leave the saved Studio collection unchanged',()=>{
 const saved={version:1,songs:[],sets:[],references:[]};
 assert.throws(()=>mergePublishedDefaults(saved,{version:1,songs:[manifest.songs[0],manifest.songs[0]]}),/Duplicate/);
 assert.deepEqual(saved.songs,[]);
});
