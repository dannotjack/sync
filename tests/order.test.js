import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validSong,sampleState,applyAction,activeSong,validateImport} from '../src/model.js';
const source='[Verse 1]\n# Softly\n[G]One\n[Verse 2]\n[C]Two\n[Chorus]\n[D]Together\n[Bridge]\n[Em]Build';
test('typed song order repeats sections with their notes and chords',()=>{
 const song=validSong({title:'Ordered',source,order:'V1, C, V2, C, B, C'});assert.deepEqual(song.sections.map(x=>x.name),['Verse 1','Chorus','Verse 2','Chorus','Bridge','Chorus']);assert.deepEqual(song.sections[0].notes,['Softly']);assert.equal(song.sections[1].pages[0][0],'[D]Together');assert.equal(new Set(song.sections.map(x=>x.id)).size,6);
});
test('full names and numeric song orders, default order and invalid orders',()=>{
 assert.deepEqual(validSong({title:'Test',source,order:'Verse 2 > Chorus > Verse 1'}).sections.map(x=>x.name),['Verse 2','Chorus','Verse 1']);assert.deepEqual(validSong({title:'Test',source,order:'3, 1, 3'}).sections.map(x=>x.name),['Chorus','Verse 1','Chorus']);assert.equal(validSong({title:'Test',source}).sections.length,4);assert.throws(()=>validSong({title:'Test',source,order:'Missing'}),/Unknown section/);assert.throws(()=>validSong({title:'Test',source:'[Verse]\nOne\n[Verse]\nTwo',order:'Verse'}),/ambiguous/);
});
test('song order survives repeated validation, saving and backups',()=>{
 let s=sampleState();const song=validSong({title:'Ordered',source,order:'C, V1, C'});s=applyAction(s,{kind:'save-song',song});const restored=validateImport(s).library.find(x=>x.id===song.id);assert.equal(restored.order,'C, V1, C');assert.equal(restored.sections.length,3);assert.equal(restored.source,source);
});
test('typed setlist positions preserve the live occurrence and slide',()=>{
 for(const from of [0,1,2])for(const position of [1,2,3]){let s=sampleState();s.cursor={song:1,section:0,page:1};s=applyAction(s,{kind:'position-in-set',index:from,position});assert.equal(activeSong(s).id,'waters');assert.equal(s.cursor.page,1);}
 let s=sampleState();s.sets[0].songs=['morning','waters','morning'];s.cursor={song:2,section:1,page:1};s=applyAction(s,{kind:'position-in-set',index:2,position:1});assert.equal(s.cursor.song,0);assert.equal(activeSong(s).id,'morning');assert.equal(s.cursor.page,1);assert.throws(()=>applyAction(s,{kind:'position-in-set',index:0,position:0}),/position/);
});
