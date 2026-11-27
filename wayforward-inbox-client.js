var WF_API_ORIGIN = String(window.WAYFORWARD_API_ORIGIN || '').replace(/\/$/, '');
'use strict';
const $=id=>document.getElementById(id);
const state={logged:false,mobile:'',conversations:[],data:{clients:[],cases:[],tasks:[],today:''},messagesSignature:'',sending:false,closedThroughId:0,closedMobile:'',view:'chat',listFilter:'all',masterScope:'all',masterRows:[],newClient:false,editingCase:null,editingTask:null,loading:false,documents:[],templates:[],localTemplates:[],canReply:false,selectedSavedBody:"",savedMessageAutofill:false};
const fmtDate=d=>d?String(d).slice(0,10):'';
const displayTime=d=>{try{return new Date(d).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'});}catch{return '';}};
const normalized=v=>String(v??'').trim().toLowerCase();
const digits=v=>String(v??'').replace(/\D/g,'');
const validMobile=v=>/^\d{8,15}$/.test(digits(v));
const openTask=t=>!['COMPLETED','CANCELLED'].includes(t.status);
const jobStage=c=>c.workflow_stage||c.stage;
const jobLabel=s=>window.WFPhase3?.label(s)||String(s||'').replaceAll('_',' ');
const openCase=c=>!['COMPLETED','REJECTED','CANCELLED'].includes(jobStage(c));
const currentClient=()=>({...state.conversations.find(c=>c.mobile===state.mobile),...state.data.clients.find(c=>c.mobile===state.mobile)});
const clientName=m=>state.data.clients.find(c=>c.mobile===m)?.client_name||state.conversations.find(c=>c.mobile===m)?.client_name||('+'+m);
const caseById=id=>state.data.cases.find(c=>Number(c.id)===Number(id));
function status(text,isError=false){$('statusText').textContent=text||'';$('statusText').style.color=isError?'#b52b38':'#64748b';}
function alertMsg(text){$('alert').textContent=text||'';$('alert').style.display=text?'block':'none';}
async function api(route,method='GET',payload){
 const res=await fetch(WF_API_ORIGIN+'/api/wayforward/'+route,{method,credentials:'include',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||!body.ok){if(res.status===401)showLogin();throw Error(body.message||'Server error ('+res.status+')');}
 return body;
}
function showLogin(){$('login').style.display='block';$('app').style.display='none';$('logout').style.display='none';state.logged=false;document.dispatchEvent(new CustomEvent('wf3:reset'));}
function showApp(){$('login').style.display='none';$('app').style.display='block';$('logout').style.display='inline-block';state.logged=true;}
function option(select,value,label){select.add(new Option(label,value));}
function setOptions(select,items,placeholder){const previous=select.value;select.replaceChildren(new Option(placeholder,''));items.forEach(x=>option(select,x,x));if([...select.options].some(o=>o.value===previous))select.value=previous;}
function switchView(name){state.view=name;for(const [id,view] of [['chatView','chat'],['profileView','profile'],['casesView','cases'],['followupsView','followups'],['documentsView','documents'],['phase3View','phase3'],['masterView','master'],['billingView','billing']])$(id).classList.toggle('active',view===name);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));document.dispatchEvent(new CustomEvent('wf3f:view',{detail:{name,mobile:state.mobile}}));}
function allKnownClients(){const m=new Map();state.data.clients.forEach(c=>m.set(c.mobile,{...c}));state.conversations.forEach(c=>m.set(c.mobile,{...c,...m.get(c.mobile),mobile:c.mobile,unread:c.unread,last_text:c.last_text,latest_id:c.latest_id,last_at:c.last_at,last_direction:c.last_direction}));return [...m.values()].sort((a,b)=>Number(b.latest_id||0)-Number(a.latest_id||0)||String(a.client_name||'').localeCompare(String(b.client_name||'')));}
function selectKpi(which){document.querySelectorAll('[data-kpi]').forEach(x=>x.classList.toggle('selected',x.dataset.kpi===which));if(which==='today'||which==='overdue'||which==='pending'){$('dueScope').value=which==='pending'?'all':which;switchView('followups');renderFollowups();}else if(which==='cases'){switchView('cases');$('caseScope').value='all';renderCases();}else{state.listFilter='all';switchView('chat');drawList();}}
function drawList(){const target=$('conversations');target.replaceChildren();const q=normalized($('search').value);const items=allKnownClients().filter(c=>{
 const registered=(state.masterRows||[]).find(r=>String(r.linked_mobiles||'').split(',').includes(c.mobile));
 const matches=[c.mobile,c.client_name,c.service,c.assigned_to,c.last_text,registered?.pan,registered?.gstin].some(v=>normalized(v).includes(q));
 const hasChat=!!c.latest_id;const hasJob=state.data.cases.some(k=>k.mobile===c.mobile&&openCase(k));
 if(state.masterScope==='chat'&&!hasChat)return false;
 if(state.masterScope==='jobs'&&!hasJob)return false;
 return matches&&(state.listFilter==='all'||(state.listFilter==='unread'&&Number(c.unread)>0)||(state.listFilter==='open'&&c.conversation_state!=='CLOSED'));
});const standalone=(state.masterScope==='all'&&state.listFilter==='all'?(state.masterRows||[]).filter(r=>!r.linked_mobiles&&!r.primary_mobile&&[r.client_name,r.client_code,r.pan,r.gstin].some(v=>normalized(v).includes(q))):[]);$('total').textContent=String(items.length+standalone.length);
 if(!items.length&&!standalone.length){const div=document.createElement('div');div.className='empty';div.textContent='No matching clients.';target.append(div);return;}
 items.forEach(c=>{
  const unread=Number(c.unread||0);
  const button=document.createElement('button');
  button.type='button';button.className='clientitem'+(c.mobile===state.mobile?' active':'');
  button.setAttribute('aria-label',(c.client_name||('+'+c.mobile))+' conversation'+(unread?' – '+unread+' unread messages':''));
  const avatar=document.createElement('span');avatar.className='chat-avatar'+(unread?' is-unread':'');avatar.setAttribute('aria-hidden','true');
  const name=String(c.client_name||'').trim();
  const initials=name?name.split(/\s+/).slice(0,2).map(w=>w.charAt(0)).join('').toUpperCase():'👤';
  avatar.textContent=initials;
  const details=document.createElement('span');details.className='chat-details';
  const top=document.createElement('span');top.className='chat-top';
  const contact=document.createElement('strong');contact.className='chat-name';contact.textContent=name||('+'+c.mobile);
  const when=document.createElement('span');when.className='chat-time'+(unread?' unread':'');
  if(c.last_at){const date=new Date(c.last_at);if(!Number.isNaN(date.getTime())){
   const today=new Date();when.textContent=date.toDateString()===today.toDateString()?date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}):date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
  }}
  top.append(contact,when);
  const bottom=document.createElement('span');bottom.className='chat-bottom';
  const preview=document.createElement('span');preview.className='chat-preview';
  const message=c.last_text||(!c.latest_id?'No messages yet':'Attachment / media');
  preview.textContent=(c.last_direction==='outbound'?'You: ':'')+message;
  bottom.append(preview);
  if(unread){const count=document.createElement('span');count.className='chat-unread';count.textContent=unread>99?'99+':String(unread);bottom.append(count);}
  details.append(top,bottom);
  const pending=pendingFor(c.mobile);
  if(pending){const flag=document.createElement('span');flag.className='response-chip'+(pending.escalated?' urgent':'');flag.textContent=pending.escalated?'Escalated · '+responseLabel(pending):responseLabel(pending);details.append(flag);}
  if(c.service){const service=document.createElement('span');service.className='chat-service';service.textContent=c.service+(c.assigned_to?' · '+c.assigned_to:'');details.append(service);}
  button.append(avatar,details);button.onclick=()=>selectClient(c.mobile);target.append(button);
 });
 standalone.forEach(r=>{const b=document.createElement('button');b.type='button';b.className='clientitem';const name=document.createElement('strong');name.textContent=r.client_name;const detail=document.createElement('small');detail.textContent=(r.client_code||'Client')+' · Office client · No mobile linked';b.append(name,detail);b.onclick=()=>window.WFMaster?.openMasterOnly(r);target.append(b);});
}
function refreshFilters(){const names=[...new Set([...state.data.cases,...state.data.tasks].map(x=>x.assigned_to).filter(Boolean))].sort();for(const id of ['caseStaffFilter','dueStaffFilter'])setOptions($(id),names,'All staff');}
function getFollowups(){const result=[],today=state.data.today||new Date().toISOString().slice(0,10);
 state.data.cases.filter(c=>openCase(c)&&c.followup_date).forEach(c=>result.push({key:'case-'+c.id,type:'case',id:c.id,caseId:c.id,mobile:c.mobile,caseTitle:c.title,service:c.service,text:c.next_action||'Case follow-up',assigned_to:c.assigned_to||'',date:fmtDate(c.followup_date),stage:jobStage(c)}));

 return result.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
}
function renderKPIs(){const clients=state.data.clients,cases=state.data.cases,tasks=state.data.tasks,due=getFollowups().filter(x=>x.date);const today=state.data.today||new Date().toISOString().slice(0,10);$('kClients').textContent=clients.length;$('kCases').textContent=cases.filter(openCase).length;$('kToday').textContent=due.filter(x=>x.date===today).length;$('kOverdue').textContent=due.filter(x=>x.date<today).length;$('kPending').textContent=tasks.filter(openTask).length;}
function td(row,text){const cell=row.insertCell();cell.textContent=String(text??'');return cell;}
function action(row,title,callback){const cell=row.insertCell(),btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent=title;btn.onclick=callback;cell.append(btn);}
function blankRow(tbody,text,colspan){const tr=tbody.insertRow(),cell=tr.insertCell();cell.colSpan=colspan;cell.className='muted';cell.textContent=text;}
function wf4Due(c){const all=state.data.tasks.filter(t=>Number(t.case_id)===Number(c.id));const active=all.filter(t=>!['COMPLETED','CANCELLED'].includes(t.current_status||t.status));return (active.length?active:all).map(t=>fmtDate(t.due_date)).filter(Boolean).sort()[0]||'';}
function wf4Late(c){const d=wf4Due(c);return openCase(c)&&!!d&&d<(state.data.today||new Date().toISOString().slice(0,10));}
function wf4Match(c,k){return k==='ALL'||(k==='ACTIVE'&&openCase(c))||(k==='OVERDUE'&&wf4Late(c))||(k==='IN_PROGRESS'&&['IN_PROGRESS','ACKNOWLEDGED','REOPENED'].includes(jobStage(c)))||jobStage(c)===k;}
function wf4Tracker(s){const div=document.createElement('div');div.className='wf4-tracker';const step={ASSIGNED:0,ACKNOWLEDGED:1,IN_PROGRESS:1,REOPENED:1,WAITING_CLIENT:1,SUBMITTED_REVIEW:2,COMPLETED:3}[s];if(step===undefined)return div;['Assigned','Progress','Review','Done'].forEach((name,i)=>{const x=document.createElement('span');x.className=i<step?'past':i===step?'current':'';x.textContent=name;div.append(x);});return div;}
async function wf4OpenJob(c){if(state.mobile!==c.mobile)await selectClient(c.mobile);revealRight();window.WFRightDashboard?.show('client');wf3jFilter='ALL';wf3jExpandedJob=c.id;renderClientCases();$('clientCases').querySelector('[aria-expanded="true"]')?.scrollIntoView({block:'nearest'});}
function renderCases(){const tbody=$('caseRows');tbody.replaceChildren();const q=normalized($('caseSearch').value),staff=$('caseStaffFilter').value,onlySelected=$('caseScope').value==='selected';const svc=$('wf4Service');setOptions(svc,[...new Set(state.data.cases.map(c=>c.service).filter(Boolean))].sort(),'All services');const stage=$('wf4CaseStage').value;const base=state.data.cases.filter(c=>(!staff||c.assigned_to===staff)&&(!onlySelected||c.mobile===state.mobile)&&(!svc.value||c.service===svc.value)&&[c.id,c.title,c.service,c.reference_no,c.client_name,c.mobile,c.assigned_to].some(x=>normalized(x).includes(q)));const cases=base.filter(c=>wf4Match(c,stage));const counters=$('wf4CaseCounts');counters.replaceChildren();for(const [k,l] of [['ALL','Total'],['ASSIGNED','Assigned'],['IN_PROGRESS','In Progress'],['WAITING_CLIENT','Waiting'],['SUBMITTED_REVIEW','Review'],['OVERDUE','Overdue'],['COMPLETED','Job Done']]){const x=wf3jButton(counters,l+' ('+base.filter(c=>wf4Match(c,k)).length+')',()=>{$('wf4CaseStage').value=k;renderCases();},'wf3j-filter'+(stage===k?' chosen':''));x.setAttribute('aria-pressed',String(stage===k));}
 if(!cases.length)return blankRow(tbody,'No matching jobs.',6);
 cases.forEach(c=>{const tr=tbody.insertRow();td(tr,clientName(c.mobile)+'\n'+c.title+' · '+c.service).style.whiteSpace='pre-line';td(tr,jobLabel(jobStage(c))+(wf4Late(c)?' · Overdue':''));td(tr,c.assigned_to||'—');const due=td(tr,wf4Due(c)||'—');if(wf4Late(c))due.className='wf4-overdue';td(tr,fmtDate(c.followup_date)||'—');action(tr,'Open',()=>wf4OpenJob(c));});
}

