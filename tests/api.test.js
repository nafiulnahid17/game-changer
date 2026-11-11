import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';

class InMemoryD1 {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON;');this.db.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));}
 prepare(sql){
  const db=this.db;
  return {bind(...params){return {
    async first(){return db.prepare(sql).get(...params)||null;},
    async all(){return {results: db.prepare(sql).all(...params)};},
    async run(){const result=db.prepare(sql).run(...params);return {meta:{changes:result.changes}};},
  };}};
 }
 async batch(prepared){const result=[];for(const p of prepared)result.push(await p.run());return result;}
}
function enc(s){return Buffer.from(s).toString('base64url')}
async function sign(key,payload){const h=enc(JSON.stringify({alg:'RS256',kid:'test-app-key'})),p=enc(JSON.stringify(payload));const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+enc(new Uint8Array(signature))}

test('real SQL with Worker API: auth, projects, chats, AI stream, history, usage, branch, isolation', async()=>{
 const {privateKey,publicKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',publicKey);jwk.kid='test-app-key';
 const prevFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
 const env={ACCESS_TEAM_DOMAIN:'https://api-integration.cloudflareaccess.com',ACCESS_AUD:'test-audience', DB:new InMemoryD1(), MAX_REQUESTS_PER_DAY:'25', MAX_REQUESTS_PER_MINUTE:'4',
  AI:{async run(model,{messages,stream,max_tokens}){assert.equal(model,'@cf/openai/gpt-oss-120b');assert.equal(stream,true);assert.ok(messages.some(m=>m.content.includes('build')||m.content.includes('Build')));return new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"response":"Built"}\n\ndata: {"response":" successfully"}\n\ndata: [DONE]\n\n'));c.close()}})}}};
 try{
  const base='https://app.example.test';
  async function call(path,method='GET',data=null,subject='user-one'){
   const payload={iss:env.ACCESS_TEAM_DOMAIN,aud:['test-audience'],sub:subject,email:subject+'@example.test',exp:Math.floor(Date.now()/1000)+3600};
   const token=await sign(privateKey,payload);
   const headers={'Cf-Access-Jwt-Assertion':token,'Origin':base};if(data!==null)headers['Content-Type']='application/json';
   return worker.fetch(new Request(base+'/api'+path,{method,headers,...(data===null?{}:{body:JSON.stringify(data)})}),env);
  }
  let r=await call('/me');assert.equal(r.status,200);assert.equal((await r.json()).user.id,'user-one');
  r=await call('/chats');assert.deepEqual((await r.json()).chats,[]);
  r=await call('/projects','POST',{name:'Real test project'});assert.equal(r.status,201);const project=(await r.json()).id;
  r=await call('/chats','POST',{kind:'plan',project_id:project});assert.equal(r.status,201);const chat=(await r.json()).id;
  r=await call('/chats/'+chat);assert.equal((await r.json()).messages.length,0);
  r=await call('/chats/'+chat+'/messages','POST',{content:'Build a full-stack app'});assert.equal(r.status,200);
  const sse=await r.text();assert.match(sse,/event: delta/);assert.match(sse,/event: done/);
  r=await call('/chats/'+chat);const data=await r.json();assert.equal(data.messages.length,2);assert.equal(data.messages[1].content,'Built successfully');
  assert.equal(data.chat.title,'Build a full-stack app');
  r=await call('/usage');assert.equal((await r.json()).total.completed_requests,1);
  r=await call('/chats?q=full-stack');assert.equal((await r.json()).chats.length,1);
  r=await call('/chats/'+chat+'/branch','POST',{});const newChat=(await r.json()).id;assert.notEqual(chat,newChat);
  r=await call('/chats/'+newChat);assert.equal((await r.json()).messages.length,2);
  r=await call('/chats/'+chat,'GET',null,'user-two');assert.equal(r.status,404);
  r=await call('/projects/'+project,'DELETE');assert.equal(r.status,200);
  r=await call('/chats/'+chat);assert.equal((await r.json()).chat.project_id,null);
 }finally{globalThis.fetch=prevFetch;}
});
