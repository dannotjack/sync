import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as model from '../src/model.js';
import * as stateModel from '../studio/state.js';
import * as onsong from '../studio/onsong.js';
import {multiSongFixture} from './fixtures.js';

const html=readFileSync(new URL('../studio/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../studio/studio.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const song=()=>({id:'original',title:'Original song',key:'G',bpm:90,order:'',source:'[Verse 1]\n[G]Original words\n---\nSecond slide'});
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
async function studio(t,{saved={version:1,songs:[song()],sets:[]},fetcher}={}){
 const dom=new JSDOM(html,{url:'https://lyrics.notjack.au/studio/',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window;
 Object.assign(w,model,stateModel,onsong,{structuredClone,AbortSignal,setupOnSongBrowser:()=>({open(){}}),confirm:()=>true,prompt:()=>null});
 Object.defineProperty(w,'crypto',{value:globalThis.crypto});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(saved!==null)w.localStorage.setItem('lyrics-live-studio-v1',typeof saved==='string'?saved:JSON.stringify(saved));
 w.fetch=fetcher||(async()=>({ok:true,json:async()=>({version:1,files:[],count:0,commit:'a'.repeat(40)})}));
 w.eval(script);await tick();
 return {w,click:action=>{const button=w.document.querySelector('[data-action="'+action+'"]');assert.ok(button,action+' exists');button.click();},stored:()=>JSON.parse(w.localStorage.getItem('lyrics-live-studio-v1')),input:(id,value)=>{const el=w.document.getElementById(id);assert.ok(el,id+' exists');el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));}};
}
test('Studio boots from its shipped HTML; master create, duplicate and delete survive reload',async t=>{
 const {w,click,stored,input}=await studio(t);
 assert.match(w.document.querySelector('.brand').textContent,/Sync Lyrics/);
 click('new-song');assert.equal(stored().songs.length,2);
 input('title','New original song');input('source','[Verse 1]\nNew original words');
 click('duplicate');assert.equal(stored().songs.length,3);
 click('delete-song');assert.equal(stored().songs.length,2);
 const next=await studio(t,{saved:stored()});assert.equal(next.w.document.querySelectorAll('.songitem').length,2);
});
test('title and key preview update while typing; quota failure preserves prior stored work',async t=>{
 const {w,click,stored,input}=await studio(t);click('choose');
 input('title','Updated title');input('key','D');assert.match(w.document.querySelector('#preview h3').textContent,/Updated title · D/);
 const original=stored().songs[0].source;
 w.Storage.prototype.setItem=()=>{throw new w.DOMException('Full','QuotaExceededError');};
 input('source','[Verse 1]\nUnsaved in memory');
 assert.equal(stored().songs[0].source,original);assert.equal(w.document.querySelector('#save-warning').hidden,false);
 assert.match(w.document.querySelector('[data-save-status]').textContent,/Not saved/);
});
test('malformed backup is rejected before replacing saved work',async t=>{
 const {w,stored}=await studio(t);const input=w.document.getElementById('import-file');
 Object.defineProperty(input,'files',{value:[{name:'bad.json',size:80,text:async()=>JSON.stringify({format:'lyrics-live-studio-backup',version:1,state:{songs:[],sets:'invalid'}})}]});
 input.dispatchEvent(new w.Event('change'));await tick();
 assert.equal(stored().songs[0].id,'original');assert.match(w.document.getElementById('toast').textContent,/Invalid Studio backup/);
});
test('plain lyrics import adds a master song, with a working cancel choice',async t=>{
 const {w,click,stored}=await studio(t);click('import');
 w.document.querySelector('[data-dialog-value="cancel"]').click();await tick();assert.equal(w.document.querySelector('dialog'),null);
 click('import');w.document.querySelector('[data-dialog-value="text"]').click();await tick();
 const input=w.document.getElementById('import-file');Object.defineProperty(input,'files',{value:[{name:'Original text.txt',size:50,text:async()=>'[Verse 1]\nOriginal imported words'}]});
 input.dispatchEvent(new w.Event('change'));await tick();assert.equal(stored().songs.length,2);
});
test('invalid stored work is retained for recovery instead of overwritten',async t=>{
 const raw='{"songs": [], "sets": "broken"}';const {w,click}=await studio(t,{saved:raw});click('new-song');
 assert.equal(w.localStorage.getItem('lyrics-live-studio-v1'),raw);assert.equal(w.document.querySelector('#save-warning').hidden,false);
});
test('late published-song response preserves a song created while loading',async t=>{
 let complete;const response=new Promise(resolve=>complete=resolve);
 const app=await studio(t,{saved:null,fetcher:async url=>String(url).includes('library.json')?await response:{ok:true,json:async()=>({version:1,files:[],count:0,commit:'a'.repeat(40)})}});
 app.click('new-song');app.input('title','My draft');complete({ok:true,json:async()=>({version:1,songs:[{...song(),id:'published'}]})});await tick();
 assert.deepEqual(app.stored().songs.map(s=>s.title),['Original song','My draft']);
});
test('Studio backups preserve incomplete drafts but reject invalid structures and oversized sets',()=>{
 const draft={...song(),title:'',source:'[Verse 1]\n'};
 assert.equal(stateModel.validateStudioState({songs:[draft],sets:[]}).songs[0].title,'');
 assert.throws(()=>stateModel.validateStudioState({songs:[{...song(),source:{}}],sets:[]}),/source/);
 assert.throws(()=>stateModel.validateSet({format:'lyrics-live-set',version:1,songs:Array.from({length:121},song)}),/120/);
 assert.throws(()=>stateModel.encodeDownload({text:'🙂'.repeat(50)},100),/exceeds/);
});
test('export retains published references and includes prepared songs without the whole linked catalogue',()=>{
 const reference={id:'linked',title:'Linked title',sourceOnly:true,origin:'mattgraham/worship',originPath:'Linked.onsong',sourceRevision:'a'.repeat(40)};
 const output=stateModel.masterManifest({songs:[song()],sets:[],references:[reference]});
 assert.equal(output.songs.length,2);assert.equal(output.songs[1].sourceOnly,true);
 assert.throws(()=>stateModel.masterManifest({songs:[],references:[]}),/No prepared songs/);
 const backup=multiSongFixture();backup.sets.push({id:'second',name:'Second set',songs:[backup.library[1].id]});backup.activeSetId='second';
 const imported=stateModel.backupToSet(backup);assert.equal(imported.name,'Second set');assert.equal(imported.songs[0].title,backup.library[1].title);
});
