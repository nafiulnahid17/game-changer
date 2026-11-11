import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseModel, compactHistory, firstTitle, checkString, validUUID, systemPrompt, CHAT_KINDS} from '../src/lib.js';
import {parseSSEEvent,streamAIToClient} from '../src/ai.js';

test('model choices are strict allowlist',()=>{
 assert.equal(chooseModel('@cf/openai/gpt-oss-20b'),'@cf/openai/gpt-oss-20b');
 assert.equal(chooseModel('https://evil.example'),'@cf/openai/gpt-oss-120b');
});
test('messages are validated with hard caps',()=>{
 assert.equal(checkString(' hello  ',30),'hello');
 assert.throws(()=>checkString('',30));
 assert.throws(()=>checkString('x'.repeat(12001),12000));
 assert.equal(firstTitle('a\n b    c'), 'a b c');
});
test('conversation kinds and IDs',()=>{
 assert.deepEqual(CHAT_KINDS,['chat','plan','research']);
 assert.ok(validUUID(crypto.randomUUID()));
 assert.ok(!validUUID('../etc/passwd'));
});
test('conversation context trimming',()=>{
 const history=[{role:'user',content:'Hello'},{role:'assistant',content:'OK',status:'completed'}, {role:'assistant',content:'Partial',status:'interrupted'}, {role:'user',content:'Later'}];
 assert.deepEqual(compactHistory(history),[{role:'user',content:'Hello'},{role:'assistant',content:'OK'},{role:'user',content:'Later'}]);
 assert.equal(compactHistory(history,1).length,1);
});
test('research instruction explicitly rules out live web claims',()=>{
 assert.match(systemPrompt('research'),/do NOT have live web access/);
 assert.match(systemPrompt('plan'),/structured implementation plans/);
});
test('Cloudflare SSE decoder handles deltas, done and malformed frames',()=>{
 assert.equal(parseSSEEvent('data: {"response":"Hi"}').delta,'Hi');
 assert.deepEqual(parseSSEEvent('data: [DONE]'),{done:true});
 assert.deepEqual(parseSSEEvent('data: not-json'),{});
});
test('AI stream forwards deltas and persists completion metadata',async()=>{
 const encoded=new TextEncoder().encode('data: {"response":"Hello"}\n\ndata: {"response":" world"}\n\ndata: [DONE]\n\n');
 const input=new ReadableStream({start(controller){controller.enqueue(encoded);controller.close();}});
 let persistence;
 const out=streamAIToClient(input,async result=>{persistence=result;});
 let response='';for await (const chunk of out) response+=new TextDecoder().decode(chunk);
 assert.match(response,/event: delta/);assert.match(response,/event: done/);
 assert.equal(persistence.answer,'Hello world');assert.equal(persistence.interrupted,false);
});
test('streaming SSE parser handles CRLF split across byte chunks', async()=>{
 const payload='data: {"response":"ok"}\r\n\r\n';
 const b=new TextEncoder().encode(payload);
 const input=new ReadableStream({start(c){c.enqueue(b.slice(0,b.length-3));c.enqueue(b.slice(b.length-3));c.close();}});
 let result;const stream=streamAIToClient(input,async x=>{result=x});
 let output='';for await(const chunk of stream)output+=new TextDecoder().decode(chunk);
 assert.equal(result.answer,'ok');assert.match(output,/event: done/);
});
test('AI stream failure does not masquerade as a completed answer',async()=>{
 const input=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: {"response":"partial"}\n\n'));controller.error(new Error('provider disconnected'));}});
 let persistence;
 const out=streamAIToClient(input,async result=>{persistence=result;});
 let response='';for await(const chunk of out)response+=new TextDecoder().decode(chunk);
 assert.match(response,/event: error/);assert.equal(persistence.interrupted,true);
});
