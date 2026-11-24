var WF_API_ORIGIN = String(window.WAYFORWARD_API_ORIGIN || '').replace(/\/$/, '');
'use strict';
// Phase 3 UI extension. Existing Phase 2 inbox script remains the owner of WhatsApp UI.
(function(){
 const el=id=>document.getElementById(id);
 const historyOpen=new Set();
 const wf={user:null,staff:[],tasks:[],notifications:[],booted:false,busy:false,seen:new Set()};
 const esc=v=>String(v??'');
 const isAdmin=()=>wf.user?.role==='ADMIN';
 const isLead=()=>wf.user?.role==='TEAM_LEAD';
 const fmt=d=>d?String(d).slice(0,10):'—';
 const label=s=>({ACKNOWLEDGED:'In Progress',ASSIGNED:'Assigned',IN_PROGRESS:'In Progress',WAITING_CLIENT:'Waiting for Client',SUBMITTED_REVIEW:'Pending Admin Review',COMPLETED:'Job Done',REOPENED:'Returned for Correction',CANCELLED:'Cancelled'})[s]||String(s||'').replaceAll('_',' ');
 const actionLabel=s=>({ACKNOWLEDGED:'Acknowledge Job',IN_PROGRESS:'Resume Work',WAITING_CLIENT:'Waiting for Client',SUBMITTED_REVIEW:'Job Completed',COMPLETED:'Job Done',REOPENED:'Return for Correction',CANCELLED:'Cancel Job'})[s]||label(s);
 function message(x,error=false){status(x,error);}
 async function get(route){return api('phase3/'+route);}
 async function post(route,data){return api('phase3/'+route,'POST',data);}
 function setOptions(id,rows,placeholder,mapper){const e=el(id),current=e.value;e.replaceChildren(new Option(placeholder,''));for(const r of rows){const [value,label]=mapper(r);e.add(new Option(label,value));}if([...e.options].some(o=>o.value===current))e.value=current;}
 function selectedCases(){return state.data.cases.filter(c=>c.mobile===state.mobile);}
 function updateCaseOptions(){setOptions('wf3Case',selectedCases(),'Select a case',c=>[String(c.id),c.title+' · '+c.service]);}
 function updateStaffOptions(){setOptions('wf3Assignee',wf.staff.filter(s=>s.active),'Assign employee',s=>[String(s.id),s.display_name+' ('+s.username+')']);}
 function cardText(container,tag,text,cls){const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;container.append(x);return x;}
 function miniButton(container,text,cb,primary=false){const btn=document.createElement('button');btn.type='button';btn.textContent=text;btn.className=primary?'':'secondary';btn.style.marginRight='6px';btn.style.marginTop='6px';btn.onclick=cb;container.append(btn);return btn;}
 async function openTask(t){await selectClient(t.mobile);renderTasks();switchView('chat');const c=caseById(t.case_id);if(c)await wf4OpenJob(c);else window.WFRightDashboard?.selectTask(t.id);message('Opened linked client conversation and assigned task.');}
 async function changeStatus(task,newStatus){let comment='';if(['WAITING_CLIENT','REOPENED','CANCELLED'].includes(newStatus)){const ans=prompt('Reason / instruction for '+newStatus.replaceAll('_',' ')+' (required)');if(ans===null)return;comment=ans.trim();if(!comment){message('Reason required.',true);return;}}
 else if(newStatus==='SUBMITTED_REVIEW'){const summary=prompt('Optional work summary for Admin review:');if(summary===null)return;comment=summary.trim();}
 try{const result=await post('tasks/'+task.id+'/status',{status:newStatus,comment});message('Job status updated: '+label(result.status));await refreshData();await refresh();}catch(e){message(e.message,true);}
 }
 async function reassignTask(t){const ans=prompt('Enter employee username to reassign:',t.assignee_username);if(ans===null)return;const employee=wf.staff.find(s=>s.username===ans.trim().toLowerCase()&&s.active);if(!employee){message('Select a valid active employee username.',true);return;}const comment=(prompt('Reason for reassignment (optional):')||'').trim();try{await post('tasks/'+t.id+'/reassign',{assigneeId:employee.id,comment});await refreshData();await refresh();message('Task reassigned.');}catch(e){message(e.message,true);}}
 async function history(t){try{const r=await get('tasks/'+t.id+'/events');alert('Task history:\n'+(r.rows||[]).map(e=>[fmt(e.created_at),e.actor_name,e.from_status||'—','→',e.to_status,e.comment||''].join(' ')).join('\n').slice(0,3500));}catch(e){message(e.message,true);}}
 function taskCard(t,opts={}){const box=document.createElement('article');box.className='wf3-task';if(!opts.single){cardText(box,'strong',t.task_text);cardText(box,'small',(t.client_name||'+'+t.mobile)+' · '+t.case_title+' · Assigned: '+t.assignee_name);} 
  const info=document.createElement('div');info.style.marginTop='7px';box.append(info);cardText(info,'span',(opts.single?(t.current_status==='REOPENED'?'Returned for Correction · ':''):label(t.current_status)+' · ')+t.priority+' · Due '+fmt(t.due_date),'wf3-pill');if(t.due_date&&fmt(t.due_date)<(state.data.today||new Date().toISOString().slice(0,10))&&!['COMPLETED','CANCELLED'].includes(t.current_status))cardText(info,'span',' Overdue','wf4-overdue');if(!opts.compact)box.append(wf4Tracker(t.current_status));
  if(t.instructions)cardText(box,'p',t.instructions,'tiny');
  if(!opts.compact)miniButton(box,'Open client chat',()=>openTask(t));const details=document.createElement('details');const title=document.createElement('summary');title.textContent=t.current_status==='SUBMITTED_REVIEW'?'Completion remarks / history':'Job activity history';details.append(title);const log=document.createElement('div');details.append(log);box.append(details);let loaded=false;details.ontoggle=async()=>{if(!details.open){historyOpen.delete(String(t.id));return;}historyOpen.add(String(t.id));if(loaded)return;try{const r=await get('tasks/'+t.id+'/events');log.replaceChildren();for(const e of r.rows||[])cardText(log,'p',new Date(e.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' · '+e.actor_name+' · '+label(e.to_status)+(e.comment?' — '+e.comment:''),'tiny');if(!log.children.length)cardText(log,'p','No activity recorded.','tiny');loaded=true;}catch(e){log.textContent=e.message;}};if(historyOpen.has(String(t.id)))details.open=true;
  const own=Number(t.assignee_id)===Number(wf.user?.id);
  const actions=own?{ASSIGNED:['ACKNOWLEDGED'],ACKNOWLEDGED:['WAITING_CLIENT','SUBMITTED_REVIEW'],IN_PROGRESS:['WAITING_CLIENT','SUBMITTED_REVIEW'],WAITING_CLIENT:['IN_PROGRESS','SUBMITTED_REVIEW'],REOPENED:['ACKNOWLEDGED']} : {};
  const adminActions=isAdmin()?{SUBMITTED_REVIEW:['COMPLETED','REOPENED'],COMPLETED:['REOPENED'],ASSIGNED:['CANCELLED'],ACKNOWLEDGED:['CANCELLED'],IN_PROGRESS:['CANCELLED'],WAITING_CLIENT:['CANCELLED'],REOPENED:['CANCELLED']}:{};
  const choices=[...(actions[t.current_status]||[]),...(adminActions[t.current_status]||[])];
  for(const x of [...new Set(choices)])miniButton(box,x==='COMPLETED'?'Confirm Job Done':actionLabel(x),()=>changeStatus(t,x),x==='COMPLETED'||x==='SUBMITTED_REVIEW');
  if(isAdmin()&&t.current_status!=='CANCELLED')miniButton(box,'Reassign',()=>reassignTask(t));
  return box;
 }
 function renderTasks(){const list=el('wf3TaskList');list.replaceChildren();const scope=el('wf3TaskFilter').value;const today=state.data.today||new Date().toISOString().slice(0,10);
  const staffSelect=el('wf4StaffFilter');const prior=staffSelect.value;staffSelect.replaceChildren(new Option('All employees',''),...wf.staff.map(s=>new Option(s.display_name,String(s.id))));staffSelect.value=[...staffSelect.options].some(o=>o.value===prior)?prior:'';const base=wf.tasks.filter(t=>!staffSelect.value||String(t.assignee_id)===staffSelect.value);const countHost=el('wf4StaffCounts');countHost.replaceChildren();const overview=el('wf4StaffOverview');overview.replaceChildren();if(isAdmin()){for(const employee of wf.staff.filter(s=>s.active||wf.tasks.some(t=>Number(t.assignee_id)===Number(s.id)))){const assigned=wf.tasks.filter(t=>Number(t.assignee_id)===Number(employee.id));const line=document.createElement('div');line.className='wf4-staff-line';miniButton(line,employee.display_name,()=>{staffSelect.value=String(employee.id);el('wf3TaskFilter').value='ALL';renderTasks();});cardText(line,'small',['New '+assigned.filter(t=>t.current_status==='ASSIGNED').length,'Progress '+assigned.filter(t=>['IN_PROGRESS','ACKNOWLEDGED','REOPENED'].includes(t.current_status)).length,'Waiting '+assigned.filter(t=>t.current_status==='WAITING_CLIENT').length,'Review '+assigned.filter(t=>t.current_status==='SUBMITTED_REVIEW').length,'Done '+assigned.filter(t=>t.current_status==='COMPLETED').length,'Overdue '+assigned.filter(t=>t.due_date&&fmt(t.due_date)<today&&!['COMPLETED','CANCELLED'].includes(t.current_status)).length].join(' · '),'tiny');overview.append(line);}}for(const [k,l] of [['ALL','All'],['ASSIGNED','Assigned'],['PROGRESS','In Progress'],['WAITING','Waiting'],['REVIEW','Review'],['OVERDUE','Overdue'],['DONE','Job Done']]){const match=t=>k==='ALL'||(k==='ASSIGNED'&&t.current_status==='ASSIGNED')||(k==='PROGRESS'&&['ACKNOWLEDGED','IN_PROGRESS','REOPENED'].includes(t.current_status))||(k==='WAITING'&&t.current_status==='WAITING_CLIENT')||(k==='REVIEW'&&t.current_status==='SUBMITTED_REVIEW')||(k==='DONE'&&t.current_status==='COMPLETED')||(k==='OVERDUE'&&t.due_date&&fmt(t.due_date)<today&&!['COMPLETED','CANCELLED'].includes(t.current_status));miniButton(countHost,l+' ('+base.filter(match).length+')',()=>{el('wf3TaskFilter').value=k;renderTasks();},scope===k);}const tasks=base.filter(t=>scope==='ALL'||(scope==='ASSIGNED'&&t.current_status==='ASSIGNED')||(scope==='PROGRESS'&&['ACKNOWLEDGED','IN_PROGRESS','REOPENED'].includes(t.current_status))||(scope==='WAITING'&&t.current_status==='WAITING_CLIENT')||(scope==='DONE'&&t.current_status==='COMPLETED')||(scope==='OPEN'&&!['COMPLETED','CANCELLED'].includes(t.current_status))||(scope==='REVIEW'&&t.current_status==='SUBMITTED_REVIEW')||(scope==='OVERDUE'&&t.due_date&&fmt(t.due_date)<today&&!['COMPLETED','CANCELLED'].includes(t.current_status)));
  el('wf3TaskSummary').textContent=tasks.length+' task(s) · '+(isAdmin()||isLead()?'Office work queue':'My assigned tasks');
  if(!tasks.length)cardText(list,'div','No matching tasks.','empty');for(const t of tasks)list.append(taskCard(t));
  const right=el('wf3CurrentTasks');right.replaceChildren();const related=wf.tasks.filter(t=>t.mobile===state.mobile);
  if(!related.length)cardText(right,'p',state.mobile?'No Phase 3 tasks for this client.':'Select a client to view linked tasks.','tiny');
  for(const t of related.slice(0,12)){const row=document.createElement('div');row.className='wf3-task';cardText(row,'strong',t.task_text);cardText(row,'small',t.assignee_name+' · '+label(t.current_status));miniButton(row,'View task',()=>window.WFRightDashboard?.selectTask(t.id));right.append(row);}
  updateCaseOptions();updateStaffOptions();
 }
 function renderStaff(){const host=el('wf3StaffList');host.replaceChildren();if(!isAdmin())return;
  for(const s of wf.staff){const box=document.createElement('div');box.className='wf3-task';cardText(box,'strong',s.display_name+' · '+s.username);cardText(box,'small',s.role+' · '+(s.active?'Active':'Disabled'));
   miniButton(box,s.active?'Disable':'Enable',async()=>{if(!confirm((s.active?'Disable':'Enable')+' '+s.display_name+'?'))return;try{await post('staff/status',{id:s.id,active:!s.active});await refresh();}catch(e){message(e.message,true);}});
   miniButton(box,'Reset password',async()=>{const password=prompt('New password (at least 12 characters) for '+s.username+':');if(password===null)return;if(password.length<12)return message('Use a password of at least 12 characters.',true);try{await post('staff/password',{id:s.id,password});message('Password updated.');}catch(e){message(e.message,true);}});
   host.append(box);
  }
 }
 function renderNotifications(){const host=el('wf3Notifications');host.replaceChildren();const badge=el('wf3Count');const unread=wf.notifications.filter(n=>!n.read_at).length;badge.textContent=String(unread);badge.style.display=unread?'inline':'none';
  if(!wf.notifications.length)cardText(host,'p','No internal notifications.','tiny');
  for(const n of wf.notifications.slice(0,30)){const row=document.createElement('div');row.className='wf3-alert';cardText(row,'strong',n.title);cardText(row,'small',n.message||'');const bar=document.createElement('div');row.append(bar);
   if(n.task_id)miniButton(bar,'View Task',async()=>{const t=wf.tasks.find(x=>Number(x.id)===Number(n.task_id));if(t)await openTask(t);else switchView('phase3');});
   if(!n.read_at&&(wf.user?.id||isAdmin()))miniButton(bar,'Mark read',async()=>{try{await post('notifications/read',{id:n.id});await refresh();}catch(e){message(e.message,true);}});
   host.append(row);
  }
 }
 async function refresh(){if(!state.logged||wf.busy)return;wf.busy=true;
  try{const [user,staff,tasks,notifications]=await Promise.all([api('session'),get('staff'),get('tasks'),get('notifications')]);const before=wf.tasks.map(t=>[t.id,t.current_status,t.assignee_id,t.updated_at].join(':')).join('|');
   wf.user=user.user;wf.staff=staff.rows||[];wf.tasks=tasks.rows||[];wf.notifications=notifications.rows||[];
   const after=wf.tasks.map(t=>[t.id,t.current_status,t.assignee_id,t.updated_at].join(':')).join('|');
   if(wf.booted&&before!==after)await refreshData();
   renderTasks();renderStaff();renderNotifications();document.dispatchEvent(new CustomEvent('wf3:updated',{detail:{user:wf.user,tasks:wf.tasks,notifications:wf.notifications,unread:Number(notifications.unread)||0}}));
   const newAlerts=wf.notifications.filter(n=>!n.read_at&&!wf.seen.has(String(n.id)));
   // Avoid spamming a desktop notification on initial page load.
   for(const n of newAlerts){wf.seen.add(String(n.id));if(!el('wf4cDialog')&&wf.booted&&'Notification'in window&&Notification.permission==='granted'&&!document.hidden){const x=new Notification('Wayforward: '+n.title,{body:'Internal task notification',tag:'wf-task-'+n.id});x.onclick=()=>{window.focus();window.WFRightDashboard?.show('dashboard');if(n.task_id)window.WFRightDashboard?.selectTask(n.task_id);x.close();};}}
  }catch(e){message('Task panel: '+e.message,true);}finally{wf.busy=false;}
 }
 function applyRole(user){wf.user=user;const employee=!!user&&user.role!=='ADMIN';el('app').classList.toggle('wf3-employee',employee);el('app').classList.toggle('wf3-admin',!!user&&user.role==='ADMIN');
  el('wf3Role').textContent=user?user.displayName+' · '+user.role:'Staff';el('wf3RightRole').textContent=isAdmin()?'Create & assign':'My assigned tasks';
  document.dispatchEvent(new CustomEvent('wf3:role',{detail:{user}}));for(const id of ['newClient','newCase','addCaseForClient','newTask','addTaskForClient','newDocument']){const x=el(id);if(x)x.disabled=employee;}
 }
 async function boot(){try{const s=await api('session');if(!s.authenticated)return;applyRole(s.user);wf.booted=false;await refresh();wf.booted=true;}catch(e){message(e.message,true);}}
 function reset(){historyOpen.clear();wf.user=null;wf.staff=[];wf.tasks=[];wf.notifications=[];wf.booted=false;wf.seen.clear();document.dispatchEvent(new CustomEvent('wf3:reset'));}
 function fromMessage(id,body){if(!isAdmin())return;if(!state.mobile)return message('Select a client first.',true);updateCaseOptions();
  if(!selectedCases().length){message('Create a client case before assigning a task from this message.',true);goRight('caseBox');return;}
  el('wf3SourceMessage').value=String(id);el('wf3Title').value=('Follow up: '+String(body||'').slice(0,430)).slice(0,500);goRight('wf3Right');el('wf3Title').focus();message('Task linked to selected WhatsApp message #'+id);
 }
 window.WFPhase3={boot,refresh,reset,isAdmin,label,fromMessage,taskCard,openTask,changeStatus,getDashboardData:()=>({user:wf.user,tasks:wf.tasks,notifications:wf.notifications}),hasTask:id=>wf.tasks.some(t=>Number(t.id)===Number(id)),openTaskId:async id=>{const t=wf.tasks.find(t=>Number(t.id)===Number(id));if(t)await openTask(t);else switchView('phase3');}};
 el('wf3Refresh').onclick=refresh;el('wf3TaskFilter').onchange=renderTasks;el('wf4StaffFilter').onchange=renderTasks;
 el('wf3Bell').onclick=()=>{window.WFRightDashboard?.show('dashboard');el('wfDashNotificationList')?.scrollIntoView({behavior:'smooth',block:'nearest'});};
 el('wf3ClearSource').onclick=()=>{el('wf3SourceMessage').value='';message('Source message link cleared.');};
 el('wf3StaffForm').onsubmit=async e=>{e.preventDefault();try{await post('staff',{username:el('wf3NewUser').value,displayName:el('wf3NewName').value,role:el('wf3NewRole').value,password:el('wf3NewPassword').value});el('wf3StaffForm').reset();await refresh();message('Employee account created. Share credentials securely.');}catch(err){message(err.message,true);}};
 el('wf3CreateForm').onsubmit=async e=>{e.preventDefault();if(!isAdmin())return message('Admin access required.',true);try{await post('tasks',{caseId:el('wf3Case').value,assigneeId:el('wf3Assignee').value,priority:el('wf3Priority').value,title:el('wf3Title').value,dueDate:el('wf3Due').value,instructions:el('wf3Instructions').value,sourceMessageId:el('wf3SourceMessage').value||null});el('wf3CreateForm').reset();await refresh();message('Task assigned and employee notified.');switchView('phase3');}catch(err){message(err.message,true);}};
 setInterval(()=>{if(state.logged&&!document.hidden)refresh();},15000);
})();


/* Phase 3G employee dashboard integration */
'use strict';
// Phase 3G: right-panel personal dashboard; uses existing authenticated Phase 3 APIs and UI actions.
(function () {
  const $ = id => document.getElementById(id);
  const root = $('wfMyDashboardPanel');
  if (!root) return;
  let snapshot = {user: null, tasks: [], notifications: []};
  let filter = 'NEW';
  let selectedTaskId = null;
  const closed = s => ['COMPLETED', 'CANCELLED'].includes(String(s || ''));
  const dateKey = d => d ? String(d).slice(0, 10) : '';
  const today = () => state.data.today||new Date().toISOString().slice(0,10);
  const isAdmin = () => snapshot.user?.role === 'ADMIN';
  function ownTasks() {
    // Even if backend returns all tasks for a privileged employee, this view is personal.
    // Admin dashboard is the exception: it displays the entire office task queue.
    return (snapshot.tasks || []).filter(t => isAdmin() || Number(t.assignee_id) === Number(snapshot.user?.id));
  }
  function counts(rows) {
    const day = today();
    return {
      NEW: rows.filter(t => t.current_status === 'ASSIGNED').length,
      PROGRESS: rows.filter(t => ['ACKNOWLEDGED', 'IN_PROGRESS', 'REOPENED'].includes(t.current_status)).length,
      TODAY: rows.filter(t => dateKey(t.due_date) === day && !closed(t.current_status)).length,
      OVERDUE: rows.filter(t => dateKey(t.due_date) && dateKey(t.due_date) < day && !closed(t.current_status)).length,
      ALL: rows.length,
      REVIEW: rows.filter(t => t.current_status === 'SUBMITTED_REVIEW').length, WAITING:rows.filter(t=>t.current_status==='WAITING_CLIENT').length,DONE:rows.filter(t=>t.current_status==='COMPLETED').length
    };
  }
  function show(which) {
    const dashboard = which === 'dashboard';
    $('wfMyDashboardPanel').hidden = !dashboard;
    $('wfClientWorkspacePanel').hidden = dashboard;
    for (const [id, selected] of [['wfSideDashboardTab', dashboard], ['wfSideClientTab', !dashboard]]) {
      const b = $(id); b.classList.toggle('selected', selected); b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1;
    }
    if (dashboard) render();
  }
  function selectTask(taskId) {
    selectedTaskId = Number(taskId) || null;
    filter = 'ALL';
    show('dashboard');
    const card = root.querySelector('[data-wf-task-id="' + selectedTaskId + '"]');
    if (card) { card.classList.add('wf-dash-highlight'); card.scrollIntoView({block:'nearest', behavior:'smooth'}); }
  }
  function button(label, action, variant='secondary') {
    const b = document.createElement('button'); b.type='button'; b.className=variant; b.textContent=label; b.addEventListener('click', action); return b;
  }
  function render() {
    const rows = ownTasks(), n = counts(rows);
    $('wfDashHeading').textContent = isAdmin() ? 'Office Dashboard' : 'My Dashboard';
    $('wfDashWelcome').textContent = snapshot.user ? (isAdmin() ? 'All staff work and Admin reviews' : (snapshot.user.displayName || snapshot.user.display_name || 'Employee') + ' · Assigned work') : 'Sign in to view your tasks';
    const stats = $('wfDashStats'); stats.replaceChildren();
    for (const [key, title] of [['NEW','New tasks'], ['PROGRESS','In Progress'], ['WAITING','Waiting for Client'], ['TODAY','Due today'], ['OVERDUE','Overdue'], ['REVIEW','Admin Review'], ['DONE','Job Done']]) {
      const b=button('', () => {filter=key; render();}); b.className='wf-dash-stat'+(key==='OVERDUE'&&n[key]?' warn':'');
      const num=document.createElement('b'); num.textContent=String(n[key]); const caption=document.createElement('small'); caption.textContent=title;
      b.append(num,caption); stats.append(b);
    }
    const badge=$('wfSideNewBadge'); badge.textContent=String(n.NEW); badge.hidden=n.NEW===0;
    root.querySelectorAll('[data-wf-dash-filter]').forEach(b => b.classList.toggle('active',b.dataset.wfDashFilter===filter));
    const list=$('wfDashTaskList'); list.replaceChildren();
    const day=today();
    let filtered=rows.filter(t => {
      const s=t.current_status;
      if(filter==='NEW')return s==='ASSIGNED';
      if(filter==='PROGRESS')return ['ACKNOWLEDGED','IN_PROGRESS','WAITING_CLIENT','REOPENED'].includes(s);
      if(filter==='TODAY')return dateKey(t.due_date)===day&&!closed(s);
      if(filter==='OVERDUE')return !!dateKey(t.due_date)&&dateKey(t.due_date)<day&&!closed(s);
      if(filter==='REVIEW')return s==='SUBMITTED_REVIEW';if(filter==='WAITING')return s==='WAITING_CLIENT';if(filter==='DONE')return s==='COMPLETED';
      return true;
    });
    const urgency=t=>dateKey(t.due_date)&&dateKey(t.due_date)<day&&!closed(t.current_status)?0:t.current_status==='ASSIGNED'?1:2;
    filtered=[...filtered].sort((a,b)=>urgency(a)-urgency(b)||(dateKey(a.due_date)||'9999').localeCompare(dateKey(b.due_date)||'9999')||Number(b.id)-Number(a.id));
    if (!filtered.length) { const empty=document.createElement('div');empty.className='empty';empty.textContent=filter==='NEW'?'No new assignments. Select All to see the rest of your tasks.':'No tasks match this filter.'; list.append(empty); }
    for(const t of filtered) {
      // Reuse original Phase 3 card for consistent, permission-aware status / review buttons.
      const card=window.WFPhase3?.taskCard?.(t);
      if(!card) continue;
      card.dataset.wfTaskId=String(t.id);
      if(Number(t.id)===selectedTaskId) card.classList.add('wf-dash-highlight');
      list.append(card);
    }
    const unread=(snapshot.notifications||[]).filter(n=>!n.read_at);
    $('wfDashUnread').textContent=unread.length+' unread';
    const notifications=$('wfDashNotificationList');notifications.replaceChildren();
    if(!snapshot.notifications.length){const p=document.createElement('p');p.className='tiny';p.textContent='No task notifications yet.';notifications.append(p);}
    for(const notif of (snapshot.notifications||[]).slice(0,12)){
      const item=document.createElement('div');item.className='wf3-alert';
      const title=document.createElement('strong');title.textContent=notif.title||'Task update';item.append(title);
      const detail=document.createElement('p');detail.className='tiny';detail.textContent=notif.message||'';item.append(detail);
      const linked=rows.find(t=>Number(t.id)===Number(notif.task_id));
      if(linked) item.append(button('Open task',()=>window.WFPhase3?.openTask(linked)));
      if(!notif.read_at) item.append(button('Mark read',async()=>{
        try{await api('phase3/notifications/read','POST',{id:notif.id});await window.WFPhase3?.refresh();}
        catch(err){status(err.message,true);}
      }));
      notifications.append(item);
    }
  }
  $('wfSideClientTab').addEventListener('click',()=>show('client'));
  $('wfSideDashboardTab').addEventListener('click',()=>show('dashboard'));
  $('wfDashRefresh').addEventListener('click',()=>window.WFPhase3?.refresh());
  root.querySelectorAll('[data-wf-dash-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.wfDashFilter;render();}));
  document.addEventListener('wf3:role',e=>{
    snapshot.user=e.detail.user;
    // Each login begins in role-appropriate right-side workspace.
    filter='NEW';selectedTaskId=null;
    show(snapshot.user?.role === 'ADMIN' ? 'client' : 'dashboard');
  });
  document.addEventListener('wf3:updated',e=>{
    snapshot={...e.detail};
    render();
  });
  document.addEventListener('wf3:reset',()=>{
    snapshot={user:null,tasks:[],notifications:[]};selectedTaskId=null;filter='NEW';show('client');
  });
  window.WFRightDashboard={show,selectTask,refresh:render};
})();