function renderFollowups(){if(window.WF4D){window.WF4D.paintFollow();void window.WF4D.loadFollow();return;}const tbody=$('followupRows');tbody.replaceChildren();const scope=$('dueScope').value,staff=$('dueStaffFilter').value,today=state.data.today||new Date().toISOString().slice(0,10);const rows=getFollowups().filter(x=>(!staff||x.assigned_to===staff)&&(scope==='all'||(scope==='today'&&x.date===today)||(scope==='overdue'&&x.date&&x.date<today)||(scope==='upcoming'&&x.date>today)));
 if(!rows.length)return blankRow(tbody,'No matching follow-ups.',5);
 rows.forEach(x=>{const tr=tbody.insertRow();td(tr,x.date||'No date');td(tr,clientName(x.mobile)+'\n'+x.caseTitle).style.whiteSpace='pre-line';td(tr,x.text);td(tr,x.assigned_to||'Unassigned');if(x.type==='task'){const cell=tr.insertCell(),b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=x.stage.replaceAll('_',' ');b.onclick=()=>openTaskEditor(x.id);cell.append(b);}else action(tr,'Case: '+x.stage.replaceAll('_',' '),()=>openCaseEditor(x.id));});
}
function fillCaseSelect(preferred){const el=$('taskCase');el.replaceChildren(new Option('Select case',''));const rows=state.data.cases.filter(c=>!state.mobile||c.mobile===state.mobile);rows.forEach(c=>option(el,c.id,c.title+' ('+c.service+')'));if(preferred&&[...el.options].some(o=>String(o.value)===String(preferred)))el.value=preferred;}
// Phase 3J: one job card = client case + its linked employee workflow.
let wf3jExpandedJob = null;
let wf3jFilter = 'ACTIVE';
function wf3jRelatedTasks(caseId){
 const all=window.WFPhase3?.getDashboardData?.()?.tasks||[];
 return all.filter(t=>Number(t.case_id)===Number(caseId));
}
function wf3jButton(parent,label,fn,kind='secondary'){
 const button=document.createElement('button');button.type='button';button.className=kind;button.textContent=label;
 button.addEventListener('click',fn);parent.append(button);return button;
}
function wf3jOpenTask(caseId){
 const tasks=wf3jRelatedTasks(caseId);
 if(!tasks.length){status('This historical job has no linked employee assignment. Do not create a duplicate job; check the existing record first.',true);return;}
 const current=tasks.find(t=>!['COMPLETED','CANCELLED'].includes(t.current_status))||tasks[0];
 window.WFPhase3?.openTaskId?.(current.id);
}
function wf3jHistory(caseId){
 // The Phase 3F profile timeline already contains persisted job/task events.
 switchView('profile');
 document.getElementById('wf3fHistory')?.closest('.box')?.scrollIntoView({behavior:'smooth',block:'nearest'});
 status('Showing the client activity history. Find the selected job by title.');
}
function renderClientCases(){
 const dest=$('clientCases');dest.replaceChildren();
 const rows=state.data.cases.filter(c=>c.mobile===state.mobile).sort((a,b)=>Number(openCase(b))-Number(openCase(a))||Number(b.id)-Number(a.id));
 const active=rows.filter(openCase).length;
 $('wfJobsSummary').textContent=state.mobile?active+' active · '+rows.length+' total':'Select a client';
 if(!state.mobile){dest.textContent='Select a client to see their jobs.';dest.className='muted';return;}
 dest.className='';
 const filterBar=document.createElement('div');filterBar.className='wf3j-filters';filterBar.setAttribute('role','group');filterBar.setAttribute('aria-label','Filter client jobs');
 for(const [key,label,count] of [['ALL','All',rows.length],['ACTIVE','Active',active],['SUBMITTED_REVIEW','Review',rows.filter(c=>wf4Match(c,'SUBMITTED_REVIEW')).length],['OVERDUE','Overdue',rows.filter(wf4Late).length],['COMPLETED','Done',rows.filter(c=>jobStage(c)==='COMPLETED').length]]){
  const button=wf3jButton(filterBar,label+' ('+count+')',()=>{wf3jFilter=key;renderClientCases();},wf3jFilter===key?'wf3j-filter chosen':'wf3j-filter');
  button.setAttribute('aria-pressed',String(wf3jFilter===key));
 }
 dest.append(filterBar);
 const visible=rows.filter(c=>wf4Match(c,wf3jFilter));
 if(!visible.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=rows.length?'No jobs under this filter.':'No jobs yet. Create your first job.';dest.append(empty);return;}
 for(const c of visible){
  const tasks=wf3jRelatedTasks(c.id);
  const currentTask=tasks.find(t=>!['COMPLETED','CANCELLED'].includes(t.current_status))||tasks[0];
  const expanded=String(wf3jExpandedJob)===String(c.id);
  const box=document.createElement('article');box.className='case-card wf3j-job';
  const top=document.createElement('button');top.type='button';top.className='wf3j-job-trigger';top.setAttribute('aria-expanded',String(expanded));
  const name=document.createElement('strong');name.textContent=c.title;top.append(name);
  const meta=document.createElement('span');meta.className='tiny';meta.textContent=c.service+' · '+(c.assigned_to||'Unassigned');top.append(meta);
  const labels=document.createElement('span');labels.className='wf3j-status-row';
  const stage=document.createElement('span');stage.className='wf-job-status'+(!openCase(c)?' completed':'');stage.textContent=jobLabel(jobStage(c));labels.append(stage);
  const assignment=document.createElement('span');assignment.className='wf3j-assignment'+(!currentTask?' missing':'');assignment.textContent=currentTask?'Employee: '+currentTask.current_status.replaceAll('_',' '):'Employee assignment missing';if(!Number(c.workflow_linked)&&!currentTask)labels.append(assignment);
  if(wf4Late(c)){const late=document.createElement('span');late.className='wf4-overdue';late.textContent='Overdue';labels.append(late);}top.append(labels);top.append(wf4Tracker(jobStage(c)));
  const arrow=document.createElement('span');arrow.className='wf3j-expand-icon';arrow.textContent=expanded?'▴':'▾';top.append(arrow);
  top.onclick=()=>{wf3jExpandedJob=expanded?null:c.id;renderClientCases();};box.append(top);
  if(expanded){
   const detail=document.createElement('div');detail.className='wf3j-details';
   const follow=document.createElement('div');follow.className='tiny';follow.textContent='Next follow-up: '+(fmtDate(c.followup_date)||'Not set');detail.append(follow);const due=document.createElement('div');due.className='tiny';due.textContent='Next open task due: '+(wf4Due(c)||'Not set');detail.append(due);
   if(c.next_action){const next=document.createElement('div');next.className='tiny';next.textContent='Next action: '+c.next_action;detail.append(next);}
   if(c.reference_no){const ref=document.createElement('div');ref.className='tiny';ref.textContent='Reference: '+c.reference_no;detail.append(ref);}
   if(currentTask){const assigned=document.createElement('div');assigned.className='tiny';assigned.textContent='Employee login: '+(currentTask.assignee_name||currentTask.assignee_username||'Unassigned')+' · '+(tasks.length>1?tasks.length+' linked work records':'1 linked work record');detail.append(assigned);}
   else {const note=document.createElement('div');note.className='wf3j-warning';note.textContent=Number(c.workflow_linked)?'Assigned work belongs to another employee or is outside the current task list.':'No workflow assignment found for this legacy job. Review before creating new work.';detail.append(note);}
   const actions=document.createElement('div');actions.className='wf3j-actions';
   if(window.WFPhase3?.isAdmin?.()){
    wf3jButton(actions,'Edit Job',()=>openCaseEditor(c.id));
    // Billing is managed in the central Billing & Collections tab.
    wf3jButton(actions,'Follow-up',()=>window.WF4D?.record(c));
   }
   if(currentTask){for(const t of tasks){const work=window.WFPhase3?.taskCard(t,{compact:true,single:tasks.length===1});if(work)detail.append(work);}}
   if(!window.WFPhase3?.isAdmin?.()&&currentTask&&openCase(c))wf3jButton(actions,'Follow-up',()=>window.WF4D?.record(c));
   wf3jButton(actions,'Follow-up History',()=>window.WF4D?.history(c.id),'ghost');
   wf3jButton(actions,'History',()=>wf3jHistory(c.id),'ghost');
   detail.append(actions);box.append(detail);
  }
  dest.append(box);
 }
}

