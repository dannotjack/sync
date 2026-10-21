import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSongText,songToText,validSong,validateImport,sampleState,SONG_SYNTAX_EXAMPLE} from '../src/model.js';
test('stage notes and comments never enter lyric slides or change pagination',()=>{
 const plain='[Verse]\n[G]First line\n[C]Second line\n---\nThird line';
 const noted='[Verse]\n{note: Guitar only}\n[G]First line\n# Stage cue\n{comment: Build gently}\n[C]Second line\n---\n{c: Repeat twice}\nThird line';
 const s=parseSongText(noted);assert.deepEqual(s[0].pages,parseSongText(plain)[0].pages);assert.deepEqual(s[0].notes,['Guitar only','Stage cue','Build gently','Repeat twice']);assert.ok(!JSON.stringify(s[0].pages).includes('Guitar'));
});
test('notes survive source roundtrip and backup import',()=>{
 const song=validSong({title:'Notes',source:'[Chorus]\n{note: Sing softly}\n[G]Words here'});assert.deepEqual(parseSongText(songToText(song))[0].notes,['Sing softly']);const s=sampleState();s.library.push(song);const restored=validateImport(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.library.at(-1).sections[0].notes,['Sing softly']);
});
test('editor syntax example parses metadata, note aliases and all supported sections',()=>{
 const s=parseSongText(SONG_SYNTAX_EXAMPLE);assert.deepEqual(s.map(x=>x.name),['Intro','Verse 1','Chorus','Bridge','Verse 2','chorus','Final bridge','Outro']);assert.equal(s[2].notes.length,1);const lyrics=s.flatMap(x=>x.pages.flat()).join('\n');assert.ok(!lyrics.includes('{title:'));assert.ok(!lyrics.includes('# Editor'));assert.ok(!lyrics.includes('{note:'));assert.ok(!lyrics.includes('{end_of_'));
});
