import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSongText,validSong,songToText,SONG_SYNTAX_EXAMPLE} from '../src/model.js';
test('--- splits slides while retaining Verse 1 until Verse 2',()=>{
 const s=parseSongText('[Verse 1]\nOne\nTwo\n---\nThree\nFour\n[Verse 2]\nFive');assert.equal(s.length,2);assert.equal(s[0].name,'Verse 1');assert.deepEqual(s[0].pages,[['One','Two'],['Three','Four']]);assert.equal(s[1].name,'Verse 2');assert.deepEqual(s[1].pages,[['Five']]);
});
test('blank lines and line count do not create slides',()=>{
 const s=parseSongText('[Verse 1]\nOne\nTwo\n\nThree\nFour\nFive');assert.deepEqual(s[0].pages,[['One','Two','Three','Four','Five']]);
});
test('repeated separators do not create empty slides and note-only sections remain',()=>{
 const s=parseSongText('[Verse]\n---\nOne\n---\n---\nTwo\n---\n[Outro]\n# Four bars');assert.deepEqual(s[0].pages,[['One'],['Two']]);assert.deepEqual(s[1].pages,[[]]);assert.deepEqual(s[1].notes,['Four bars']);
});
test('simple source roundtrip keeps section and slide boundaries',()=>{
 const song=validSong({title:'Simple',source:SONG_SYNTAX_EXAMPLE});assert.equal(song.sections[0].pages.length,2);assert.equal(song.sections[1].pages.length,1);const again=parseSongText(songToText(song));assert.deepEqual(again.map(s=>({name:s.name,pages:s.pages,notes:s.notes})),song.sections.map(s=>({name:s.name,pages:s.pages,notes:s.notes})));assert.ok(!/[{}]/.test(SONG_SYNTAX_EXAMPLE));
});