function openWFJobTask(caseId){
 if(!state.mobile)return status('Select a client first.',true);
 if(!window.WFPhase3?.isAdmin())return status('Only Admin can assign work.',true);
 revealRight();
 if(caseId&&[...$('wf3Case').options].some(o=>String(o.value)===String(caseId)))$('wf3Case').value=String(caseId);
 $('wf3Right').scrollIntoView({behavior:'smooth',block:'start'});
 $('wf3Title').focus({preventScroll:true});
}

function renderClientTasks(){const dest=$('clientTasks');dest.replaceChildren();const rows=state.data.tasks.filter(t=>caseById(t.case_id)?.mobile===state.mobile);if(!rows.length){dest.className='muted';dest.textContent='No tasks for this client yet.';return;}rows.slice(0,30).forEach(t=>{const box=document.createElement('div');box.className='task-card';const b=document.createElement('strong');b.textContent=t.task_text;const line=document.createElement('div');line.className='tiny';line.textContent=(caseById(t.case_id)?.title||'Case')+' · '+(t.assigned_to||'Unassigned')+' · '+(fmtDate(t.due_date)||'No date');const btn=document.createElement('button');btn.className='ghost';btn.type='button';btn.style.marginTop='8px';btn.textContent=t.status.replaceAll('_',' ')+' · Edit';btn.onclick=()=>openTaskEditor(t.id);box.append(b,line,btn);dest.append(box);});}
function renderWorkspace(){const c=currentClient();$('selectedMobile').textContent=state.mobile?'+'+state.mobile:'No client selected';if(!state.newClient){$('mobile').value=state.mobile;$('mobile').readOnly=!!state.mobile;$('clientName').value=c?.client_name||'';$('service').value=c?.service||'GST';$('staff').value=c?.assigned_to||'';$('stage').value=c?.stage||'ENQUIRY';$('conversationState').value=c?.conversation_state||'OPEN';$('followup').value=fmtDate(c?.next_followup);}
 renderClientCases();renderClientTasks();fillCaseSelect($('taskCase').value);fillDocumentCases();$('addNote').disabled=!state.mobile;
}
function setMobile(mobile){if(state.mobile!==mobile){wf3jExpandedJob=null;wf3jFilter='ACTIVE';}state.mobile=mobile;state.newClient=false;state.canReply=false;state.messagesSignature='';state.closedThroughId=0;state.closedMobile='';updateSavedMessageAvailability();window.WFRightDashboard?.show('client');renderWorkspace();drawList();loadDocuments();loadTemplateConsent();document.dispatchEvent(new CustomEvent('wf3f:client',{detail:{mobile}}));}
async function selectClient(mobile){setMobile(mobile);$('current').textContent=clientName(mobile)+' · +'+mobile;$('details').textContent='Wayforward conversation';$('saveMessage').textContent='';clearCase();clearTask();switchView('chat');await loadThread();if(state.conversations.some(c=>c.mobile===mobile)){try{await api('read','POST',{mobile});}catch(e){status(e.message,true);}await loadList();}}
async function closeChatMessage(mobile,messageId,button){
 if(!validMobile(mobile)||!Number.isSafeInteger(Number(messageId))||Number(messageId)<1)return;
 if(!confirm('Close the conversation through this message? Earlier incoming messages will no longer trigger unanswered reminders. A NEW incoming message will trigger reminders again.'))return;
 button.disabled=true;
 try{
  const result=await api('response-monitor/action','POST',{
   mobile,action:'RESOLVE_MESSAGE',messageId:Number(messageId),
   reason:'Conversation closed from chat; no reply required.'
  });
  if(mobile!==state.mobile)return;
  state.closedThroughId=Math.max(state.closedThroughId,Number(result.resolvedThroughId)||Number(messageId));
  state.closedMobile=mobile;
  state.messagesSignature='';
  await Promise.all([loadThread(),loadList(),refreshResponseMonitor(false)]);
  status('Conversation closed and logged. New incoming messages will trigger reminders again.');
 }catch(e){status('Could not close conversation: '+e.message,true);}
 finally{button.disabled=false;}
}
function renderMessages(rows){
 const el=$('thread'),atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<95;
 el.replaceChildren();
 if(!rows.length){const div=document.createElement('div');div.className='empty';div.textContent='No WhatsApp messages for this client.';el.append(div);return;}
 for(const m of rows){
  const bubble=document.createElement('div');bubble.className='bubble '+(m.direction==='outbound'?'outbound':'inbound');
  bubble.textContent=m.body_text||'('+m.message_type+' message)';
  window.WF4D?.attachment(bubble,m);
  const small=document.createElement('small');small.textContent=displayTime(m.created_at)+' · '+(m.delivery_status||'');bubble.append(small);
  if(m.direction==='inbound'){
   bubble.dataset.wfMessageId=String(m.id);
   const readLine=document.createElement('div');readLine.className='wf3f-readers';readLine.dataset.wfReaders=String(m.id);readLine.textContent='Read by: —';bubble.append(readLine);
   const actions=document.createElement('div');actions.className='wf-message-actions';
   if(window.WFPhase3?.isAdmin()){
    const create=document.createElement('button');create.type='button';create.className='wf3-msg-btn';create.textContent='+ New Job from this message';
    create.onclick=()=>window.WFUnifiedJobs?.open({mobile:state.mobile,sourceMessageId:m.id,sourceText:m.body_text});actions.append(create);
   }
   if(state.closedMobile===state.mobile&&Number(m.id)<=state.closedThroughId){
    const closed=document.createElement('span');closed.className='wf-message-closed';closed.textContent='✓ Conversation closed';actions.append(closed);
   }else{
    const close=document.createElement('button');close.type='button';close.className='wf-message-close';close.textContent='Close Conversation';
    const targetMobile=state.mobile;close.onclick=()=>closeChatMessage(targetMobile,m.id,close);actions.append(close);
   }
   bubble.append(actions);
  }
  el.append(bubble);
 }
 if(atBottom)el.scrollTop=el.scrollHeight;
 document.dispatchEvent(new CustomEvent('wf3f:thread',{detail:{mobile:state.mobile,rows}}));
}
function renderNotes(rows){const dest=$('notes');dest.replaceChildren();if(!rows?.length){dest.textContent='No internal notes.';dest.className='muted';return;}for(const n of rows){const el=document.createElement('div');el.className='note';el.textContent=n.note_text;const small=document.createElement('small');small.textContent=(n.author||'Staff')+' · '+displayTime(n.created_at);el.append(small);dest.append(el);}}
async function loadThread(){if(!state.mobile||state.sending)return;const mobile=state.mobile;try{const [data,closeInfo]=await Promise.all([api('thread/'+encodeURIComponent(mobile)),api('response-monitor/message-status/'+encodeURIComponent(mobile)).catch(()=>({ok:false}))]);if(mobile!==state.mobile)return;state.closedThroughId=Number(closeInfo.resolvedThroughId||0);state.closedMobile=mobile;const signature=data.rows.map(m=>m.id+':'+m.delivery_status+':'+(m.media_status||'')).join('|')+'|closed:'+state.closedThroughId;if(signature!==state.messagesSignature){renderMessages(data.rows);state.messagesSignature=signature;}renderNotes(data.notes);state.canReply=!!data.canReply;$('reply').disabled=!data.canReply;$('send').disabled=!data.canReply;updateSavedMessageAvailability();alertMsg(data.canReply?'':'Free-form WhatsApp replies require a recent inbound message within the customer-service window.');}catch(e){alertMsg(e.message);}}
async function loadList(){if(!state.logged)return;try{const result=await api('conversations');state.conversations=result.rows||[];drawList();}catch(e){status(e.message,true);}}
async function refreshData(){if(!state.logged||state.loading)return;state.loading=true;try{const result=await api('dashboard-data');state.data=result;refreshFilters();renderKPIs();renderCases();renderFollowups();fillDocumentCases();renderDocuments();if(!document.activeElement?.closest('#right form')&&!document.activeElement?.closest('#clientForm')&&!state.newClient)renderWorkspace();else{renderClientCases();renderClientTasks();}drawList();status('Updated');}catch(e){status(e.message,true);}finally{state.loading=false;}}
async function refreshAll(){await Promise.all([loadList(),refreshData()]);if(state.mobile)await loadThread();}
function revealRight(){const el=$('right');if(el.classList.contains('collapsed')){$('layout').classList.remove('collapsed');el.classList.remove('collapsed');$('togglePanel').textContent='Hide client panel';}}
function goRight(id){revealRight();const el=$(id);el.scrollIntoView({behavior:'smooth',block:'start'});}
function clearCase(){document.getElementById('caseBox')?.classList.remove('wf3j-editing');$('caseForm').reset();$('caseStage').disabled=false;$('caseStaff').readOnly=false;$('caseId').value='';state.editingCase=null;$('caseStage').value='ENQUIRY';$('caseService').value='GST';}
function clearTask(){$('taskForm').reset();$('taskId').value='';state.editingTask=null;fillCaseSelect();$('taskStatus').value='PENDING';}
async function openCaseEditor(id){const c=caseById(id);if(!c)return;setMobile(c.mobile);$('current').textContent=clientName(c.mobile)+' · +'+c.mobile;clearCase();document.getElementById('caseBox')?.classList.add('wf3j-editing');$('caseId').value=c.id;$('caseTitle').value=c.title;$('caseService').value=c.service;$('caseRef').value=c.reference_no||'';$('caseStaff').value=c.assigned_to||'';const stageField=$('caseStage'),shownStage=jobStage(c);if(![...stageField.options].some(o=>o.value===shownStage))option(stageField,shownStage,jobLabel(shownStage));stageField.value=shownStage;stageField.disabled=!!Number(c.workflow_linked)||!!wf3jRelatedTasks(c.id).length;$('caseStaff').readOnly=stageField.disabled;$('caseDate').value=fmtDate(c.followup_date);$('caseAction').value=c.next_action||'';goRight('caseBox');}
async function openTaskEditor(id){if(window.WFPhase3?.hasTask(id)||window.WFPhase3&&!window.WFPhase3.isAdmin()){await window.WFPhase3.openTaskId(id);return;}const t=state.data.tasks.find(x=>Number(x.id)===Number(id));if(!t)return;const c=caseById(t.case_id);if(c){setMobile(c.mobile);$('current').textContent=clientName(c.mobile)+' · +'+c.mobile;}clearTask();fillCaseSelect(t.case_id);$('taskId').value=t.id;$('taskCase').value=t.case_id;$('taskText').value=t.task_text;$('taskStaff').value=t.assigned_to||'';$('taskDate').value=fmtDate(t.due_date);$('taskStatus').value=t.status;goRight('taskBox');}
async function saveClient(e){e.preventDefault();const mobile=digits($('mobile').value),name=$('clientName').value.trim();if(!validMobile(mobile)||!name){status('Enter a valid mobile with country code and client name.',true);return;}const button=$('saveClient');button.disabled=true;try{const linked=await api('master/lookup/'+encodeURIComponent(mobile));if(linked.client){location.href='https://prasath09.github.io/wayforward-main-crm/?client='+encodeURIComponent(linked.client.id);return;}if(!confirm('Register '+name+' as a permanent client and verify ownership of +'+mobile+'?'))return;const body={mobile,name,clientType:$('wf3fClientType').value,email:$('wf3fEmail').value,address:$('wf3fAddress').value,source:'WHATSAPP'};try{await api('master/save','POST',body);}catch(err){if(!err.message.includes('Verify ownership')||!confirm(err.message))throw err;await api('master/save','POST',{...body,confirmNameConflict:true});}state.mobile=mobile;state.newClient=false;$('saveMessage').textContent='Saved';await refreshAll();await window.WFMaster?.refresh();renderWorkspace();document.dispatchEvent(new CustomEvent('wf3f:client',{detail:{mobile}}));$('current').textContent=name+' · +'+mobile;status('Permanent client registered');}catch(err){status(err.message,true);$('saveMessage').textContent=err.message;}finally{button.disabled=false;}}
async function saveCase(e){e.preventDefault();if(!$('caseId').value)return window.WFUnifiedJobs?.open({mobile:state.mobile});if(!validMobile(state.mobile)){status('Select or create a client first.',true);return;}const button=$('saveCase');button.disabled=true;try{await api('case','POST',{id:$('caseId').value||null,mobile:state.mobile,title:$('caseTitle').value,service:$('caseService').value,referenceNo:$('caseRef').value,assignedTo:$('caseStaff').value,stage:$('caseStage').value,followupDate:$('caseDate').value,nextAction:$('caseAction').value});clearCase();await refreshData();fillDocumentCases();status('Case saved');}catch(err){status(err.message,true);}finally{button.disabled=false;}}
async function saveTask(e){e.preventDefault();if(!$('taskId').value)return window.WFUnifiedJobs?.open({mobile:state.mobile});const button=$('saveTask');button.disabled=true;try{await api('task','POST',{id:$('taskId').value||null,caseId:$('taskCase').value,taskText:$('taskText').value,assignedTo:$('taskStaff').value,dueDate:$('taskDate').value,status:$('taskStatus').value});clearTask();await refreshData();status('Task saved');}catch(err){status(err.message,true);}finally{button.disabled=false;}}
async function saveNote(e){e.preventDefault();if(!validMobile(state.mobile)||!$('note').value.trim())return;const button=$('addNote');button.disabled=true;try{await api('note','POST',{mobile:state.mobile,text:$('note').value,author:$('author').value});$('note').value='';await loadThread();status('Note saved');}catch(err){status(err.message,true);}finally{button.disabled=false;}}
function beginClient(){window.WFRightDashboard?.show('client');state.mobile='';state.canReply=false;updateSavedMessageAvailability();state.newClient=true;state.messagesSignature='';$('mobile').readOnly=false;$('mobile').value='';$('clientName').value='';$('staff').value='';$('service').value='GST';$('stage').value='ENQUIRY';$('conversationState').value='OPEN';$('followup').value='';$('selectedMobile').textContent='New client';$('clientCases').textContent='Save client first';$('clientTasks').textContent='Save client first';$('notes').textContent='';state.documents=[];renderDocuments();$('consentStatus').textContent='Save client first';$('templateConsent').value='no';$('addNote').disabled=true;$('current').textContent='New client';$('details').textContent='Save client to create a case';$('thread').replaceChildren();$('reply').disabled=true;$('send').disabled=true;drawList();switchView('profile');$('mobile').focus();document.dispatchEvent(new CustomEvent('wf3f:client',{detail:{mobile:''}}));}


