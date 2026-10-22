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
async function open(t){
 const dom=new JSDOM(html,{url:'https://lyrics.notjack.au/',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window;Object.assign(w,model,sync,onsong,{structuredClone,AbortController});
 Object.defineProperty(w,'crypto',{value:globalThis.crypto});w.confirm=()=>true;
 w.fetch=async()=>({ok:true,text:async()=>JSON.stringify({version:1,songs:[]})});w.eval(script);
 const click=selector=>{const el=w.document.querySelector(selector);assert.ok(el,selector+' exists');el.click();};
 click('[data-action="preview"]');await tick();click('[data-tab="setlist"]');
 return {w,click};
}
test('live app exposes Studio set import from Setlist and imports without changing the live song',async t=>{
 const {w,click}=await open(t);click('[data-action="show-set-import"]');assert.match(w.document.querySelector('.modal-card').textContent,/Sync Lyrics Studio/);
 const input=w.document.getElementById('set-import-input');Object.defineProperty(input,'files',{value:[{size:100,text:async()=>JSON.stringify({format:'lyrics-live-set',version:1,name:'Prepared originals',songs:[{title:'Original prepared song',source:'[Verse 1]\nOriginal words'}]})}]});
 input.dispatchEvent(new w.Event('change'));await tick();
 assert.match(w.document.querySelector('.set-title-wrap').textContent,/Prepared originals/);assert.match(w.document.querySelector('.setlist-rows').textContent,/Original prepared song/);
 assert.ok(!w.document.querySelector('.setlist-rows').textContent.includes('ON AIR'));
 assert.match(w.document.querySelector('.dock-caption').textContent,/Intro/);
});
test('live app rejects oversized sets before replacing the current set',async t=>{
 const {w}=await open(t);const before=w.document.querySelector('.setlist-rows').textContent;
 const input=w.document.getElementById('set-import-input');Object.defineProperty(input,'files',{value:[{size:1000,text:async()=>JSON.stringify({format:'lyrics-live-set',version:1,songs:Array.from({length:121},()=>({title:'Original',source:'[Verse 1]\nOriginal words'}))})}]});
 input.dispatchEvent(new w.Event('change'));await tick();assert.equal(w.document.querySelector('.setlist-rows').textContent,before);assert.match(w.document.querySelector('.toast').textContent,/Choose a set/);
});
