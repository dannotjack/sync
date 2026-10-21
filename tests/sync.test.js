import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LyricsPeer} from '../src/sync.js';
import {sampleState,applyAction} from '../src/model.js';
const proto='lyrics-live/1';
test('snapshot splits into chunks and reassembles only after all parts arrive',async()=>{
 const sent=[];const sample=sampleState();
 sample.library[0].source+=' X'.repeat(4000);
 const host=new LyricsPeer({code:'ABC123',isHost:true});host.sdk={sendData:(message,target)=>{sent.push({message,target});return true;}};host.getSnapshot=()=>sample;
 let result=null;
 const guest=new LyricsPeer({code:'ABC123',isHost:false,onState:s=>{result=s;}});
 guest.sdk={sendData:()=>true};
 guest.receive({app:proto,kind:'beacon',host:true},'host-uuid');
 await host.sendSnapshot('guest-uuid');
 const parts=sent.filter(m=>m.message.kind==='snapshot-part');assert.ok(parts.length>=2);
 guest.receive(parts[0].message,'host-uuid');assert.equal(result,null,'must not try to parse an incomplete snapshot');
 for(const {message} of parts.slice(1))guest.receive(message,'host-uuid');
 assert.equal(result.library.length,3);assert.equal(result.rev,sample.rev);assert.equal(result.library[0].source.length,sample.library[0].source.length);
});
test('unauthenticated controller commands are rejected at host',()=>{
 const sent=[];const executed=[];
 const host=new LyricsPeer({code:'ABC123',isHost:true,password:'correct-password',onCommand:cmd=>executed.push(cmd)});
 host.sdk={sendData:(message,target)=>{sent.push({message,target});return true;}};host.getSnapshot=()=>sampleState();
 host.receive({app:proto,kind:'command',command:{kind:'step',dir:1}},'anon');assert.equal(executed.length,0);
 host.receive({app:proto,kind:'auth',password:'wrong'},'anon');assert.equal(sent.at(-1).message.kind,'auth-failed');
 host.receive({app:proto,kind:'command',command:{kind:'step',dir:1}},'anon');assert.equal(executed.length,0);
 host.receive({app:proto,kind:'auth',password:'correct-password'},'anon');assert.equal(sent.at(-1).message.kind,'auth-ok');
 host.receive({app:proto,kind:'command',command:{kind:'step',dir:1}},'anon');assert.equal(executed.length,1);
});
test('ignores data with wrong protocol and unauthenticated host sender',()=>{
 let called=0;const guest=new LyricsPeer({code:'ABC123',isHost:false,onState:()=>called++});
 guest.sdk={sendData:()=>true};
 guest.receive({app:'other',kind:'beacon',host:true},'host');assert.equal(guest.hostUuid,null);
 guest.receive({app:proto,kind:'beacon',host:true},'host');assert.equal(guest.hostUuid,'host');
 guest.receive({app:proto,kind:'beacon',host:true},'other');assert.equal(guest.hostUuid,'host');
 assert.equal(called,0);
});