// Phase 2C: status-only document checklist. Physical documents are NOT uploaded.
function fillDocumentCases(){
 const el=$('documentCase'),old=el.value;
 el.replaceChildren(new Option('Select a client case',''));
 state.data.cases.filter(c=>c.mobile===state.mobile).forEach(c=>option(el,c.id,c.title+' · '+c.service));
 if([...el.options].some(x=>x.value===old))el.value=old;
}
function clearDocument(){$('documentForm').reset();$('documentId').value='';fillDocumentCases();$('documentStatus').value='REQUESTED';$('documentActor').value=window.WFPhase3?.getDashboardData()?.user?.displayName||'Staff';}
function renderDocuments(){
 const rows=state.documents.filter(d=>!$('docFilter').value||d.status===$('docFilter').value);
 const tbody=$('documentRows'),listing=$('clientDocuments');tbody.replaceChildren();listing.replaceChildren();
 if(!state.mobile){blankRow(tbody,'Select a client to view documents.',5);listing.textContent='Select a client.';return;}
 if(!rows.length){blankRow(tbody,'No document requests for this client.',5);listing.textContent='No document requests saved.';return;}
 for(const d of rows){
  const tr=tbody.insertRow();td(tr,d.title+'\n'+d.case_title).style.whiteSpace='pre-line';td(tr,d.assigned_to||'—');td(tr,fmtDate(d.due_date)||'—');td(tr,d.status);action(tr,'Edit',()=>openDocument(d.id));
  const div=document.createElement('div');div.className='doc-pill';const label=document.createElement('span');label.textContent=d.title+' · '+d.status;const b=document.createElement('button');b.type='button';b.className='secondary';b.style.padding='5px 8px';b.textContent='Edit';b.onclick=()=>openDocument(d.id);div.append(label,b);listing.append(div);
 }
}
async function loadDocuments(){
 const mobile=state.mobile;if(!validMobile(mobile)){state.documents=[];renderDocuments();return;}
 try{const r=await api('documents?mobile='+encodeURIComponent(mobile));if(mobile!==state.mobile)return;state.documents=r.rows||[];renderDocuments();if(state.view==='documents')void window.WF4D?.loadFiles();}
 catch(e){if(mobile===state.mobile){state.documents=[];renderDocuments();status(e.message,true);}}
}
function openDocument(id){const d=state.documents.find(x=>Number(x.id)===Number(id));if(!d)return;clearDocument();$('documentId').value=d.id;$('documentCase').value=d.case_id;$('documentTitle').value=d.title;$('documentStaff').value=d.assigned_to||'';$('documentStatus').value=d.status;$('documentDue').value=fmtDate(d.due_date);$('documentReceived').value=fmtDate(d.received_date);$('documentRemarks').value=d.remarks||'';switchView('documents');$('documentBox').scrollIntoView({behavior:'smooth',block:'nearest'});}
async function saveDocument(e){e.preventDefault();const button=$('saveDocument');button.disabled=true;try{
 await api('document','POST',{id:$('documentId').value||null,caseId:$('documentCase').value,title:$('documentTitle').value,assignedTo:$('documentStaff').value,status:$('documentStatus').value,dueDate:$('documentDue').value,receivedDate:$('documentReceived').value,remarks:$('documentRemarks').value,actor:$('documentActor').value});
 clearDocument();await loadDocuments();status('Document checklist saved');
 }catch(e){status(e.message,true);}finally{button.disabled=false;}
}
// Phase 2D: opt-in, Meta-approved templates, verified test numbers, explicit manual sends.
async function loadTemplateConsent(){
 const mobile=state.mobile;state.consentVersion=null;state.consentMobile=null;$('templateConsent').value='no';$('consentStatus').textContent='';if(!validMobile(mobile))return;
 try{const r=await api('template-consent/'+mobile);if(mobile!==state.mobile)return;state.consentVersion=r.version;state.consentMobile=mobile;$('templateConsent').value=r.optedIn?'yes':'no';$('consentPurpose').value=r.purpose||'';$('consentStatus').textContent=r.optedIn?'Consent recorded':'No consent recorded';}
 catch(e){if(mobile===state.mobile)$('consentStatus').textContent=e.message;}
}
async function saveTemplateConsent(){
 const mobile=state.mobile;if(!validMobile(mobile))return status('Select a saved client first.',true);
 const button=$('saveConsent');button.disabled=true;
 try{if(state.consentMobile!==mobile||!state.consentVersion)throw Error('Refresh client consent before saving');const optedIn=$('templateConsent').value==='yes';await api('template-consent','POST',{mobile,optedIn,purpose:$('consentPurpose').value,recordedBy:$('consentActor').value,version:state.consentVersion});await loadTemplateConsent();$('consentStatus').textContent=optedIn?'Opt-in recorded':'Consent withdrawn';status('Consent preference saved');}
 catch(e){$('consentStatus').textContent=e.message;status(e.message,true);}finally{button.disabled=false;}
}
async function loadTemplates(){
 const el=$('templateSelect');el.replaceChildren(new Option('Loading saved text messages...',''));
 try{
  const r=await api('local-templates');state.localTemplates=r.rows||[];
  el.replaceChildren(new Option('Choose a saved message',''));
  for(const t of state.localTemplates){el.add(new Option((t.name||t.code)+' · '+(t.service||'General'),'local:'+t.id));}
  if(!state.localTemplates.length)el.replaceChildren(new Option('No saved messages found',''));
  $('templateStatus').textContent=state.localTemplates.length+' saved message(s) from Wayforward database. Ordinary text can be sent only while the customer-service window is open.';
 }catch(e){state.localTemplates=[];el.replaceChildren(new Option('Cannot load saved messages',''));$('templateStatus').textContent=e.message;}
 renderTemplatePreview();
}
function selectedTemplate(){
 const value=$('templateSelect').value;
 if(!value.startsWith('local:'))return null;
 return (state.localTemplates||[]).find(t=>String(t.id)===value.slice(6))||null;
}
function compileSavedBody(){
 const t=selectedTemplate();if(!t)return '';
 const vals=[...document.querySelectorAll('.template-parameter')].map(e=>e.value.trim());
 return String(t.body||'').replace(/\{\{\s*(\d+)\s*\}\}/g,(_,i)=>vals[Number(i)-1]||'{{'+i+'}}');
}
function updateSavedMessageAvailability(){
 const b=$('sendTemplate'),t=selectedTemplate();
 b.disabled=!t||!state.canReply||!validMobile(state.mobile)||state.sending;
 $('confirmTemplate').disabled=!t||!state.canReply||!validMobile(state.mobile);
 const desc=$('templateOrigin');
 if(!t){desc.textContent='Choose a saved text message to preview and edit.';return;}
 desc.textContent=state.canReply?
  'Free-form WhatsApp window is open. This message will be sent as ordinary text, NOT as a Meta template.':
  'Free-form messaging is unavailable. The client must send a new WhatsApp message before this saved text can be sent. An approved Meta template is required outside the customer-service window.';
}
function renderTemplatePreview(){
 const t=selectedTemplate(),host=$('templateParameters');host.replaceChildren();
 $('confirmTemplate').checked=false;
 state.selectedSavedBody='';state.savedMessageAutofill=false;
 $('templateFinalText').value='';
 if(t){
  const count=Math.min(8,Number(t.parameterCount)||0);
  for(let n=1;n<=count;n++){
   const field=document.createElement('div');field.className='field';
   const label=document.createElement('label');label.textContent=(t.labels?.[n-1]||'Variable')+' {{'+n+'}}';
   const inp=document.createElement('input');inp.className='template-parameter';inp.maxLength=500;inp.placeholder=t.labels?.[n-1]||'Value for {{'+n+'}}';
   inp.oninput=()=>{
    const compiled=compileSavedBody();
    if(!state.savedMessageAutofill||$('templateFinalText').value===state.selectedSavedBody){
     $('templateFinalText').value=compiled;
    }
    state.selectedSavedBody=compiled;
   };
   field.append(label,inp);host.append(field);
  }
  const client=currentClient();
  const first=host.querySelector('input');
  if(first&&/client name/i.test(t.labels?.[0]||'')){first.value=client?.client_name||'';}
  const compiled=compileSavedBody();$('templateFinalText').value=compiled;state.selectedSavedBody=compiled;state.savedMessageAutofill=true;
 }
 updateSavedMessageAvailability();
}
async function sendSavedText(e){
 e.preventDefault();const t=selectedTemplate(),mobile=state.mobile;
 if(!validMobile(mobile)||!t)return status('Select a customer and a saved message.',true);
 if(!state.canReply)return status('The free-form messaging window is closed. Ask the customer to send a new message or use a Meta-approved template.',true);
 if(!$('confirmTemplate').checked)return status('Confirm the recipient and final message.',true);
 const body=$('templateFinalText').value.trim();
 if(!body||body.length>4096)return status('Enter message text of 1–4096 characters.',true);
 if(/\{\{\s*\d+\s*\}\}/.test(body))return status('Replace all {{number}} placeholders before sending.',true);
 if(!window.confirm('Send this ordinary text message to +'+mobile+'?\n\n'+body.slice(0,350)))return;
 const b=$('sendTemplate');b.disabled=true;state.sending=true;$('templateStatus').textContent='Sending text message...';
 try{
  const result=await api('reply','POST',{mobile,text:body});
  $('templateStatus').textContent='Text accepted by Meta ('+(result.messageId||'request accepted')+'). Delivery is not guaranteed.';
  status(result.notice||'Text message submitted to Meta',!!result.notice);$('confirmTemplate').checked=false;state.messagesSignature='';
 }catch(err){$('templateStatus').textContent=err.message;status(err.message,true);}
 finally{state.sending=false;await loadThread();await loadList();updateSavedMessageAvailability();}
}

