import test from 'node:test';
import assert from 'node:assert/strict';
import {convertOnSong,onsongId,onSongRawUrl} from '../studio/onsong.js';
import {validSong} from '../src/model.js';

test('OnSong headers, chord placement and section names convert without changing source wording',()=>{
  const input='Title: Example Song\r\nArtist: Example Artist\r\nKey: [G]\r\nTempo: 84\r\nCCLI: 12345\r\nBook: Rehearsal\r\n\r\nVerse 1:\r\n[G]One original [D/F#]line\r\n\r\nChorus:\r\n[Em]Another line';
  const converted=convertOnSong(input,'Example Song.onsong');
  assert.equal(converted.title,'Example Song');
  assert.equal(converted.artist,'Example Artist');
  assert.equal(converted.key,'G');
  assert.equal(converted.bpm,84);
  assert.equal(converted.ccli,'12345');
  assert.match(converted.source,/\[Verse 1\]\n\[G\]One original \[D\/F#\]line/);
  assert.match(converted.source,/\[Chorus\]\n\[Em\]Another line/);
  const parsed=validSong(converted);
  assert.equal(parsed.sections.length,2);
  assert.equal(parsed.sections[0].pages[0][0],'[G]One original [D/F#]line');
});

test('OnSong with no explicit sections receives Verse 1',()=>{
 const converted=convertOnSong('Title: Small Song\nKey: [D]\n\n[D]First line\nSecond line','Small Song.onsong');
 assert.equal(converted.key,'D');
 assert.match(converted.source,/^\[Verse 1\]\n\[D\]First line/);
 assert.equal(validSong(converted).sections.length,1);
});

test('upstream IDs and source URLs are stable',()=>{
 assert.equal(onsongId('File.onsong'),onsongId('File.onsong'));
 assert.notEqual(onsongId('One.onsong'),onsongId('Two.onsong'));
 assert.equal(onSongRawUrl('abcdef','A Song.onsong'),'https://raw.githubusercontent.com/mattgraham/worship/abcdef/A%20Song.onsong');
});

test('empty OnSong text is rejected',()=>{
 assert.throws(()=>convertOnSong('Title: Empty\nArtist: Example','Empty.onsong'),/no usable lyrics/);
});
