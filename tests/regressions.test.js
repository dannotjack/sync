import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LyricsPeer} from '../src/sync.js';
import {sampleState,applyAction,activeSong} from '../src/model.js';
const proto='lyrics-live/2';
test('removing earlier song preserves live song and slide',()=>{
 let s=sampleState();s.cursor={song:1,section:0,page:1};s=applyAction(s,{kind:'remove-from-set',index:0});assert.equal(activeSong(s).id,'waters');assert.deepEqual(s.cursor,{song:0,section:0,page:1});assert.throws(()=>applyAction(s,{kind:'delete-song',id:'waters'}),/live song/);
});
test('reconnect authenticates again and accepts replacement host',async()=>{
 const handlers={},sent=[];globalThis.window={VDONinjaSDK:class{addEventListener(n,f){handlers[n]=f}sendData(m,u){sent.push(m);return true}async autoConnect(){}async disconnect(){}}};
 const p=new LyricsPeer({code:'ABC123',isHost:false,password:'secret'});await p.start();p.receive({app:proto,kind:'beacon',host:true},'host');p.receive({app:proto,kind:'auth-ok'},'host');handlers.dataChannelClose({detail:{uuid:'host'}});assert.equal(p.authenticated,false);sent.length=0;p.receive({app:proto,kind:'beacon',host:true},'new-host');assert.equal(p.hostUuid,'new-host');assert.equal(sent.filter(m=>m.kind==='auth').length,1);await p.close();
});
test('navigation sends compact updates and gaps request snapshot',async()=>{
 let state=sampleState();const messages=[];const host=new LyricsPeer({isHost:true});host.getSnapshot=()=>state;host.sdk={sendData:m=>messages.push(m)};
 let received;const guest=new LyricsPeer({isHost:false,onState:s=>received=s});guest.sdk={sendData:m=>messages.push(m)};guest.receive({app:proto,kind:'beacon',host:true},'host');await host.sendSnapshot();for(const m of [...messages])if(m.kind==='snapshot-part')guest.receive(m,'host');messages.length=0;
 const old=state.rev;state=applyAction(state,{kind:'step',dir:1});host.broadcastLive(old);const msg=messages[0];assert.equal(msg.library,undefined);guest.receive(msg,'host');assert.deepEqual(received.cursor,state.cursor);messages.length=0;guest.receive({...msg,baseRev:999},'host');assert.equal(messages[0].kind,'request-snapshot');
});
test('commands acknowledge success, reject errors and deduplicate',async()=>{
 let calls=0;const host=new LyricsPeer({isHost:true,onCommand:async cmd=>{calls++;if(cmd.fail)throw new Error('Cannot remove live song');}});const guest=new LyricsPeer({isHost:false});host.sdk={sendData:m=>{queueMicrotask(()=>guest.receive(m,'host'));return true}};guest.sdk={sendData:m=>{queueMicrotask(()=>host.receive(m,'guest'));return true}};guest.hostUuid='host';guest.authenticated=true;host.authorized.add('guest');await guest.command({kind:'step',dir:1});assert.equal(calls,1);await assert.rejects(guest.command({fail:true}),/Cannot remove/);host.receive({app:proto,kind:'command',id:'repeat',command:{}},'guest');host.receive({app:proto,kind:'command',id:'repeat',command:{}},'guest');await new Promise(r=>setTimeout(r,0));assert.equal(calls,3);
});