$('loginForm').onsubmit=async e=>{e.preventDefault();$('error').textContent='';try{await api('login','POST',{username:$('wf3Username').value,password:$('password').value});$('password').value='';showApp();try{await window.WFHR.run((p,b)=>api(p,b===undefined?'GET':'POST',b),'login');}catch(e){alertMsg('Attendance: '+e.message);}await refreshAll();await loadTemplates();await window.WFPhase3?.boot();await wfOpenDeepLink();}catch(err){$('error').textContent=err.message;}};
$('logout').onclick=async()=>{try{if(!await window.WFHR.run((p,b)=>api(p,b===undefined?'GET':'POST',b),'logout'))return;await api('logout','POST',{});window.WFPhase3?.reset();showLogin();}catch(e){alertMsg('Sign-out failed: '+e.message);}};
$('refresh').onclick=async()=>{await window.WFPhase3?.refresh();await refreshAll();await window.WFMaster?.refresh();if(state.mobile){await loadDocuments();await loadTemplateConsent();}await loadTemplates();};
$('togglePanel').onclick=()=>{const el=$('right'),collapsed=el.classList.toggle('collapsed');$('layout').classList.toggle('collapsed',collapsed);$('togglePanel').textContent=collapsed?'Show client panel':'Hide client panel';};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>{state.listFilter=b.dataset.list;document.querySelectorAll('[data-list]').forEach(x=>x.classList.toggle('selected',x===b));drawList();});
document.querySelectorAll('[data-kpi]').forEach(b=>b.onclick=()=>selectKpi(b.dataset.kpi));
$('search').oninput=drawList;$('caseSearch').oninput=renderCases;$('caseStaffFilter').onchange=renderCases;$('caseScope').onchange=renderCases;$('wf4CaseStage').onchange=renderCases;$('wf4Service').onchange=renderCases;$('dueScope').onchange=renderFollowups;$('dueStaffFilter').onchange=renderFollowups;
$('newClient').onclick=()=>window.WFMaster?.start('WALK_IN');
$('newCase').onclick=()=>{if(!state.mobile)return status('Select a client on the left or create one first.',true);clearCase();goRight('caseBox');$('caseTitle').focus();};
$('addCaseForClient').onclick=$('newCase').onclick;
$('newTask').onclick=()=>{if(!state.mobile)return status('Select a client first.',true);clearTask();goRight('taskBox');$('taskText').focus();};
$('addTaskForClient').onclick=$('newTask').onclick;
$('wfQuickNewJob').onclick=()=>{if(!state.mobile)return status('Select a client first.',true);$('addCaseForClient').click();};
$('wfQuickAssign').onclick=()=>{const c=caseById(wf3jExpandedJob);if(!c||c.mobile!==state.mobile)return status('Expand the existing job you want to reassign.',true);wf3jOpenTask(c.id);};
$('wfQuickFollowup').onclick=()=>{const c=caseById(wf3jExpandedJob);if(!c||c.mobile!==state.mobile)return status('Expand a job to set its follow-up.',true);window.WF4D?.record(c);};
$('wfQuickMyTasks').onclick=()=>window.WFRightDashboard?.show('dashboard');

