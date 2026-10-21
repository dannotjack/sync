/* VDO.Ninja data-only room adapter. Host is the only state authority. */
const PROTOCOL = 'lyrics-live/1';
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
export class LyricsPeer {
  constructor({ code, isHost, password='', onState, onStatus, onCommand, onAuth, onPresence }) {
    this.code=code;this.isHost=isHost;this.password=password;
    this.onState=onState;this.onStatus=onStatus;this.onCommand=onCommand;this.onAuth=onAuth;this.onPresence=onPresence;
    this.sdk=null;this.hostUuid=null;this.authorized=new Set();this.peers=new Set();this.transfers=new Map();
    this.lastHostAt=0;this.timer=null;this.closed=false;this.authenticated=isHost;this.latestRevision=-1;
    this.getSnapshot=null;
  }
  report(value) { this.onStatus?.(value); }
  send(message,uuid) {
    if(!this.sdk) return false;
    try {return this.sdk.sendData({ app: PROTOCOL, ...message },uuid);} catch(e){console.warn('Send failed',e);return false;}
  }
  async start() {
    if(typeof window.VDONinjaSDK!=='function') throw new Error('The VDO.Ninja networking SDK could not load. Check your internet connection and try again.');
    this.sdk=new window.VDONinjaSDK({salt:'lyrics-live-v1',password:'lyrics-live-v1-room',autoRecover:true});
    this.sdk.addEventListener('connected',()=>this.report(this.isHost?'host-ready':'searching'));
    this.sdk.addEventListener('disconnected',()=>this.report('disconnected'));
    this.sdk.addEventListener('reconnecting',()=>this.report('reconnecting'));
    this.sdk.addEventListener('reconnected',()=>this.report(this.isHost?'host-ready':'searching'));
    this.sdk.addEventListener('dataChannelOpen', e=>{
      const uuid=e.detail?.uuid;if(uuid)this.peers.add(uuid);
      this.onPresence?.(this.peers.size);
      if(this.isHost) {this.send({kind:'beacon',host:true},uuid);this.sendSnapshot(uuid);}
      else this.send({kind:'hello'},uuid);
    });
    this.sdk.addEventListener('dataChannelClose',e=>{if(e.detail?.uuid){this.peers.delete(e.detail.uuid);this.authorized.delete(e.detail.uuid);this.onPresence?.(this.peers.size);}});
    this.sdk.addEventListener('peerDisconnected',e=>{if(e.detail?.uuid){this.peers.delete(e.detail.uuid);this.authorized.delete(e.detail.uuid);this.onPresence?.(this.peers.size);if(e.detail.uuid===this.hostUuid)this.report('reconnecting');}});
    this.sdk.addEventListener('dataReceived',e=>{this.receive(e.detail?.data,e.detail?.uuid);});
    this.report('connecting');
    await this.sdk.autoConnect({room:'lyrics_live_'+this.code,mode:'half',view:{audio:false,video:false},label:this.isHost?'Lyrics Host':'Lyrics Guest'});
    if(this.closed)return;
    this.report(this.isHost?'host-ready':'searching');
    this.timer=setInterval(()=>{
      if(this.isHost) this.send({kind:'beacon',host:true,rev:this.getSnapshot?.().rev});
      else if(Date.now()-this.lastHostAt>14000) { this.report('searching');this.send({kind:'hello'}); }
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
        if(ok)this.authorized.add(uuid);
        this.send({kind:ok?'auth-ok':'auth-failed'},uuid);
      }
      if(message.kind==='command' && this.authorized.has(uuid)) {
        try {this.onCommand?.(message.command);}
        catch(error){this.send({kind:'command-error',message:String(error?.message||error)},uuid);}
      }
      return;
    }
    if(message.kind==='beacon' && message.host===true) {
      if(this.hostUuid && this.hostUuid!==uuid)return;
      const isNew=!this.hostUuid;
      this.hostUuid=uuid;this.lastHostAt=Date.now();this.report('connected');
      if(isNew){this.send({kind:'request-snapshot'},uuid);if(this.password)this.send({kind:'auth',password:this.password},uuid);}
      else if(message.rev!=null && message.rev>this.latestRevision) this.send({kind:'request-snapshot'},uuid);
      return;
    }
    if(uuid!==this.hostUuid)return;
    this.lastHostAt=Date.now();this.report('connected');
    if(message.kind==='auth-ok') {this.authenticated=true;this.onAuth?.(true);}
    if(message.kind==='auth-failed') {this.authenticated=false;this.onAuth?.(false);}
    if(message.kind==='command-error') this.onStatus?.('error',message.message);
    if(message.kind==='snapshot-part') {
      const {id,n,total,chunk,rev}=message;
      if(typeof id!=='string'||typeof chunk!=='string'||!Number.isInteger(n)||!Number.isInteger(total)||total<1||total>350||n<0||n>=total)return;
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
            this.latestRevision=Number(snap.rev);this.onState?.(snap);
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
    const parts=json.match(/[\s\S]{1,5000}/g)||[''];
    if(parts.length>350){this.report('error','Library is too large for this session; shorten it or remove unused songs.');return;}
    const id=(crypto.randomUUID?.()||String(Math.random()))+'_'+snapshot.rev;
    for(let i=0;i<parts.length;i++) {
      if(this.closed)return;
      this.send({kind:'snapshot-part',id,n:i,total:parts.length,rev:snapshot.rev,chunk:parts[i]},uuid);
      if(i%6===5)await sleep(20);
    }
  }
  command(command) {if(this.isHost)this.onCommand?.(command);else if(this.hostUuid&&this.authenticated)this.send({kind:'command',command},this.hostUuid);}
  async close() {
    this.closed=true;
    if(this.timer)clearInterval(this.timer);
    if(this.sdk){try{await this.sdk.disconnect();}catch(e){console.warn(e);}}
    this.sdk=null;
  }
}
