import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleState,applyAction,activeSong,activeSection,validSong,parseSongText,songToText,validateImport} from '../src/model.js';
test('# notes and instrumental-only sections survive parsing and roundtrip',()=>{
 const s=parseSongText('[Intro]\n# Guitar only, four bars\n[Verse]\n[G]Words');assert.deepEqual(s[0].pages,[[]]);assert.deepEqual(s[0].notes,['Guitar only, four bars']);assert.ok(songToText({sections:s}).includes('# Guitar only'));assert.equal(validSong({title:'Intro',source:'[Intro]\n# Four bars'}).sections.length,1);
});
test('library saves do not replace the live song until explicit go live',()=>{
 let s=sampleState();const original=structuredClone(activeSong(s));s=applyAction(s,{kind:'save-song',song:{...s.library[0],source:'[New]\n# New cue\nChanged words'}});assert.deepEqual(activeSong(s),original);s=applyAction(s,{kind:'jump',index:0,section:1,page:0});assert.deepEqual(activeSong(s),original);s=applyAction(s,{kind:'take-song-live',index:0});assert.equal(activeSection(s).name,'New');assert.equal(s.blank,false);assert.equal(activeSection(s).pages[0][0],'Changed words');
});
test('editing another set leaves live cursor, song and blank state alone',()=>{
 let s=sampleState();s.blank=true;s.sets.push({id:'prep',name:'Preparation',songs:['new','morning']});const cursor=structuredClone(s.cursor);s=applyAction(s,{kind:'position-in-set',setId:'prep',index:0,position:2});s=applyAction(s,{kind:'remove-from-set',setId:'prep',index:0});s=applyAction(s,{kind:'add-to-set',setId:'prep',id:'waters'});s=applyAction(s,{kind:'rename-set',setId:'prep',name:'Friday'});assert.deepEqual(s.cursor,cursor);assert.equal(activeSong(s).id,'morning');assert.equal(s.activeSetId,'sunday');assert.equal(s.blank,true);s=applyAction(s,{kind:'activate-set',id:'prep'});assert.equal(s.activeSetId,'prep');assert.equal(s.blank,false);assert.equal(activeSong(s).id,'new');
});
test('new sets do not go live and backup import starts blank',()=>{
 let s=sampleState();s=applyAction(s,{kind:'create-set',name:'New'});assert.equal(s.activeSetId,'sunday');assert.equal(validateImport(s).blank,true);
});
test('step into another song uses its saved version and notes-only page is navigable',()=>{
 let s=sampleState();s=applyAction(s,{kind:'save-song',song:{...s.library[1],source:'[Intro]\n# Four bars\n[Verse]\nNew words'}});s=applyAction(s,{kind:'jump',index:0,section:2,page:0});s=applyAction(s,{kind:'step',dir:1});assert.equal(activeSong(s).id,'waters');assert.deepEqual(activeSection(s).pages,[[]]);s=applyAction(s,{kind:'step',dir:1});assert.equal(activeSection(s).name,'Verse');
});