$('clearCase').onclick=clearCase;$('clearTask').onclick=clearTask;
$('docFilter').onchange=renderDocuments;$('newDocument').onclick=()=>{if(!state.mobile)return status('Select a client first.',true);clearDocument();switchView('documents');$('documentBox').scrollIntoView({behavior:'smooth',block:'nearest'});$('documentTitle').focus();};$('clearDocument').onclick=clearDocument;$('documentForm').onsubmit=saveDocument;$('refreshTemplates').onclick=loadTemplates;$('templateSelect').onchange=renderTemplatePreview;$('saveConsent').onclick=saveTemplateConsent;$('templateForm').onsubmit=sendSavedText;
$('clientForm').onsubmit=e=>{e.preventDefault();if(!window.WFMaster)return status('Client Master is unavailable. Check updated files.',true);const existing=window.WFMaster.getContact(state.mobile);if(existing)return window.WFMaster.openMasterOnly(existing);window.WFMaster.start(state.mobile?'WHATSAPP':'WALK_IN',state.mobile);$('wfmName').value=$('clientName').value.trim();$('wfmType').value=$('wf3fClientType').value;$('wfmEmail').value=$('wf3fEmail').value;$('wfmAddress').value=$('wf3fAddress').value;};$('caseForm').onsubmit=saveCase;$('taskForm').onsubmit=saveTask;$('noteForm').onsubmit=saveNote;
$('replyForm').onsubmit=async e=>{e.preventDefault();const text=$('reply').value.trim();if(!state.mobile||!text)return;state.sending=true;$('send').disabled=true;try{const result=await api('reply','POST',{mobile:state.mobile,text});$('reply').value='';state.messagesSignature='';status(result.notice||'Message submitted to Meta',!!result.notice);}catch(err){alertMsg(err.message);}finally{state.sending=false;await loadThread();await loadList();}};
(async()=>{try{const s=await api('session');for(const id of ['service','caseService'])s.services.forEach(x=>option($(id),x,x));for(const id of ['stage','caseStage'])s.stages.forEach(x=>option($(id),x,x.replaceAll('_',' ')));if(s.authenticated){showApp();await refreshAll();await loadTemplates();await window.WFPhase3?.boot();await wfOpenDeepLink();}else showLogin();}catch(e){showLogin();}})();
setInterval(async()=>{if(!state.logged||document.hidden)return;await loadList();if(state.mobile&&state.conversations.some(c=>c.mobile===state.mobile))await loadThread();},5000);
setInterval(async()=>{if(!state.logged||document.hidden)return;await refreshData();},60000);

