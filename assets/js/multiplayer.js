/* =====================================================================
   multiplayer.js — thin wrapper over Supabase Realtime
   - createIdentity(): a stable per-session operator id / callsign / colour
   - createPresenceRoom(): join a channel, broadcast local state at a capped
     rate, and receive peers via presence + broadcast.

   Everything degrades gracefully: if Supabase isn't configured (no keys),
   createPresenceRoom() returns an inert stub so callers need no extra guards.
   ===================================================================== */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './realtime-config.js';

const CALLSIGNS = ['VIPER','RAVEN','GHOST','NOMAD','ECHO','KILO','ZULU','ORYX','LYNX','ATLAS','HALO','VOID','EMBER','FROST','RONIN','SABLE','COBRA','DELTA','OSPREY','WRAITH'];
export const AVATARS = ['knight','barbarian','mage','rogue','assassin','robot'];

function hslToHex(h, s, l){
  s/=100; l/=100;
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  const to=x=>Math.round(255*x).toString(16).padStart(2,'0');
  return '#'+to(f(0))+to(f(8))+to(f(4));
}

export function createIdentity(){
  try{ const s=JSON.parse(sessionStorage.getItem('mp-identity')); if(s&&s.id) return s; }catch(e){}
  const id=(crypto&&crypto.randomUUID?crypto.randomUUID():'op-'+Math.random().toString(36).slice(2));
  const hue=Math.floor(Math.random()*360);
  const idn={
    id,
    name: CALLSIGNS[Math.floor(Math.random()*CALLSIGNS.length)]+'-'+(100+Math.floor(Math.random()*900)),
    color: hslToHex(hue, 82, 60),
    avatar: AVATARS[Math.floor(Math.random()*AVATARS.length)],
    hue
  };
  try{ sessionStorage.setItem('mp-identity', JSON.stringify(idn)); }catch(e){}
  return idn;
}

const STUB = {
  disabled: true,
  send(){}, dispose(){},
  peers: new Map(),
  count(){ return 1; }
};

/**
 * @param {Object} o
 * @param {string} o.channelName   unique room key, e.g. `studio:rdog` or `hero-lobby`
 * @param {Object} o.self          identity ({id,name,color,...})
 * @param {Function} [o.onState]   (payload) => void   — a peer broadcast arrived
 * @param {Function} [o.onLeave]   (id) => void        — a peer disconnected
 * @param {Function} [o.onCount]   (n) => void         — total operators online changed
 * @param {number} [o.hz]          broadcast rate cap (default 14)
 */
export async function createPresenceRoom(o){
  if(!isConfigured) return STUB;

  let createClient;
  try{ ({ createClient } = await import('@supabase/supabase-js')); }
  catch(e){ console.warn('[mp] supabase-js unavailable', e); return STUB; }

  const hz = o.hz || 14;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: hz } },
    auth: { persistSession: false }
  });

  const peers = new Map();        // id -> last payload
  const channel = client.channel(o.channelName, {
    config: { presence: { key: o.self.id }, broadcast: { self: false } }
  });

  const emitCount = ()=>{ o.onCount && o.onCount(Object.keys(channel.presenceState()).length || 1); };

  channel.on('broadcast', { event: 'state' }, ({ payload })=>{
    if(!payload || payload.id===o.self.id) return;
    peers.set(payload.id, payload);
    o.onState && o.onState(payload);
  });

  // ephemeral combat / event signals (hits, knockouts, …)
  channel.on('broadcast', { event: 'sig' }, ({ payload })=>{
    if(!payload || payload.from===o.self.id) return;
    o.onSignal && o.onSignal(payload);
  });

  channel.on('presence', { event: 'leave' }, ({ leftPresences })=>{
    (leftPresences||[]).forEach(p=>{ const id=p.id||p.key; if(id){ peers.delete(id); o.onLeave && o.onLeave(id); } });
    emitCount();
  });

  channel.on('presence', { event: 'sync' }, ()=>{
    const present = new Set(Object.keys(channel.presenceState()));
    for(const id of [...peers.keys()]) if(!present.has(id)){ peers.delete(id); o.onLeave && o.onLeave(id); }
    emitCount();
  });

  await new Promise(res=>{
    channel.subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        try{ await channel.track({ id:o.self.id, name:o.self.name, color:o.self.color }); }catch(e){}
        emitCount(); res();
      } else if(status==='CHANNEL_ERROR' || status==='TIMED_OUT'){ res(); }
    });
  });

  let lastSent = 0;
  function send(state){
    const now = performance.now();
    if(now - lastSent < 1000/hz) return;
    lastSent = now;
    try{ channel.send({ type:'broadcast', event:'state', payload:{ id:o.self.id, c:o.self.color, n:o.self.name, a:o.self.avatar, ...state } }); }catch(e){}
  }
  function signal(payload){ try{ channel.send({ type:'broadcast', event:'sig', payload:{ from:o.self.id, ...payload } }); }catch(e){} }
  function dispose(){ try{ channel.unsubscribe(); client.removeAllChannels(); }catch(e){} }

  addEventListener('beforeunload', dispose);

  return { disabled:false, send, signal, dispose, peers, count(){ return Object.keys(channel.presenceState()).length || 1; } };
}
