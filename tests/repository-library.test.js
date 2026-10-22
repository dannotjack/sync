import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleState,mergeRepositorySongs,validateImport,applyAction} from '../src/model.js';
const entry=(id='shared',title='Shared Song',words='[G]Shared lyrics')=>({id,title,key:'G',bpm:80,order:'V1, C',lyrics:['[Verse 1]','# Guitar only',words,'---','[C]Second slide','[Chorus]','[D]Chorus']});
const manifest=(...songs)=>({version:1,songs});
test('GitHub song lines load with chords, notes, slides and arrangement',async()=>{
 const state=sampleState(),next=await mergeRepositorySongs(state,manifest(entry()));const song=next.library.find(s=>s.id==='shared');assert.equal(song.sections.length,2);assert.deepEqual(song.sections[0].notes,['Guitar only']);assert.equal(song.sections[0].pages.length,2);assert.equal(song.sections[0].pages[0][0],'[G]Shared lyrics');assert.equal(state.library.length,1);assert.deepEqual(next.cursor,state.cursor);assert.equal(next.activeSetId,state.activeSetId);assert.equal(next.sets[0].songs.includes('shared'),false);
});
test('repeat loads do not duplicate songs; GitHub updates unchanged copies',async()=>{
 let s=await mergeRepositorySongs(sampleState(),manifest(entry()));s=await mergeRepositorySongs(s,manifest(entry('shared','Updated','[G]New lyrics')));assert.equal(s.library.length,2);assert.equal(s.library.at(-1).title,'Updated');assert.equal(s.library.at(-1).source.includes('New lyrics'),true);
});
test('browser edits are preserved when GitHub changes and across backups',async()=>{
 let s=await mergeRepositorySongs(sampleState(),manifest(entry()));s=applyAction(s,{kind:'save-song',song:{...s.library.at(-1),title:'Local edit'}});s=validateImport(JSON.parse(JSON.stringify(s)));s=await mergeRepositorySongs(s,manifest(entry('shared','GitHub edit')));assert.equal(s.library.find(x=>x.id==='shared').title,'Local edit');assert.equal(s.library.length,2);
});
test('existing same-id host songs are not overwritten on first GitHub import',async()=>{
 const next=await mergeRepositorySongs(sampleState(),manifest(entry('mattgraham-1gldr6f','Conflicting Song')));assert.equal(next.library.length,1);assert.equal(next.library[0].title,'Build My Life');
});
test('malformed shared libraries are rejected without changing saved data',async()=>{
 const s=sampleState();await assert.rejects(mergeRepositorySongs(s,{}),/version 1/);await assert.rejects(mergeRepositorySongs(s,manifest(entry(),entry())),/Duplicate/);await assert.rejects(mergeRepositorySongs(s,manifest({...entry(),lyrics:'wrong'})),/lyrics array/);await assert.rejects(mergeRepositorySongs(s,manifest({...entry(),order:'Missing'})),/Unknown/);assert.equal(s.library.length,1);
});
test('removing GitHub entry does not erase saved songs and sync markers stay compact',async()=>{
 let s=await mergeRepositorySongs(sampleState(),manifest(entry()));s=await mergeRepositorySongs(s,manifest());assert.equal(s.library.length,2);assert.match(s.repositoryVersions.shared,/^[a-f0-9]{64}$/);assert.equal(validateImport(s).repositoryVersions.shared,s.repositoryVersions.shared);
});
