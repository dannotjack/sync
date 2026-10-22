import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSongText,sampleState} from '../src/model.js';
import {LyricsPeer,assertSessionSize,MAX_SNAPSHOT_CHARS} from '../src/sync.js';

test('standalone slash chords stay within their section and remain chords',()=>{
 for(const chord of ['D/F#','C/E','Bm7/F#','Bb/D','Gsus4/B']){
  const sections=parseSongText('[Verse 1]\n['+chord+']\nOriginal words');
  assert.equal(sections.length,1);assert.equal(sections[0].name,'Verse 1');assert.equal(sections[0].pages[0][0],'['+chord+']');
 }
});
test('guest reports loading until the complete snapshot arrives, including after reconnect',async()=>{
 const statuses=[],messages=[];const host=new LyricsPeer({code:'ABC123',isHost:true});host.sdk={sendData:message=>messages.push(message)};host.getSnapshot=()=>sampleState();
 const guest=new LyricsPeer({code:'ABC123',isHost:false,onStatus:status=>statuses.push(status)});guest.sdk={sendData:()=>true};
 guest.receive({app:'lyrics-live/3',kind:'beacon',host:true},'host');assert.equal(statuses.at(-1),'loading');assert.ok(!statuses.includes('connected'));
 await host.sendSnapshot();for(const message of messages)guest.receive(message,'host');assert.equal(statuses.at(-1),'connected');
 guest.resetHost();guest.receive({app:'lyrics-live/3',kind:'beacon',host:true},'replacement');assert.equal(statuses.at(-1),'loading');
});
test('missing hosts get a recoverable timeout and oversized sessions fail before sending',()=>{
 const statuses=[];const peer=new LyricsPeer({code:'ABC123',isHost:false,onStatus:(status,detail)=>statuses.push({status,detail})});peer.startedAt=1000;peer.checkConnection(27000);
 assert.equal(statuses.at(-1).status,'not-found');assert.match(statuses.at(-1).detail,/Check the code/);
 assert.throws(()=>assertSessionSize({source:'x'.repeat(MAX_SNAPSHOT_CHARS)}),/too large to sync/);
});
