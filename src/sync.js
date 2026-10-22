/* VDO.Ninja data-only room adapter. Host is the only state authority. */
const PROTOCOL = 'lyrics-live/3';
export const MAX_SNAPSHOT_CHARS=5_000_000;
export function assertSessionSize(state){if(JSON.stringify(state).length>MAX_SNAPSHOT_CHARS)throw Error('This library is too large to sync. Remove unused songs or use a smaller set.');return state;}
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
export class LyricsPeer {
  constructor({ code, isHost, password='', onState, onStatus, onCommand, onAuth, onPresence }) {
    this.code=code;this.isHost=isHost;this.password=password;
    this.onState=onState;this.onStatus=onStatus;this.onCommand=onCommand;this.onAuth=onAuth;this.onPresence=onPresence;
    this.sdk=null;this.hostUuid=null;this.authorized=new Set();this.peers=new Set();this.transfers=new Map();
    this.loadStartedAt=0;this.startedAt=0;this.searchNotice=false;this.lastHostAt=0;this.timer=null;this.closed=false;this.authenticated=isHost;this.latestRevision=-1;
    this.getSnapshot=null;this.snapshot=null;this.pending=new Map();this.commandResults=new Map();
  }
  report(value,detail) { this.onStatus?.(value,detail); }
  checkConnection(now=Date.now()){
    if(this.isHost)return;
    if(!this.hostUuid && now-this.startedAt>25000){if(!this.searchNotice){this.searchNotice=true;this.report('not-found','No host found. Check the code and keep the host device awake.');}return;}
    if(this.hostUuid&&!this.snapshot&&now-this.loadStartedAt>25000&&!this.searchNotice){this.searchNotice=true;this.report('sync-failed','The host connected, but lyrics could not load. Try again.');}
    if(this.hostUuid && now-this.lastHostAt>14000){this.resetHost();this.send({kind:'hello'});}
  }
  send(message,uuid) {
    if(!this.sdk) return false;
    try {return this.sdk.sendData({ app: PROTOCOL, ...message },uuid);} catch(e){console.warn('Send failed',e);return false;}
  }
  async start() {
    if(typeof window.VDONinjaSDK!=='function') throw new Error('The VDO.Ninja networking SDK could not load. Check your internet connection and try again.');
    this.sdk=new window.VDONinjaSDK({salt:'lyrics-live-v1',password:'lyrics-live-v1-room',autoRecover:true});
    this.sdk.addEventListener('connected',()=>this.report(this.isHost?'host-ready':'searching'));
    this.sdk.addEventListener('disconnected',()=>{if(!this.isHost)this.resetHost();this.report('disconnected');});
    this.sdk.addEventListener('reconnecting',()=>{if(!this.isHost)this.resetHost();else this.report('reconnecting');});
    this.sdk.addEventListener('reconnected',()=>this.report(this.isHost?'host-ready':'searching'));
    this.sdk.addEventListener('dataChannelOpen', e=>{
      const uuid=e.detail?.uuid;if(uuid)this.peers.add(uuid);
      this.onPresence?.(this.peers.size);
      if(!this.isHost&&uuid===this.hostUuid){this.resetHost();}
      if(this.isHost) {this.send({kind:'beacon',host:true},uuid);this.sendSnapshot(uuid);}
      else this.send({kind:'hello'},uuid);
    });
    this.sdk.addEventListener('dataChannelClose',e=>{if(e.detail?.uuid){this.peers.delete(e.detail.uuid);this.authorized.delete(e.detail.uuid);this.onPresence?.(this.peers.size);if(e.detail.uuid===this.hostUuid)this.resetHost();}});
    this.sdk.addEventListener('peerDisconnected',e=>{if(e.detail?.uuid){this.peers.delete(e.detail.uuid);this.authorized.delete(e.detail.uuid);this.onPresence?.(this.peers.size);if(e.detail.uuid===this.hostUuid)this.resetHost();}});
    this.sdk.addEventListener('dataReceived',e=>{this.receive(e.detail?.data,e.detail?.uuid);});
    this.startedAt=Date.now();this.report('connecting');
    await this.sdk.autoConnect({room:'lyrics_live_'+this.code,mode:'half',view:{audio:false,video:false},label:this.isHost?'Lyrics Host':'Lyrics Guest'});
    if(this.closed)return;
    this.report(this.isHost?'host-ready':'searching');
    this.timer=setInterval(()=>{
      if(this.isHost) this.send({kind:'beacon',host:true,rev:this.getSnapshot?.().rev});
      else this.checkConnection();
    },5000);
  }
  receive(message,uuid) {
    if(!message || message.app!==PROTOCOL || !uuid || typeof message.kind!=='string')return;
    if(this.isHost){
      if(message.kind==='hello') {this.send({kind:'beacon',host:true},uuid);this.sendSnapshot(uuid);}
      if(message.kind==='request-snapshot') this.sendSnapshot(uuid);
      if(message.kind==='auth') {
        // Password travels ONLY to host over encrypted WebRTC; no public broadcast.
        const ok=typeof message.password==='string'&&message.password===this.password;
        if(ok)this.authorized.add(uuid);else this.authorized.delete(uuid);
        this.send({kind:ok?'auth-ok':'auth-failed'},uuid);
      }
      if(message.kind==='command') {
        const id=message.id;
        if(typeof id!=='string')return;
        if(!this.authorized.has(uuid)){this.send({kind:'command-result',id,ok:false,message:'Controller disconnected. Unlock Control again.'},uuid);return;}
        const key=uuid+':'+id;
        if(this.commandResults.has(key)){this.commandResults.get(key).then(result=>this.send(result,uuid));return;}
        const result=Promise.resolve().then(()=>this.onCommand?.(message.command)).then(()=>({kind:'command-result',id,ok:true}),error=>({kind:'command-result',id,ok:false,message:String(error?.message||error)}));
        this.commandResults.set(key,result);
        if(this.commandResults.size>1000)this.commandResults.delete(this.commandResults.keys().next().value);
        result.then(reply=>this.send(reply,uuid));
      }
      return;
    }
    if(message.kind==='beacon' && message.host===true) {
      if(this.hostUuid && this.hostUuid!==uuid)return;
      const isNew=!this.hostUuid;
      this.hostUuid=uuid;this.lastHostAt=Date.now();if(this.snapshot)this.searchNotice=false;this.report(this.snapshot&&this.latestRevision>=(message.rev??this.latestRevision)?'connected':'loading');
      if(isNew){this.loadStartedAt=Date.now();this.send({kind:'request-snapshot'},uuid);if(this.password)this.send({kind:'auth',password:this.password},uuid);}
      else if(message.rev!=null && message.rev>this.latestRevision) this.send({kind:'request-snapshot'},uuid);
      return;
    }
    if(uuid!==this.hostUuid)return;
    this.lastHostAt=Date.now();
    if(message.kind==='command-result'){const pending=this.pending.get(message.id);if(pending){clearTimeout(pending.timer);this.pending.delete(message.id);if(message.ok)pending.resolve();else pending.reject(new Error(message.message||'Host rejected the change.'));}return;}
    if(message.kind==='live') {
      if(!this.snapshot||message.baseRev!==this.latestRevision){this.send({kind:'request-snapshot'},uuid);return;}
      const c=message.cursor;
      if(!c||!['song','section','page'].every(k=>Number.isInteger(c[k])&&c[k]>=0)||!Number.isInteger(message.rev)||message.rev<=this.latestRevision)return;
      const next={...this.snapshot,cursor:c,blank:!!message.blank,rev:message.rev};
      const set=next.sets.find(s=>s.id===next.activeSetId);const id=set?.songs[c.song];const song=next.liveSong?.id===id?next.liveSong:next.library.find(s=>s.id===id);
      if(set?.songs.length&&!song?.sections[c.section]?.pages[c.page])return;
      this.snapshot=next;this.latestRevision=next.rev;this.onState?.(next);this.report('connected');return;
    }
    if(message.kind==='auth-ok') {this.authenticated=true;this.onAuth?.(true);}
    if(message.kind==='auth-failed') {this.authenticated=false;this.onAuth?.(false);}
    if(message.kind==='command-error') this.onStatus?.('error',message.message);
    if(message.kind==='snapshot-part') {
      const {id,n,total,chunk,rev}=message;
      if(typeof id!=='string'||typeof chunk!=='string'||chunk.length>5000||!Number.isInteger(n)||!Number.isInteger(total)||total<1||total>1000||n<0||n>=total)return;
      let t=this.transfers.get(id);
      if(!t){t={chunks:new Array(total),received:0,total,rev,created:Date.now()};this.transfers.set(id,t);}
      if(t.total!==total)return;
      if(typeof t.chunks[n]!=='string')t.received++;
      t.chunks[n]=chunk;
      if(t.received===total) {
        this.transfers.delete(id);
        if(rev<this.latestRevision)return;
        try {
          const snap=JSON.parse(t.chunks.join(''));
          if(snap && Array.isArray(snap.library) && Array.isArray(snap.sets) && Number(snap.rev)>=this.latestRevision) {
            this.latestRevision=Number(snap.rev);this.snapshot=snap;this.onState?.(snap);this.report('connected');
          }
        } catch(e){console.warn('Snapshot decode failed',e);}
      }
      for(const [key,val] of this.transfers) if(Date.now()-val.created>20000)this.transfers.delete(key);
    }
  }
  async sendSnapshot(uuid) {
    if(!this.isHost || !this.getSnapshot || this.closed)return;
    const snapshot=this.getSnapshot();
    const json=JSON.stringify(snapshot);
    if(json.length>MAX_SNAPSHOT_CHARS){this.report('error','Library is too large for this session; remove unused songs.');return;}
    const parts=json.match(/[\s\S]{1,5000}/g)||[''];
    if(parts.length>1000){this.report('error','Library is too large for this session; shorten it or remove unused songs.');return;}
    const id=(crypto.randomUUID?.()||String(Math.random()))+'_'+snapshot.rev;
    for(let i=0;i<parts.length;i++) {
      if(this.closed)return;
      this.send({kind:'snapshot-part',id,n:i,total:parts.length,rev:snapshot.rev,chunk:parts[i]},uuid);
      if(i%6===5)await sleep(20);
    }
  }
  resetHost(){
    this.hostUuid=null;this.authenticated=false;this.latestRevision=-1;this.snapshot=null;this.transfers.clear();this.startedAt=Date.now();this.searchNotice=false;
    this.onAuth?.(false,'reconnecting');this.report('reconnecting');
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Connection lost. Check the live state before retrying.'));}this.pending.clear();
  }
  broadcastLive(baseRev){
    if(!this.isHost)return;
    const {rev,cursor,blank}=this.getSnapshot();
    this.send({kind:'live',baseRev,rev,cursor,blank});
  }
  command(command) {
    if(this.isHost)return Promise.resolve(this.onCommand?.(command));
    if(!this.hostUuid||!this.authenticated)return Promise.reject(new Error('Host disconnected. Wait for reconnection.'));
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Host did not confirm the change. Check before retrying.'));},10000);
      this.pending.set(id,{resolve,reject,timer});
      if(this.send({kind:'command',command,id},this.hostUuid)===false){clearTimeout(timer);this.pending.delete(id);reject(new Error('Change could not be sent.'));}
    });
  }
  async close() {
    this.closed=true;
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Session closed.'));}this.pending.clear();
    if(this.timer)clearInterval(this.timer);
    if(this.sdk){try{await this.sdk.disconnect();}catch(e){console.warn(e);}}
    this.sdk=null;
  }
}

