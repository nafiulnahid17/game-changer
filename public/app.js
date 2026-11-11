const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
  flask:'<path d="M9 3h6M10 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3M8 16h8"/>',
  puzzle:'<path d="M19 13v7a1 1 0 0 1-1 1h-5v-2a2 2 0 0 0-4 0v2H4a1 1 0 0 1-1-1v-5h2a2 2 0 0 0 0-4H3V6a1 1 0 0 1 1-1h5V3a2 2 0 0 1 4 0v2h5a1 1 0 0 1 1 1v5h2a2 2 0 0 1 0 4h-2Z"/>',
  chart:'<path d="M4 21v-7h4v7M10 21V4h4v17M16 21v-11h4v11"/>',
  'credit-card':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
  'message-circle':'<path d="M20 11.5a8 8 0 0 1-12.3 6.7L3 20l1.8-4.5A8 8 0 1 1 20 11.5Z"/>',
  clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 12h6M9 16h5"/>',
  settings:'<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  star:'<path d="m12 2 2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2Z"/>',
  'code-2':'<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-13-3 18"/>',
  folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9m-10 5h6"/>',
  pin:'<path d="m15 3 6 6-3 1-4 4v4l-2 2-4-6-5-5 2-2h4l4-4 2-3Z"/>',
  trash:'<path d="M4 7h16m-13 0 1 14h8l1-14M9 7V4h6v3M10 11v7m4-7v7"/>',
  'pen-line':'<path d="m5 19 4-.8L20 7a2.2 2.2 0 0 0-3-3L6 15l-1 4Zm10-13 3 3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  'git-branch':'<circle cx="7" cy="4" r="2"/><circle cx="17" cy="17" r="2"/><circle cx="7" cy="20" r="2"/><path d="M7 6v12M17 15v-4a4 4 0 0 0-4-4H7"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
  'file-text':'<path d="M6 2h9l5 5v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM14 2v6h6M8 13h8M8 17h8"/>',
};
function ic(name){return `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.star}</svg>`;}
function esc(v){return String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const state={me:null,projects:[],chats:[],current:null,messages:[],page:'home',model:'@cf/openai/gpt-oss-120b',sending:false,streamAbort:null,homeKind:'chat',searchTerm:'',activeProject:null};
const $=sel=>document.querySelector(sel);
const main=$('#main');
async function api(path,opts={}){
  const config={headers:{...(opts.body!==undefined?{'content-type':'application/json'}:{}),...(opts.headers||{})},credentials:'same-origin',...opts};
  const response=await fetch('/api'+path,config);
  if(!response.ok){let info;try{info=await response.json();}catch{}throw new Error(info?.error || `Request failed (${response.status})`)}
  if(opts.stream)return response;
  return response.json();
}
function showToast(message){const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>node.hidden=true,4500)}
function modelOptions(){return `<option value="@cf/openai/gpt-oss-120b" ${state.model==='@cf/openai/gpt-oss-120b'?'selected':''}>GPT-OSS 120B</option><option value="@cf/openai/gpt-oss-20b" ${state.model==='@cf/openai/gpt-oss-20b'?'selected':''}>GPT-OSS 20B</option>`}
function prettyKind(kind){return ({chat:'Chat',plan:'Plan',research:'Research'})[kind]||'Chat'}
function kindIcon(kind){return ({chat:'message-circle',plan:'clipboard',research:'flask'})[kind]||'message-circle'}
function setSidebarActive(page){document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));}
function titleForChat(c){return c.title || `New ${prettyKind(c.kind)}`}
function renderRecents(){const node=$('#recentChats');const recent=state.chats.filter(c=>!c.is_archived).slice(0,40);node.innerHTML=recent.length?recent.map(c=>`<button class="recent-item ${state.current?.id===c.id?'active':''}" data-go="/chat/${esc(c.id)}" title="${esc(titleForChat(c))}">${ic(kindIcon(c.kind))}<span class="recent-name">${esc(titleForChat(c))}</span>${c.is_pinned?'<span class="pin-dot">●</span>':''}</button>`).join(''):`<span class="side-note">No conversations yet. Use New Chat, New Plan or New Research.</span>`;}
async function refreshLists(){const [projects,chats]=await Promise.all([api('/projects'),api('/chats')]);state.projects=projects.projects;state.chats=chats.chats;renderRecents();}
function pathname(){return decodeURI(location.pathname)}
function go(path,replace=false){if(replace)history.replaceState({},'',path);else history.pushState({},'',path);hideSidebar();return renderRoute().catch(e=>failure(e.message))}
function hideSidebar(){$('#sidebar').classList.remove('open');$('#mobileShade').classList.remove('open')}
function failure(msg){main.innerHTML=`<div class="inner-page"><div class="surface empty-state"><div class="empty-icon">${ic('settings')}</div><h3>Workspace unavailable</h3><p>${esc(msg)}</p><button class="button primary" id="reloadApp">Try again</button></div></div>`;}
function setBreadcrumb(text){ $('#pageBreadcrumb').textContent=text;}
async function renderRoute(){const path=pathname();state.activeProject=null;state.current=null;state.messages=[];if(path.startsWith('/chat/')){const id=path.split('/')[2];await loadChat(id);return;}
 if(path.startsWith('/project/')){state.page='projects';state.activeProject=path.split('/')[2];setSidebarActive('projects');setBreadcrumb('Project');await renderProject(state.activeProject);return;}
 const views={'/':'home','/projects':'projects','/research':'research','/plugins':'plugins','/usage':'usage','/billing':'billing','/profile':'profile','/archive':'archive'};
 state.page=views[path]||'home';setSidebarActive(state.page);setBreadcrumb(state.page[0].toUpperCase()+state.page.slice(1));renderRecents();
 if(state.page==='home')renderHome();if(state.page==='projects')renderProjects();if(state.page==='research')renderResearch();if(state.page==='plugins')renderPlugins();if(state.page==='billing')renderBilling();if(state.page==='profile')renderProfile();if(state.page==='usage')await renderUsage();if(state.page==='archive')await renderArchive();
}
function composer(id='home',kind='chat'){
 return `<form class="composer" data-composer="${esc(id)}"><textarea name="message" maxlength="12000" rows="2" placeholder="${kind==='plan'?'Describe what you want to plan…':kind==='research'?'What would you like to investigate?':'Message Game Changer…'}" aria-label="Message Game Changer" required></textarea><div class="composer-toolbar"><div class="composer-tools-left"><span class="mode-pill">${ic(kindIcon(kind))}${prettyKind(kind)}</span><span class="composer-hint">Enter to send · Shift+Enter for line break</span></div><div class="composer-tools-right"><label><span class="sr-only" style="position:absolute;left:-9999px">AI model</span><select aria-label="Choose AI model" class="model-select" data-model>${modelOptions()}</select></label><button class="send-btn" type="submit" aria-label="Send message">${ic('send')}</button></div></div></form>`;
}
function renderHome(){const name=state.me?.display_name?.split(' ')[0];const welcome=name?`Welcome back, <span>${esc(name)}</span>.`:'What will you create <span>today?</span>';
 main.innerHTML=`<div class="home-wrapper"><section class="hero"><div class="hero-copy"><span class="eyebrow"><span class="dot"></span> AI-POWERED DEVELOPMENT WORKSPACE</span><h1>Game <em>Changer.</em></h1><p>Think bigger. Build smarter. Your workspace for coding, technical planning, research and ambitious projects.</p><div class="hero-actions"><button class="button primary" data-create="chat">${ic('plus')} New Chat</button><button class="button" data-create="plan">${ic('clipboard')} New Plan</button><button class="button" data-create="research">${ic('flask')} New Research</button></div></div><div class="hero-3d" aria-hidden="true"><div class="glow-ring"></div><div class="glass-plate back"></div><div class="glass-plate"></div><div class="hero-letter">A</div><div class="float-sphere"></div></div></section>
 <section class="workspace-panel"><div class="small-topline">GAME CHANGER AI</div><h2>${welcome}</h2><p>Ask anything, plan your next product, or explore a new idea.</p>${composer('home',state.homeKind)}</section>
 <div class="quick-grid"><button class="quick-card" data-create="chat"><span class="quick-icon">${ic('code-2')}</span><span><strong>Build with AI</strong><small>Design, code, debug and improve your software.</small></span></button><button class="quick-card" data-create="plan"><span class="quick-icon">${ic('clipboard')}</span><span><strong>Research & Plan</strong><small>Create architecture, roadmaps and engineering plans.</small></span></button><button class="quick-card" data-create="research"><span class="quick-icon">${ic('flask')}</span><span><strong>Explore & Investigate</strong><small>Analyze ideas without claiming live web access.</small></span></button></div>
 <div class="section-header"><h3>Your Projects</h3><button class="text-action" data-go="/projects">Manage projects →</button></div><div class="home-projects">${state.projects.length?state.projects.slice(0,8).map(p=>`<button class="project-tile" data-go="/project/${esc(p.id)}"><span class="project-glyph">${esc(p.name.slice(0,1).toUpperCase())}</span><span style="min-width:0"><strong>${esc(p.name)}</strong><small>Open project</small></span></button>`).join(''):`<div class="empty-projects">No projects created yet. <button class="text-action" data-modal="create-project">Create your first project</button></div>`}</div></div>`;
}
function renderChatMessages(){const box=$('#messagesContainer');if(!box)return;
 if(!state.messages.length){box.innerHTML=`<div class="empty-chat"><div class="chat-empty-mark">A</div><h2>Start a ${esc(prettyKind(state.current.kind)).toLowerCase()}</h2><p>${state.current.kind==='research'?'AI-guided analysis is available. Live internet research is not connected yet.':state.current.kind==='plan'?'Tell me your goal. I can help create an actionable development plan.':'Ask a question, paste some code, or describe your next project.'}</p></div>`;return;}
 box.innerHTML=state.messages.map(m=>messageHTML(m)).join('')+(state.messages.at(-1)?.role==='user'?`<div class="message-actions" style="margin-left:auto"><button data-retry>Retry AI response</button></div>`:'');box.scrollTop=box.scrollHeight;
}
function safeInline(txt){return esc(txt).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code style="background:#f4effa;border-radius:5px;padding:2px 4px">$1</code>');}
function safeMarkdown(raw){
 const chunks=String(raw??'').split(/(```[^\n]*\n[\s\S]*?```)/g);
 return chunks.map(x=>{
   if(x.startsWith('```') && x.trimEnd().endsWith('```')){
     const matched=x.match(/^```([^\n]*)\n([\s\S]*?)```$/);
     if(matched)return `<div class="code-wrap"><div class="code-head"><span>${esc(matched[1].trim()||'Code')}</span><button type="button" class="copy-code">Copy code</button></div><pre><code>${esc(matched[2])}</code></pre></div>`;
   }
   return x.split(/\n{2,}/).map(block=>{
     if(!block.trim())return '';
     const lines=block.split('\n');
     return lines.map(line=>{
       const h=line.match(/^(#{1,3})\s+(.+)/);
       if(h)return `<h3>${safeInline(h[2])}</h3>`;
       if(/^\s*[-*]\s+/.test(line))return `<div style="padding-left:13px">• ${safeInline(line.replace(/^\s*[-*]\s+/,''))}</div>`;
       return safeInline(line);
     }).join('<br>');
   }).map(s=>`<p>${s}</p>`).join('');
 }).join('');
}
function messageHTML(msg){if(msg.role==='user')return `<div class="message user">${esc(msg.content)}</div>`;
 return `<div class="message assistant"><div class="message-title"><span class="assistant-avatar">A</span>Game Changer ${msg.status==='interrupted'?'<span class="pill">Interrupted</span>':''}</div><div class="rendered-text">${safeMarkdown(msg.content)}</div><div class="message-actions"><button data-copy-message="${esc(msg.id||'')}">Copy answer</button>${msg.status==='interrupted'?'<button data-retry>Retry response</button>':''}</div></div>`;
}
async function loadChat(id){state.page='chat';setSidebarActive('');setBreadcrumb('Conversation');main.innerHTML=`<div class="initial-load"><div class="spinner"></div>Opening conversation…</div>`;
 const result=await api('/chats/'+encodeURIComponent(id));if(pathname()!==`/chat/${id}`)return;state.current=result.chat;state.messages=result.messages;state.model=result.chat.model;setBreadcrumb(titleForChat(result.chat));renderRecents();
 main.innerHTML=`<div class="chat-screen"><div class="chat-toolbar"><div class="left-group"><button class="icon-btn" data-go="/" title="Home">${ic('home')}</button><h2 id="chatTitle">${esc(titleForChat(state.current))}</h2><span class="chat-kind">${esc(prettyKind(state.current.kind))}${state.current.kind==='research'?' · No live web':''}</span></div><div class="chat-tool-right"><button class="chat-tool-btn" data-chat-action="branch" title="Duplicate conversation">${ic('git-branch')}<span class="label-hide"> Branch</span></button><button class="chat-tool-btn" data-chat-action="export" title="Export Markdown">${ic('download')}<span class="label-hide"> Export</span></button><button class="chat-tool-btn" data-chat-action="settings" title="Conversation settings">${ic('settings')}<span class="label-hide"> Settings</span></button></div></div><div class="chat-messages" id="messagesContainer" aria-live="polite"></div><div class="chat-bottom">${composer('chat',state.current.kind)}<div class="fineprint">AI can make mistakes. Review generated code before deploying.</div></div></div>`;
 renderChatMessages();main.querySelector('textarea')?.focus();
}
function renderProjects(){main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Projects</h1><p>Keep conversations and project-specific context organized.</p></div><button class="button primary" data-modal="create-project">${ic('plus')} New Project</button></div>${state.projects.length?`<div class="cards-grid">${state.projects.map(p=>`<button class="data-card" data-go="/project/${esc(p.id)}"><div class="tile-line"><span class="project-glyph">${esc(p.name.slice(0,1).toUpperCase())}</span>${ic('arrow')}</div><div><h3>${esc(p.name)}</h3><p>${p.instructions?'Custom instructions enabled':'No project instructions'}</p></div><span class="card-meta">Open project →</span></button>`).join('')}</div>`:`<div class="surface empty-state"><div class="empty-icon">${ic('folder')}</div><h3>No projects yet</h3><p>Create a project to group your research, plans and conversations.</p><button class="button primary" data-modal="create-project">${ic('plus')} Create Project</button></div>`}</div>`;}
async function renderProject(id){const project=state.projects.find(p=>p.id===id);if(!project){failure('Project not found');return;}
 const data=await api('/chats?project='+encodeURIComponent(id));if(pathname()!==`/project/${id}`)return;
 setBreadcrumb(project.name);main.innerHTML=`<div class="inner-page"><div class="page-head"><div><button class="text-action" data-go="/projects">← All projects</button><h1>${esc(project.name)}</h1><p>Project-specific chats and instructions.</p></div><button class="button" data-project-edit="${esc(id)}">${ic('settings')} Project Settings</button></div><div class="surface"><div class="section-header"><h3>Conversations</h3><button class="button primary small-btn" data-create="chat" data-project="${esc(id)}">${ic('plus')} New Project Chat</button></div>${data.chats.length?`<div class="project-list">${data.chats.map(c=>`<div class="project-list-item"><span class="item-name">${ic(kindIcon(c.kind))}<span><strong>${esc(titleForChat(c))}</strong><br><small>${esc(prettyKind(c.kind))}</small></span></span><button data-go="/chat/${esc(c.id)}">Open →</button></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${ic('message-circle')}</div><h3>Nothing here yet</h3><p>Start a conversation linked to this project.</p></div>`}</div></div>`;
}
function renderResearch(){const research=state.chats.filter(c=>c.kind==='research');main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Research</h1><p>Analyze topics, compare ideas and structure evidence with AI assistance.</p></div><button class="button primary" data-create="research">${ic('plus')} New Research</button></div><div class="notice"><strong>No live internet browsing yet.</strong> Research mode currently works with the model's existing knowledge and information you provide. New web-search integrations can be added later.</div><div class="surface" style="margin-top:19px"><h3 style="margin:0 0 18px;font-size:16px">Research conversations</h3>${research.length?`<div class="project-list">${research.map(c=>`<div class="project-list-item"><span class="item-name">${ic('flask')}<strong>${esc(titleForChat(c))}</strong></span><button data-go="/chat/${esc(c.id)}">Open →</button></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${ic('flask')}</div><h3>No research yet</h3><p>Start your first research conversation.</p><button class="button primary" data-create="research">Start research</button></div>`}</div></div>`;}
function renderPlugins(){main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Plugins</h1><p>External tools and integrations.</p></div></div><div class="surface empty-state"><div class="empty-icon">${ic('puzzle')}</div><h3>No integrations connected</h3><p>This deployment does not have a plugin registry or external tool authentication configured. No plugins are shown as installed or working.</p><div class="notice">Future connectors should require explicit user authorization and secure server-side credential storage.</div></div></div>`;}
async function renderArchive(){main.innerHTML=`<div class="initial-load"><div class="spinner"></div>Reading archived conversations…</div>`;const data=await api('/chats?archived=1');if(pathname()!=='/archive')return;
 main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Archived Chats</h1><p>Archived conversations are preserved and can be reopened or unarchived.</p></div></div><div class="surface">${data.chats.length?`<div class="project-list">${data.chats.map(c=>`<div class="project-list-item"><span class="item-name">${ic(kindIcon(c.kind))}<span><strong>${esc(titleForChat(c))}</strong><br><small>${esc(prettyKind(c.kind))}</small></span></span><button data-go="/chat/${esc(c.id)}">Open →</button></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${ic('archive')}</div><h3>No archived conversations</h3><p>When you archive a chat, it will appear here.</p></div>`}</div></div>`;
}
function renderBilling(){main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Billing</h1><p>Your workspace subscription and payment details.</p></div></div><div class="surface empty-state"><div class="empty-icon">${ic('credit-card')}</div><h3>Billing is not configured</h3><p>No payment provider, subscription plan, invoices or billing account have been connected. There are no sample charges or invented subscriptions here.</p><div class="notice">Cloudflare Workers AI free allocation is managed in your Cloudflare account, not billed from this interface. For real usage data, open Usage.</div><button class="button" data-go="/usage" style="margin-top:16px">${ic('chart')} View Request Usage</button></div></div>`;}
async function renderUsage(){main.innerHTML=`<div class="initial-load"><div class="spinner"></div>Reading real request logs…</div>`;const data=await api('/usage');if(pathname()!=='/usage')return;
 const completed=Number(data.total?.completed_requests||0);const total=Number(data.total?.total_requests||0);const metered=Number(data.total?.metered_requests||0);
 main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Usage</h1><p>Real inference requests recorded by the Game Changer backend.</p></div></div><div class="usage-summary"><div class="metric"><label>Total requests</label><strong>${total.toLocaleString()}</strong></div><div class="metric"><label>Completed</label><strong>${completed.toLocaleString()}</strong></div><div class="metric"><label>Requests with token usage reported</label><strong>${metered.toLocaleString()}</strong></div></div><div class="surface"><h3 style="margin:0 0 6px">Last 30 days</h3><p class="hint-note">${esc(data.accounting)}</p>${data.daily.length?`<div style="overflow:auto"><table class="usage-table"><thead><tr><th>Date (UTC)</th><th>Requests</th><th>Completed</th><th>Input tokens reported</th><th>Output tokens reported</th></tr></thead><tbody>${data.daily.map(r=>`<tr><td>${esc(r.date)}</td><td>${Number(r.requests||0)}</td><td>${Number(r.completed||0)}</td><td>${r.reported_input_tokens==null?'Not available':Number(r.reported_input_tokens).toLocaleString()}</td><td>${r.reported_output_tokens==null?'Not available':Number(r.reported_output_tokens).toLocaleString()}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><div class="empty-icon">${ic('chart')}</div><h3>No AI requests yet</h3><p>Your first AI request will appear here after it is recorded in the database.</p></div>`}</div></div>`;
}
function renderProfile(){const me=state.me.user||state.me;main.innerHTML=`<div class="inner-page"><div class="page-head"><div><h1>Profile</h1><p>Identity verified by Cloudflare Access.</p></div></div><div class="surface profile-form"><form id="profileForm"><div class="field"><label for="displayName">Display name</label><input id="displayName" name="display_name" maxlength="80" required value="${esc(me.display_name||'')}" placeholder="Your name"></div><div class="field"><label for="accountEmail">Account email</label><input id="accountEmail" disabled value="${esc(me.email||'Email not supplied by identity provider')}"></div><p class="hint-note">Your account ID comes from the verified Cloudflare Access token. Sign-in settings and MFA are managed from Cloudflare Zero Trust.</p><button class="button primary" type="submit">Save Profile</button></form></div></div>`;}
async function createChat(kind='chat',projectId=null){if(!['chat','plan','research'].includes(kind))kind='chat';const data=await api('/chats',{method:'POST',body:JSON.stringify({kind,model:state.model,project_id:projectId})});await refreshLists();await go('/chat/'+data.id);return data.id;}
function modal(title,inner,actions=''){const root=$('#dialogRoot');root.innerHTML=`<div class="modal-shade" id="modalShade"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${inner}${actions}</div></div>`;root.querySelector('input,textarea,button')?.focus();root.querySelector('#modalShade').addEventListener('mousedown',e=>{if(e.target.id==='modalShade')closeModal()});}
function closeModal(){$('#dialogRoot').innerHTML='';}
function projectModal(project=null){modal(project?'Project Settings':'Create Project',`<form id="projectForm"><div class="field"><label>Project name</label><input name="name" maxlength="80" required value="${esc(project?.name||'')}" placeholder="e.g. LexGlobal BD" autofocus></div><div class="field"><label>Project instructions ${project?'':'(available after creating)'}</label><textarea name="instructions" maxlength="6000" ${project?'':'disabled'} placeholder="Context and rules for AI replies in this project…">${esc(project?.instructions||'')}</textarea></div><div class="modal-actions"><button class="button" type="button" data-close-modal>Cancel</button>${project?'<button class="button danger-button" type="button" id="deleteProject">Delete Project</button>':''}<button class="button primary" type="submit">${project?'Save Changes':'Create Project'}</button></div></form>`);
 const form=$('#projectForm');form.addEventListener('submit',async e=>{e.preventDefault();const name=form.elements.name.value, instructions=form.elements.instructions.value;try{if(project)await api('/projects/'+project.id,{method:'PATCH',body:JSON.stringify({name,instructions})});else await api('/projects',{method:'POST',body:JSON.stringify({name})});closeModal();await refreshLists();await renderRoute();showToast(project?'Project updated':'Project created')}catch(ex){showToast(ex.message)}});
 $('#deleteProject')?.addEventListener('click',async()=>{if(!confirm('Delete project? Chats will be preserved outside the project.'))return;try{await api('/projects/'+project.id,{method:'DELETE'});closeModal();await refreshLists();go('/projects');showToast('Project deleted; chats preserved.')}catch(ex){showToast(ex.message)}});
}
function chatSettingsModal(){const c=state.current;if(!c)return;modal('Conversation settings',`<form id="chatSettingsForm"><div class="field"><label>Conversation title</label><input name="title" maxlength="100" required value="${esc(titleForChat(c))}"></div><div class="field"><label>Move to project</label><select name="project_id"><option value="">No project</option>${state.projects.map(p=>`<option value="${esc(p.id)}" ${p.id===c.project_id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap"><button class="button danger-button" type="button" id="deleteChat">${ic('trash')} Delete</button><span style="display:flex;gap:8px"><button class="button" type="button" id="togglePin">${ic('pin')} ${c.is_pinned?'Unpin':'Pin'}</button><button class="button" type="button" id="toggleArchive">${ic('archive')} ${c.is_archived?'Unarchive':'Archive'}</button><button class="button primary" type="submit">Save</button></span></div></form>`);
 $('#chatSettingsForm').addEventListener('submit',async e=>{e.preventDefault();try{const f=e.currentTarget;await updateChat(c.id,{title:f.elements.title.value,project_id:f.elements.project_id.value||null});closeModal();showToast('Conversation updated')}catch(ex){showToast(ex.message)}});
 $('#togglePin').addEventListener('click',async()=>{try{await updateChat(c.id,{is_pinned:!c.is_pinned});closeModal()}catch(ex){showToast(ex.message)}});
 $('#toggleArchive').addEventListener('click',async()=>{try{await updateChat(c.id,{is_archived:!c.is_archived});closeModal();if(!c.is_archived)go('/')}catch(ex){showToast(ex.message)}});
 $('#deleteChat').addEventListener('click',async()=>{if(!confirm('Permanently delete this conversation and its messages?'))return;try{await api('/chats/'+c.id,{method:'DELETE'});closeModal();await refreshLists();go('/');showToast('Conversation deleted')}catch(ex){showToast(ex.message)}});
}
async function updateChat(id,patch){await api('/chats/'+id,{method:'PATCH',body:JSON.stringify(patch)});await refreshLists();if(pathname()==='/chat/'+id)await loadChat(id);}
function downloadText(filename,content){const blob=new Blob([content],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function exportChat(){if(!state.current)return;const lines=[`# ${titleForChat(state.current)}`,`Kind: ${prettyKind(state.current.kind)}`,`Model: ${state.current.model}`,'',...state.messages.flatMap(m=>[`## ${m.role==='user'?'You':'Game Changer'}`,'',m.content,''])];downloadText('game-changer-chat-'+state.current.id.slice(0,8)+'.md',lines.join('\n'));showToast('Chat exported as Markdown');}
async function chatAction(action){if(!state.current)return;if(action==='settings')chatSettingsModal();else if(action==='export')exportChat();else if(action==='branch'){try{const c=await api('/chats/'+state.current.id+'/branch',{method:'POST',body:JSON.stringify({})});await refreshLists();go('/chat/'+c.id);showToast('New branch created')}catch(e){showToast(e.message)}}}
function updateComposerDisabled(){document.querySelectorAll('.composer .send-btn,.composer textarea,.composer select').forEach(el=>el.disabled=state.sending);}
async function sendMessage(text,retry=false){if(!state.current)return;const id=state.current.id;if(state.sending)return;
 state.sending=true;state.streamAbort=new AbortController();if(!retry)state.messages.push({role:'user',content:text,id:crypto.randomUUID(),status:'completed'});
 const aiMsg={role:'assistant',content:'',id:'live',status:'completed'};state.messages.push(aiMsg);renderChatMessages();updateComposerDisabled();
 const loading=$('#messagesContainer');if(loading){const el=loading.querySelector('.message.assistant:last-child .rendered-text');if(el)el.innerHTML=`<div class="loading-message"><div class="spinner"></div>Thinking…</div>`;}
 try{
  const url='/chats/'+id+(retry?'/retry':'/messages');const resp=await api(url,{method:'POST',body:JSON.stringify(retry?{model:state.model}:{content:text,model:state.model}),stream:true,signal:state.streamAbort.signal});
  const reader=resp.body.getReader(),dec=new TextDecoder();let buffer='',errorMessage='';
  for(;;){const {value,done}=await reader.read();if(done)break;buffer+=dec.decode(value,{stream:true}).replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);let event='message',data=null;for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:')){try{data=JSON.parse(line.slice(5).trim())}catch{}}}
     if(event==='delta'&&data?.text){aiMsg.content+=data.text;const last=$('#messagesContainer .message.assistant:last-child .rendered-text');if(last)last.innerHTML=safeMarkdown(aiMsg.content);const sc=$('#messagesContainer');if(sc)sc.scrollTop=sc.scrollHeight;}
     if(event==='error')errorMessage=data?.message||'AI stream interrupted';
  }}
  if(errorMessage)showToast(errorMessage);else if(!aiMsg.content.trim())showToast('No response returned. Use Retry.');
 }catch(ex){if(ex.name!=='AbortError')showToast(ex.message);else showToast('Request cancelled on this device.');}
 finally{state.sending=false;state.streamAbort=null;try{await refreshLists();if(pathname()==='/chat/'+id)await loadChat(id)}catch(e){showToast('Could not refresh message history: '+e.message)}updateComposerDisabled();}
}
async function retryMessage(){if(!state.current||state.sending)return;await sendMessage('',true);}
function searchModal(){modal('Search conversations',`<input id="searchQuery" class="search-input" placeholder="Search chat titles and messages…" autocomplete="off"><div class="search-results" id="searchResults"><span class="muted" style="font-size:12px;padding:14px">Start typing to search your saved conversations.</span></div>`);const input=$('#searchQuery');let serial=0;input.addEventListener('input',async()=>{const term=input.value.trim();const n=++serial;if(!term){$('#searchResults').innerHTML='<span class="muted" style="font-size:12px;padding:14px">Start typing…</span>';return}try{const data=await api('/chats?q='+encodeURIComponent(term));if(n!==serial)return;$('#searchResults').innerHTML=data.chats.length?data.chats.map(c=>`<button class="search-hit" data-search-open="${esc(c.id)}">${ic(kindIcon(c.kind))}<span>${esc(titleForChat(c))}</span><small class="muted">${esc(prettyKind(c.kind))}</small></button>`).join(''):'<span class="muted" style="font-size:12px;padding:14px">No matches found.</span>';}catch(e){if(n===serial)$('#searchResults').textContent=e.message}});input.focus();}
function attachIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=ic(el.dataset.icon));}
function openMobileSidebar(){$('#sidebar').classList.add('open');$('#mobileShade').classList.add('open')}
async function boot(){attachIcons();try{const info=await api('/me');state.me=info.user;state.model=info.models[0].id;const initial=(info.user.display_name||info.user.email||'A').trim().charAt(0).toUpperCase();$('#topProfile').textContent=initial;await refreshLists();await renderRoute()}catch(ex){failure(ex.message+' — Check Cloudflare Access configuration, sign-in and database bindings.');}}
// Event delegation handles newly rendered content without duplicated listeners.
document.addEventListener('click',async e=>{
 const link=e.target.closest('a[data-link]');if(link){e.preventDefault();go(link.getAttribute('href'));return;}
 const nav=e.target.closest('[data-go]');if(nav){go(nav.dataset.go);return;}
 const create=e.target.closest('[data-create]');if(create){try{await createChat(create.dataset.create,create.dataset.project||null)}catch(ex){showToast(ex.message)}return;}
 const modalButton=e.target.closest('[data-modal]');if(modalButton?.dataset.modal==='create-project'){projectModal();return;}
 const edit=e.target.closest('[data-project-edit]');if(edit){projectModal(state.projects.find(p=>p.id===edit.dataset.projectEdit));return;}
 const chatButton=e.target.closest('[data-chat-action]');if(chatButton){await chatAction(chatButton.dataset.chatAction);return;}
 const close=e.target.closest('[data-close-modal]');if(close){closeModal();return;}
 const open=e.target.closest('[data-search-open]');if(open){closeModal();go('/chat/'+open.dataset.searchOpen);return;}
 const copyCode=e.target.closest('.copy-code');if(copyCode){const text=copyCode.closest('.code-wrap').querySelector('code').textContent;try{await navigator.clipboard.writeText(text);showToast('Code copied')}catch{showToast('Clipboard not available')}return;}
 const copyMsg=e.target.closest('[data-copy-message]');if(copyMsg){const found=state.messages.find(m=>m.id===copyMsg.dataset.copyMessage);if(found){try{await navigator.clipboard.writeText(found.content);showToast('Answer copied')}catch{showToast('Clipboard not available')}}return;}
 if(e.target.closest('[data-retry]')){await retryMessage();return;}
 if(e.target.closest('#openSearch,#searchRecent')){searchModal();return;}
 if(e.target.closest('#viewArchive')){go('/archive');return;}
 if(e.target.closest('#topProfile,#sidebarSettings')){go('/profile');return;}
 if(e.target.closest('#mobileMenu')){openMobileSidebar();return;}
 if(e.target.closest('#closeSidebar,#mobileShade')){hideSidebar();return;}
 if(e.target.closest('#reloadApp')){await boot();return;}
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('[data-composer]');if(form){e.preventDefault();const t=form.querySelector('textarea'),message=t.value.trim();if(!message||state.sending)return;
  const model=form.querySelector('[data-model]')?.value;if(model)state.model=model;
  if(form.dataset.composer==='home'){
    try{const id=await createChat(state.homeKind);if(pathname()==='/chat/'+id)await sendMessage(message)}catch(ex){showToast(ex.message)}
  }else{t.value='';await sendMessage(message)}return;
 }
 if(e.target.id==='profileForm'){e.preventDefault();const name=e.target.elements.display_name.value.trim();try{await api('/me',{method:'PATCH',body:JSON.stringify({display_name:name})});state.me.display_name=name;$('#topProfile').textContent=name.slice(0,1).toUpperCase();showToast('Profile saved')}catch(ex){showToast(ex.message)}}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&$('#dialogRoot').hasChildNodes())closeModal();
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchModal();}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();createChat('chat').catch(ex=>showToast(ex.message));}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r'){e.preventDefault();createChat('research').catch(ex=>showToast(ex.message));}
 if(e.key==='Enter'&&!e.shiftKey&&e.target.matches('.composer textarea')&&!e.isComposing){e.preventDefault();e.target.closest('form').requestSubmit();}
});
document.addEventListener('input',e=>{if(e.target.matches('.composer textarea')){e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,220)+'px'}});
document.addEventListener('change',e=>{if(e.target.matches('[data-model]'))state.model=e.target.value});
window.addEventListener('popstate',()=>renderRoute().catch(e=>failure(e.message)));
boot();
