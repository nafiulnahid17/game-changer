import {verifyAccess, unauthenticated} from './auth.js';
import {InputError, checkString, chooseModel, CHAT_KINDS, MAX_MESSAGE_CHARS, validUUID, firstTitle, originAllowed} from './lib.js';
import {beginInference, streamAIToClient} from './ai.js';

const secureHeaders = {
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'",
};
function json(data, status=200) { return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8', ...secureHeaders}}); }
function err(message, status=400) { return json({error:message}, status); }
async function bodyJSON(request) {
  if ((Number(request.headers.get('content-length')) || 0) > 17000) throw new InputError('Request too large', 413);
  const text = await request.text();
  if (text.length > 17000) throw new InputError('Request too large', 413);
  try { const obj = JSON.parse(text); if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj; }
  catch {}
  throw new InputError('Expected a JSON object');
}
function checkId(id) { if (!validUUID(id)) throw new InputError('Invalid identifier'); return id; }
async function requireChat(env, user, id) {
  checkId(id);
  const chat = await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND owner_id=?').bind(id, user.id).first();
  if (!chat) throw new InputError('Conversation not found', 404);
  return chat;
}
async function requireProject(env, user, id) {
  checkId(id);
  const p = await env.DB.prepare('SELECT * FROM projects WHERE id=? AND owner_id=?').bind(id, user.id).first();
  if (!p) throw new InputError('Project not found', 404);
  return p;
}
async function userSync(env, user) {
  await env.DB.prepare(`INSERT INTO users(id,email) VALUES(?,?)
    ON CONFLICT(id) DO UPDATE SET email=excluded.email, updated_at=datetime('now')`).bind(user.id,user.email).run();
}
async function checkLimits(env, user, chat, model) {
  const cap = Math.max(1,Math.min(1000,Number(env.MAX_REQUESTS_PER_DAY) || 25));
  const minute = Math.max(1,Math.min(60,Number(env.MAX_REQUESTS_PER_MINUTE) || 4));
  // Atomic per-user quota reservation to avoid simultaneous requests bypassing the daily cap.
  const id = crypto.randomUUID();
  const res = await env.DB.prepare(`INSERT INTO ai_requests(id,owner_id,conversation_id,model,status)
    SELECT ?,?,?,?,'started'
    WHERE (SELECT count(*) FROM ai_requests WHERE owner_id=? AND created_at >= datetime('now','-1 day')) < ?
      AND (SELECT count(*) FROM ai_requests WHERE owner_id=? AND created_at >= datetime('now','-1 minute')) < ?`)
    .bind(id,user.id,chat.id,model,user.id,cap,user.id,minute).run();
  if (!res.meta?.changes) throw new InputError('AI rate limit reached. Try again later.',429);
  return id;
}
async function generate(request, env, user, chat, retry=false) {
  const input = await bodyJSON(request);
  const model = chooseModel(input.model || chat.model);
  const oldRows = await env.DB.prepare(`SELECT * FROM messages WHERE conversation_id=? ORDER BY seq ASC LIMIT 100`).bind(chat.id).all();
  let rows = oldRows.results || [];
  if (retry) {
    if (!rows.length || rows[rows.length-1].role !== 'user') {
      if (rows.length && rows[rows.length-1].role === 'assistant' && rows[rows.length-1].status === 'interrupted') {
        await env.DB.prepare('DELETE FROM messages WHERE id=? AND conversation_id=?').bind(rows[rows.length-1].id,chat.id).run();
        rows = rows.slice(0,-1);
      } else throw new InputError('Only a failed or unanswered user message can be retried.');
    }
  } else {
    const content = checkString(input.content, MAX_MESSAGE_CHARS,'Message');
    if (rows.length >= 100) throw new InputError('Conversation message limit reached. Start a new chat.');
    const last = rows[rows.length-1];
    if (last && last.role === 'user') throw new InputError('Previous message needs a response. Use Retry.');
    if (last && last.role === 'assistant' && last.status === 'interrupted') throw new InputError('Retry the interrupted message first.');
    rows.push({role:'user', content, status:'completed', id:crypto.randomUUID()});
  }
  const project = chat.project_id ? await requireProject(env,user,chat.project_id) : null;
  const reservation = await checkLimits(env, user, chat, model);
  if (retry) {
    await env.DB.prepare("UPDATE conversations SET model=?,updated_at=datetime('now') WHERE id=? AND owner_id=?").bind(model,chat.id,user.id).run();
  }
  if (!retry) {
    const last = rows[rows.length-1];
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO messages(id,conversation_id,role,content,status) VALUES(?,?,?,?,?)').bind(last.id,chat.id,'user',last.content,'completed'),
        env.DB.prepare(`UPDATE conversations SET title=CASE WHEN title='' THEN ? ELSE title END,model=?,updated_at=datetime('now') WHERE id=? AND owner_id=?`).bind(firstTitle(last.content),model,chat.id,user.id),
      ]);
    } catch(e) {
      await env.DB.prepare("UPDATE ai_requests SET status='failed' WHERE id=?").bind(reservation).run();
      throw e;
    }
  }
  try {
    const {stream} = await beginInference(env,chat.kind,project?.instructions || '',rows,model);
    const userId = user.id, chatId = chat.id;
    const output = streamAIToClient(stream, async ({answer,interrupted,usage}) => {
      await env.DB.batch([
        ...(answer.trim() ? [env.DB.prepare('INSERT INTO messages(id,conversation_id,role,content,status) VALUES(?,?,?,?,?)')
          .bind(crypto.randomUUID(),chatId,'assistant',answer,interrupted?'interrupted':'completed')] : []),
        env.DB.prepare(`UPDATE ai_requests SET status=?,input_tokens=?,output_tokens=? WHERE id=? AND owner_id=?`)
          .bind(interrupted || !answer.trim()?'failed':'completed',Number.isInteger(usage?.prompt_tokens)?usage.prompt_tokens:null,Number.isInteger(usage?.completion_tokens)?usage.completion_tokens:null,reservation,userId),
        env.DB.prepare(`UPDATE conversations SET updated_at=datetime('now') WHERE id=? AND owner_id=?`).bind(chatId,userId),
      ]);
    });
    return new Response(output,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-content-type-options':'nosniff'}});
  } catch(e) {
    await env.DB.prepare("UPDATE ai_requests SET status='failed' WHERE id=?").bind(reservation).run();
    throw new InputError(e instanceof Error ? `AI unavailable: ${e.message}` : 'AI unavailable',503);
  }
}
async function handle(request,env,user) {
  const url = new URL(request.url), path = url.pathname;
  const method = request.method;
  if (method !== 'GET' && !originAllowed(request)) throw new InputError('Cross-site requests are not allowed',403);
  if (path === '/api/me' && method === 'GET') {
    const me = await env.DB.prepare('SELECT id,email,display_name,created_at FROM users WHERE id=?').bind(user.id).first();
    return json({user:me, models:[{id:'@cf/openai/gpt-oss-120b',name:'GPT-OSS 120B'},{id:'@cf/openai/gpt-oss-20b',name:'GPT-OSS 20B'}], liveWebSearch:false, filesEnabled:false, pluginsEnabled:false, billingEnabled:false});
  }
  if (path === '/api/me' && method === 'PATCH') {
    const body=await bodyJSON(request);
    const name = checkString(body.display_name,80,'Display name');
    await env.DB.prepare("UPDATE users SET display_name=?,updated_at=datetime('now') WHERE id=?").bind(name,user.id).run();
    return json({ok:true});
  }
  if (path === '/api/projects' && method === 'GET') {
    const rs=await env.DB.prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY updated_at DESC LIMIT 150').bind(user.id).all();
    return json({projects:rs.results || []});
  }
  if (path === '/api/projects' && method === 'POST') {
    const body=await bodyJSON(request), name=checkString(body.name,80,'Project name');
    const id=crypto.randomUUID();
    const saved = await env.DB.prepare('INSERT INTO projects(id,owner_id,name) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM projects WHERE owner_id=?) < 100')
      .bind(id,user.id,name,user.id).run();
    if (!saved.meta?.changes) throw new InputError('Project limit reached (100 per account).',429);
    return json({id,name},201);
  }
  const projectMatch=path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const id=checkId(projectMatch[1]); await requireProject(env,user,id);
    if (method==='PATCH') {
      const body=await bodyJSON(request);
      const name=checkString(body.name,80,'Project name');
      const instructions=typeof body.instructions==='string' && body.instructions.length<=6000?body.instructions:'';
      await env.DB.prepare("UPDATE projects SET name=?,instructions=?,updated_at=datetime('now') WHERE id=? AND owner_id=?").bind(name,instructions,id,user.id).run();
      return json({ok:true});
    }
    if (method==='DELETE') {
      // Preserve chats when deleting a project: project_id becomes NULL via ON DELETE SET NULL.
      await env.DB.prepare('DELETE FROM projects WHERE id=? AND owner_id=?').bind(id,user.id).run();
      return json({ok:true});
    }
  }
  if (path === '/api/chats' && method === 'GET') {
    const q=(url.searchParams.get('q') || '').trim().slice(0,100);
    const includeArchived = url.searchParams.get('archived') === '1';
    const projectId = url.searchParams.get('project');
    if (projectId) await requireProject(env,user,projectId);
    let sql='SELECT c.* FROM conversations c WHERE c.owner_id=? AND c.is_archived=?';
    const binds=[user.id,includeArchived?1:0];
    if (projectId) {sql+=' AND c.project_id=?'; binds.push(projectId);}
    if (q) {
      sql+=` AND (c.title LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.content LIKE ? ESCAPE '\\'))`;
      const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%'; binds.push(pattern,pattern);
    }
    sql+=' ORDER BY c.is_pinned DESC, c.updated_at DESC LIMIT 150';
    const rs=await env.DB.prepare(sql).bind(...binds).all();
    return json({chats:rs.results||[]});
  }
  if (path === '/api/chats' && method === 'POST') {
    const body=await bodyJSON(request);
    const kind=CHAT_KINDS.includes(body.kind)?body.kind:'chat';
    const model=chooseModel(body.model);
    const projectId=body.project_id || null;
    if (projectId) await requireProject(env,user,projectId);
    const id=crypto.randomUUID();
    const saved = await env.DB.prepare('INSERT INTO conversations(id,owner_id,project_id,kind,model) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM conversations WHERE owner_id=?) < 500')
      .bind(id,user.id,projectId,kind,model,user.id).run();
    if (!saved.meta?.changes) throw new InputError('Conversation limit reached (500 per account).',429);
    return json({id,kind,model},201);
  }
  const chatMatch=path.match(/^\/api\/chats\/([^/]+)$/);
  if (chatMatch) {
    const chat=await requireChat(env,user,chatMatch[1]);
    if (method==='GET') {
      const rs=await env.DB.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY seq ASC LIMIT 150').bind(chat.id).all();
      return json({chat,messages:rs.results||[]});
    }
    if (method==='PATCH') {
      const body=await bodyJSON(request);
      const title=body.title === undefined? chat.title : checkString(body.title,100,'Title');
      const pinned=body.is_pinned===undefined?chat.is_pinned:body.is_pinned?1:0;
      const archived=body.is_archived===undefined?chat.is_archived:body.is_archived?1:0;
      const projectId=body.project_id===undefined?chat.project_id:(body.project_id || null);
      if (projectId) await requireProject(env,user,projectId);
      await env.DB.prepare("UPDATE conversations SET title=?,is_pinned=?,is_archived=?,project_id=?,updated_at=datetime('now') WHERE id=? AND owner_id=?")
        .bind(title,pinned,archived,projectId,chat.id,user.id).run();
      return json({ok:true});
    }
    if (method==='DELETE') {
      // Rely on D1 SQLite foreign keys (enabled by default): removes child messages/requests.
      await env.DB.prepare('DELETE FROM conversations WHERE id=? AND owner_id=?').bind(chat.id,user.id).run();
      return json({ok:true});
    }
  }
  const messagesMatch=path.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (messagesMatch && method==='POST') {
    const chat=await requireChat(env,user,messagesMatch[1]);
    return generate(request,env,user,chat);
  }
  const retryMatch=path.match(/^\/api\/chats\/([^/]+)\/retry$/);
  if (retryMatch && method==='POST') {
    const chat=await requireChat(env,user,retryMatch[1]);
    return generate(request,env,user,chat,true);
  }
  const branchMatch=path.match(/^\/api\/chats\/([^/]+)\/branch$/);
  if (branchMatch && method==='POST') {
    const chat=await requireChat(env,user,branchMatch[1]);
    const body=await bodyJSON(request);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO conversations(id,owner_id,project_id,kind,title,model) VALUES(?,?,?,?,?,?)')
      .bind(id,user.id,chat.project_id,chat.kind,(chat.title||'Untitled chat')+' (branch)',chat.model).run();
    const source=await env.DB.prepare('SELECT role,content,status FROM messages WHERE conversation_id=? ORDER BY seq ASC LIMIT 100').bind(chat.id).all();
    const messages = source.results || [];
    const limit = body.upto_message_id;
    // Default copies the whole chat; the optional cutoff is kept for future message-menu branching.
    const selected = limit?messages.slice(0, Math.min(messages.length,Math.max(0,Number(limit)))):messages;
    for (const item of selected) {
      await env.DB.prepare('INSERT INTO messages(id,conversation_id,role,content,status) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),id,item.role,item.content,item.status).run();
    }
    return json({id},201);
  }
  if (path === '/api/usage' && method === 'GET') {
    const daily=await env.DB.prepare(`SELECT substr(created_at,1,10) AS date, count(*) AS requests,
      sum(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      sum(input_tokens) AS reported_input_tokens, sum(output_tokens) AS reported_output_tokens
      FROM ai_requests WHERE owner_id=? AND created_at>=datetime('now','-30 day')
      GROUP BY substr(created_at,1,10) ORDER BY date DESC`).bind(user.id).all();
    const total=await env.DB.prepare(`SELECT COUNT(*) AS total_requests,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_requests,
      SUM(CASE WHEN input_tokens IS NOT NULL THEN 1 ELSE 0 END) AS metered_requests
      FROM ai_requests WHERE owner_id=?`).bind(user.id).first();
    return json({daily:daily.results||[],total,accounting:'Requests counted from D1; tokens shown only when provider supplies usage. Cloudflare billing/neurons are not calculated here.'});
  }
  return err('Not found',404);
}
export default {
  async fetch(request,env) {
    const p=new URL(request.url).pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.DB || !env.AI) return err('Worker bindings are missing: DB and AI required',503);
    if (request.method==='OPTIONS') return err('CORS preflight not supported',405);
    try {
      const user=await verifyAccess(request,env);
      if (!user) return unauthenticated();
      await userSync(env,user);
      return await handle(request,env,user);
    } catch(e) {
      if (e instanceof InputError) return err(e.message,e.status||400);
      console.error('API request failed', e instanceof Error ? e.message : 'unknown');
      return err('Internal server error',500);
    }
  },
};
