import {multiSongFixture} from './fixtures.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {sampleState, parseSongText, songToText, applyAction, activeSection, activeSong, validSong, validateImport,chordSegments} from '../src/model.js';
test('starter demo has only Build My Life',()=>{const s=sampleState();assert.deepEqual(s.sets[0].songs,['mattgraham-1gldr6f']);assert.equal(s.library.length,1);assert.equal(activeSong(s).title,'Build My Life');assert.equal(activeSection(s).name,'Intro');});
test('next traverses slides, sections and songs, previous reverses',()=>{
 let s=multiSongFixture();let original=s.cursor;s=applyAction(s,{kind:'step',dir:1});assert.equal(s.cursor.page,1);
 s=applyAction(s,{kind:'step',dir:1});assert.equal(s.cursor.section,2);s=applyAction(s,{kind:'step',dir:-1});assert.equal(s.cursor.section,1);assert.equal(s.cursor.page,1);
 s=applyAction(s,{kind:'jump',index:0,section:2,page:0});s=applyAction(s,{kind:'step',dir:1});assert.equal(s.cursor.song,1);assert.equal(s.cursor.section,0);
});
test('blank preserves current slide and can be toggled',()=>{
 let s=multiSongFixture();s=applyAction(s,{kind:'blank',value:true});assert.deepEqual(s.cursor,{song:0,section:1,page:0});s=applyAction(s,{kind:'step',dir:1});assert.equal(s.blank,true);s=applyAction(s,{kind:'blank',value:false});assert.equal(s.blank,false);assert.equal(s.cursor.page,1);
});
test('section and slide jumps and setlist edit',()=>{
 let s=multiSongFixture();s=applyAction(s,{kind:'jump',index:0,section:0,page:1});assert.deepEqual(s.cursor,{song:0,section:0,page:1});
 s=applyAction(s,{kind:'move-in-set',index:0,dir:1});assert.equal(s.sets[0].songs[1],'morning');assert.equal(s.cursor.song,1);
 assert.throws(()=>applyAction(s,{kind:'remove-from-set',index:1}),/live song/);s=applyAction(s,{kind:'remove-from-set',index:0});assert.equal(s.sets[0].songs.length,2);assert.equal(activeSong(s).id,'morning');
});
test('ChordPro inline parsing and roundtrip',()=>{
 const source='[Verse 1]\n[G]Hello [D]world\n[Em]Carry [C]on\n---\n[G]Another [D]part\n[C]This is [G]fine\n\n[Chorus]\n[C]Sing the [G]song';
 const sections=parseSongText(source);assert.equal(sections.length,2);assert.equal(sections[0].pages.length,2);
 const segs=chordSegments('[G]Hello [D]world');assert.deepEqual(segs.map(s=>s.chord),['G','D']);
 const text=songToText({sections});assert.equal(parseSongText(text).length,2);
});
test('Import validation rejects malformed objects',()=>{
 assert.throws(()=>validateImport({foo:1}));let s=multiSongFixture();let result=validateImport(s);assert.equal(result.library.length,3);
 assert.throws(()=>validSong({title:'empty',source:''}));
});
