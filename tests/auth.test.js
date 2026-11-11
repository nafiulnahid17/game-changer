import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyAccess} from '../src/auth.js';

function b64(bytes){return Buffer.from(bytes).toString('base64url')}
async function token(privateKey,payload,kid='test-key'){
 const header=b64(JSON.stringify({typ:'JWT',alg:'RS256',kid}));const body=b64(JSON.stringify(payload));
 const bytes=new TextEncoder().encode(header+'.'+body);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,bytes);
 return header+'.'+body+'.'+b64(new Uint8Array(signature));
}
test('Cloudflare Access: verifies signature, audience, issuer, expiration, allowlist',async()=>{
 const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',publicKey);jwk.kid='test-key';
 const env={ACCESS_TEAM_DOMAIN:'https://teamabc.cloudflareaccess.com',ACCESS_AUD:'aud-example',ACCESS_ALLOWED_EMAILS:'admin@example.test'};
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
 try{
  const payload={iss:env.ACCESS_TEAM_DOMAIN,aud:['aud-example'],sub:'cloudflare-user-1',email:'admin@example.test',exp:Math.floor(Date.now()/1000)+3600};
  const signed=await token(privateKey,payload);
  const req=t=>new Request('https://app.example.test/api/me',{headers:{'Cf-Access-Jwt-Assertion':t}});
  assert.deepEqual(await verifyAccess(req(signed),env),{id:'cloudflare-user-1',email:'admin@example.test'});
  assert.equal(await verifyAccess(req(signed+'x'),env),null);
  assert.equal(await verifyAccess(req(await token(privateKey,{...payload,aud:['other']})),env),null);
  assert.equal(await verifyAccess(req(await token(privateKey,{...payload,exp:12345})),env),null);
  assert.equal(await verifyAccess(req(await token(privateKey,{...payload,email:'other@example.test'})),env),null);
  assert.equal(await verifyAccess(new Request('https://app.example.test/api/me'),env),null);
 } finally {globalThis.fetch=originalFetch;}
});