/* ===========================================================
   Phase 2E: Unanswered incoming WhatsApp messages
   =========================================================== */
const responseState={rows:[],alerts:[],selected:'',shown:new Set(),loading:false,settingsInitialized:false};
const pendingFor=m=>responseState.rows.find(x=>x.mobile===m);
function responseLabel(r){return r.read?'Read · not answered':'Unread · not answered';}
function responsePopup(open){$('responseModal').classList.toggle('visible',open);}
// Route a response alert into the selected WhatsApp chat, not back into its details popup.
async function openResponseChat(mobile){
 if(!mobile)return;
 responsePopup(false);
 responseState.selected=mobile;
 try{
  await selectClient(mobile); // updates selected client, switches to Chat, loads messages and marks CRM-read
  switchView('chat');
  const selected=[...document.querySelectorAll('#conversations .clientitem')]
   .find(item=>item.classList.contains('active'));
  selected?.scrollIntoView({block:'nearest',inline:'nearest'});
  const reply=$('reply');
  if(!reply.disabled){reply.focus({preventScroll:true});}
  else{
   const view=$('chatView');view.setAttribute('tabindex','-1');view.focus({preventScroll:true});
   status('Conversation opened. Free-form replies are unavailable outside the customer-service window.');
  }
 }catch(e){status('Unable to open conversation: '+e.message,true);}
}
function responseSelect(mobile){
 responseState.selected=mobile;
 const item=pendingFor(mobile);
 $('responseDescription').textContent=item
  ? (clientName(mobile)+' (+ '+mobile+') · '+responseLabel(item)+' · '+Math.floor(item.age_minutes/60)+'h '+item.age_minutes%60+'m waiting'+(item.escalated?' · TEAM LEAD ESCALATION':''))
  : 'No outstanding message for this client.';
 $('responseOpen').disabled=!item;
 $('responseSnooze').disabled=!item;
 $('responseResolve').disabled=!item;
 responsePopup(true);
}
function paintResponseList(){
 const host=$('responseList');host.replaceChildren();
 const rows=responseState.rows.slice().sort((a,b)=>b.age_minutes-a.age_minutes);
 if(!rows.length){const div=document.createElement('div');div.className='empty';div.textContent='All customer conversations have been addressed.';host.append(div);return;}
 for(const r of rows){
  const card=document.createElement('div');card.className='response-card'+(r.escalated?' escalated':'');
  card.setAttribute('role','button');card.setAttribute('tabindex','0');
  card.setAttribute('aria-label','Open WhatsApp chat for '+(r.client_name||'+'+r.mobile));
  card.title='Open this conversation';
  card.onclick=()=>openResponseChat(r.mobile);
  card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openResponseChat(r.mobile);}};
  const b=document.createElement('button');b.type='button';b.textContent=(r.client_name||'+'+r.mobile)+' · '+responseLabel(r);
  const text=document.createElement('small');text.textContent=(r.last_text||'Media or attachment').slice(0,180);
  const meta=document.createElement('small');meta.textContent=Math.floor(r.age_minutes/60)+'h '+r.age_minutes%60+'m waiting'+(r.assigned_to?' · Assigned: '+r.assigned_to:' · Unassigned')+(r.is_snoozed?' · Snoozed':'');
  card.append(b,text,meta);
  if(r.escalated){const tag=document.createElement('span');tag.className='response-chip urgent';tag.textContent='Team lead escalation';card.append(tag);}
  host.append(card);
 }
}
async function refreshResponseMonitor(showNew=true){
 if(!state.logged||responseState.loading)return;
 responseState.loading=true;
 try{
  const data=await api('response-monitor');
  responseState.rows=data.rows||[];
  responseState.alerts=data.alerts||[];
  $('responsePending').textContent='Unanswered: '+data.summary.pending;
  $('responseUnread').textContent='Unread: '+data.summary.unread;
  $('responseRead').textContent='Read, no reply: '+data.summary.readUnanswered;
  $('responseEscalated').textContent='Escalations: '+data.summary.escalated;
  const settings=data.settings||{reminderMinutes:2,escalationMinutes:180};
  $('responseMode').textContent='24/7 · every '+settings.reminderMinutes+' min · escalate after '+settings.escalationMinutes+' min';
  if(!responseState.settingsInitialized || document.activeElement!==$('reminderMinutes') && document.activeElement!==$('escalationMinutes')){
   $('reminderMinutes').value=settings.reminderMinutes;
   $('escalationMinutes').value=settings.escalationMinutes;
   responseState.settingsInitialized=true;
  }
  paintResponseList();drawList();
  if(showNew&&!document.hidden&&!document.getElementById('wf4cDialog')){
   const pendingEvents=responseState.alerts.filter(a=>!a.is_snoozed);
   // Prevent a 60-second poll from redisplaying the same persisted event in one tab.
   const unseen=pendingEvents.find(e=>{
    const key='wf-response-alert:'+e.id;
    try{return sessionStorage.getItem(key)!=='shown';}catch{return !responseState.shown.has(key);}
   });
   if(unseen){
    const key='wf-response-alert:'+unseen.id;
    try{sessionStorage.setItem(key,'shown');}catch{responseState.shown.add(key);}
    responseSelect(unseen.mobile);
    if('Notification' in window&&Notification.permission==='granted'){
     const notification=new Notification('Wayforward: customer reply pending',{body:(unseen.client_name||'+'+unseen.mobile)+' · '+responseLabel(unseen)+' · '+Math.floor(unseen.age_minutes/60)+'h pending',tag:'wf-response-'+unseen.id});
     notification.onclick=()=>{window.focus();void openResponseChat(unseen.mobile);notification.close();};
    }
   }
  }
 }catch(e){status('Response monitor: '+e.message,true);}
 finally{responseState.loading=false;}
}
async function responseAction(action){
 const mobile=responseState.selected,item=pendingFor(mobile);
 if(!item)return;
 const actor=$('responseActor').value.trim(),reason=$('responseReason').value.trim();
 if(!actor)return status('Enter staff name for response action.',true);
 if(action==='RESOLVE'&&!reason)return status('Enter a reason to resolve without a WhatsApp reply.',true);
 if(action==='RESOLVE'&&!confirm('Close the reply reminder for '+clientName(mobile)+' without sending a message?'))return;
 for(const id of ['responseSnooze','responseResolve'])$(id).disabled=true;
 try{await api('response-monitor/action','POST',{mobile,action,actor,reason});responsePopup(false);$('responseReason').value='';await refreshResponseMonitor(false);status(action==='SNOOZE'?'Reminder snoozed for one hour':'Message marked handled; action audited.');}
 catch(e){status(e.message,true);}
 finally{for(const id of ['responseSnooze','responseResolve'])$(id).disabled=false;}
}
for(const id of ['responsePending','responseUnread','responseRead','responseEscalated'])$(id).onclick=()=>{
 paintResponseList();responseState.selected=responseState.rows[0]?.mobile||'';
 $('responseDescription').textContent='Select a customer from the list to open, snooze or resolve the outstanding message.';
 for(const buttonId of ['responseOpen','responseSnooze','responseResolve'])$(buttonId).disabled=true;
 responsePopup(true);
};
$('responseDismiss').onclick=()=>responsePopup(false);
$('responseOpen').onclick=()=>openResponseChat(responseState.selected);
$('responseSnooze').onclick=()=>responseAction('SNOOZE');
$('responseResolve').onclick=()=>responseAction('RESOLVE');
$('responseConfigForm').onsubmit=async(e)=>{
 e.preventDefault();
 const reminderMinutes=Number($('reminderMinutes').value);
 const escalationMinutes=Number($('escalationMinutes').value);
 const actor=$('responseSettingsActor').value.trim();
 if(!Number.isSafeInteger(reminderMinutes)||reminderMinutes<1||reminderMinutes>120 || !Number.isSafeInteger(escalationMinutes)||escalationMinutes<1||escalationMinutes>10080 || !actor){
  $('responseSettingsMessage').textContent='Enter valid intervals and staff name.';return;
 }
 $('saveResponseSettings').disabled=true;
 try{
  const result=await api('response-monitor/settings','POST',{reminderMinutes,escalationMinutes,actor});
  $('responseSettingsMessage').textContent='Saved for all staff · '+result.settings.reminderMinutes+' min reminders · 24/7';
  responseState.settingsInitialized=false;
  await refreshResponseMonitor(false);
 }catch(err){$('responseSettingsMessage').textContent=err.message;}
 finally{$('saveResponseSettings').disabled=false;}
};
setInterval(()=>{if(state.logged)refreshResponseMonitor(true);},20000);
// Startup / sign-in monitor hydration without modifying existing login implementation.
$('loginForm').addEventListener('submit',()=>setTimeout(()=>{if(state.logged)refreshResponseMonitor(true);},1400));
setTimeout(()=>{if(state.logged)refreshResponseMonitor(true);},1200);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.logged)refreshResponseMonitor(true);});

$('enableResponseDesktop').onclick=async()=>{if(!('Notification' in window))return status('Desktop notifications are not supported in this browser.',true);try{const p=await Notification.requestPermission();status(p==='granted'?'Desktop notifications enabled':'Desktop notifications not enabled');}catch(e){status(e.message,true);}};

// Repaint employee status chips after background task/notification updates.
document.addEventListener('wf3:updated',()=>{if(state.logged&&!state.newClient){renderClientCases();renderCases();}});

async function wfOpenDeepLink(){try{const v=await api('session');$('wfBuildVersion').textContent='Frontend v'+window.WAYFORWARD_CRM_VERSION+' · Backend '+(v.version?'v'+v.version:'unreported');}catch{}const q=new URLSearchParams(location.search),i=q.get('client'),m=q.get('mobile');if(!i||!m||!/^\d+$/.test(i)||!/^\d{8,15}$/.test(m))return;try{const j=await api('main/clients/conversation-link?id='+encodeURIComponent(i)+'&mobile='+encodeURIComponent(m));await openResponseChat(j.mobile);const u=new URL(location.href);u.searchParams.delete('client');u.searchParams.delete('mobile');history.replaceState(null,'',u);}catch(e){status('Unable to open linked conversation: '+e.message,true);}}
