import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as model from '../src/model.js';
import * as sync from '../src/sync.js';
import * as onsong from '../studio/onsong.js';

const script=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
async function open(t,{demo=true,url='https://lyrics.notjack.au/'}={}){
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window;Object.assign(w,model,sync,onsong,{structuredClone,AbortController});
 Object.defineProperty(w,'crypto',{value:globalThis.crypto});w.confirm=()=>true;
 class GuestPeer{constructor(options){Object.assign(this,options);}async start(){this.onStatus('connected');this.onState(model.sampleState());}async close(){}}
 if(!demo)w.LyricsPeer=GuestPeer;
 w.fetch=async()=>({ok:true,text:async()=>JSON.stringify({version:1,songs:[]})});w.eval(script);
 const click=selector=>{const el=w.document.querySelector(selector);assert.ok(el,selector+' exists');el.click();};
 if(demo){click('[data-action="preview"]');await tick();click('[data-tab="setlist"]');}else await tick();
 return {w,click};
}
test('live app exposes Studio set import from Setlist and imports without changing the live song',async t=>{
 const {w,click}=await open(t);click('[data-action="toggle-edit"]');click('[data-action="show-set-import"]');assert.match(w.document.querySelector('.modal-card').textContent,/Sync Lyrics Studio/);
 const input=w.document.getElementById('set-import-input');Object.defineProperty(input,'files',{value:[{size:100,text:async()=>JSON.stringify({format:'lyrics-live-set',version:1,name:'Prepared originals',songs:[{title:'Original prepared song',source:'[Verse 1]\nOriginal words'}]})}]});
 input.dispatchEvent(new w.Event('change'));await tick();
 assert.match(w.document.querySelector('.set-title-wrap').textContent,/Prepared originals/);assert.match(w.document.querySelector('.setlist-rows').textContent,/Original prepared song/);
 assert.ok(!w.document.querySelector('.setlist-rows').textContent.includes('ON AIR'));
 assert.match(w.document.querySelector('.dock-caption').textContent,/Intro/);
});

test('homepage shows Beta and keeps Studio unlinked',async t=>{
 const {w,click}=await open(t);click('[data-action="settings"]');click('[data-action="leave"]');await tick();
 assert.equal(w.document.querySelector('.photo-tagline .beta-badge').textContent,'Beta');
 assert.equal(w.document.querySelector('a[href="./studio/"]'),null);
});
test('Control has two working tabs; views and display options are in Settings',async t=>{
 const {w,click}=await open(t);
 assert.deepEqual([...w.document.querySelectorAll('.song-tab')].map(el=>el.textContent),['Setlist','Live song']);
 assert.equal(w.document.querySelector('[data-action="view"]'),null);
 assert.equal(w.document.querySelector('.session-chip'),null);
 assert.equal(w.document.querySelector('.app-header .beta-badge').textContent,'Beta');
 click('[data-action="settings"]');assert.equal(w.document.querySelectorAll('.settings-view').length,3);
 assert.equal(w.document.querySelector('.settings-view.selected').textContent.includes('Control'),true);
 click('[data-action="font-more"]');assert.equal(w.document.querySelector('[data-action="font-more"]').disabled,true);
 click('[data-view="stage"]');assert.equal(w.document.querySelector('.modal-card'),null);
 assert.equal(w.document.querySelector('.song-tabs'),null);assert.equal(w.document.querySelector('.control-dock'),null);
 assert.equal(w.document.querySelector('.reading-toolbar'),null);assert.ok(w.document.querySelector('.lyrics-scroll'));
 const status=w.document.querySelector('.live-badge').textContent;
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'b',bubbles:true}));await tick();
 assert.equal(w.document.querySelector('.live-badge').textContent,status,'Stage keyboard does not change live output');
 click('[data-action="settings"]');click('[data-view="projector"]');
 assert.ok(w.document.querySelector('.projection-frame'));assert.equal(w.document.querySelector('.song-tabs'),null);
 assert.equal(w.document.querySelector('.projector-tools'),null);assert.equal(w.document.querySelector('.beta-badge'),null,'Beta is in projector Settings, not on the audience slide');
 click('[data-action="settings"]');assert.equal(w.document.querySelector('.settings-card .beta-badge').textContent,'Beta');
 assert.ok(w.document.querySelector('[data-action="projector-font-more"]'));
 click('[data-view="control"]');assert.ok(w.document.querySelector('.control-dock'));
});
test('switching from guest Stage to Control still requires the controller password',async t=>{
 const {w,click}=await open(t,{demo:false,url:'https://lyrics.notjack.au/?join=ABC123&view=stage'});
 assert.ok(w.document.querySelector('.stage-view'));
 click('[data-action="settings"]');click('[data-view="control"]');
 assert.ok(w.document.querySelector('#reauth-form'));assert.equal(w.document.querySelector('.control-dock'),null);
});
test('live app rejects oversized sets before replacing the current set',async t=>{
 const {w}=await open(t);const before=w.document.querySelector('.setlist-rows').textContent;
 const input=w.document.getElementById('set-import-input');Object.defineProperty(input,'files',{value:[{size:1000,text:async()=>JSON.stringify({format:'lyrics-live-set',version:1,songs:Array.from({length:121},()=>({title:'Original',source:'[Verse 1]\nOriginal words'}))})}]});
 input.dispatchEvent(new w.Event('change'));await tick();assert.equal(w.document.querySelector('.setlist-rows').textContent,before);assert.match(w.document.querySelector('.toast').textContent,/Choose a set/);
});

