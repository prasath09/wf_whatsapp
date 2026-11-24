var WF_API_ORIGIN = String(window.WAYFORWARD_API_ORIGIN || '').replace(/\/$/, '');
// Phase 3F. Supplements the existing CRM without replacing Phase 2E/3 UI logic.
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const endpoint=WF_API_ORIGIN+'/api/wayforward/phase3/';
 const wf={mobile:'',profile:null,observer:null,sent:new Set(),active:false,loadToken:0,readBusy:false,readQueue:new Set(),readTimer:null,readers:new Map()};
 const isAdmin=()=>document.getElementById('app')?.classList.contains('wf3-admin');
 const fmt=date=>{if(!date)return '—';const d=new Date(date);return Number.isNaN(d.valueOf())?String(date).slice(0,10):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
 async function call(route,method='GET',body){
   const r=await fetch(endpoint+route,{method,credentials:'include',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
   const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.message||`Request failed (${r.status})`);return d;
 }
 function text(parent,tag,value,cls){const x=document.createElement(tag);x.textContent=String(value??'');if(cls)x.className=cls;parent.append(x);return x;}
 function button(parent,label,fn,cls='secondary'){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',fn);parent.append(b);return b;}
 function activeMobile(){return wf.mobile;}
 function clearForm(){ $('wf3fClientType').value='INDIVIDUAL';$('wf3fEmail').value='';$('wf3fAddress').value=''; }
 function drawProfile(data){
   const summary=$('wf3fSummary'),jobs=$('wf3fJobs'),history=$('wf3fHistory');summary.replaceChildren();jobs.replaceChildren();history.replaceChildren();
   const cases=data.cases||[],tasks=data.tasks||[],events=data.events||[],jobHistory=data.jobHistory||[];
   const services=[...new Set(cases.map(c=>c.service).filter(Boolean))];
   const active=cases.filter(c=>!['COMPLETED','REJECTED','CANCELLED'].includes(c.stage)).length;
   text(summary,'strong',data.client?.client_name||'Unnamed client');
   text(summary,'div','+'+data.client.mobile+' · '+(data.details.client_type||'INDIVIDUAL'),'tiny');
   for(const metric of [services.length+' service(s)',cases.length+' job(s)',active+' active job(s)',tasks.length+' task(s)'])text(summary,'span',metric,'wf3f-metric');
   if(services.length)text(summary,'div','Services: '+services.join(' · '),'tiny');
   $('clientName').value=data.client?.client_name||'';$('mobile').value=data.client.mobile;
   $('wf3fClientType').value=data.details.client_type||'INDIVIDUAL';
   $('wf3fEmail').value=data.details.email||'';$('wf3fAddress').value=data.details.address||'';
   if(!cases.length)text(jobs,'p','No jobs yet. Create a job to link employee tasks and documents.','muted');
   for(const c of cases){
     const card=text(jobs,'div','','wf3f-job');text(card,'strong',c.title);
     text(card,'p',`${c.service} · ${(window.WFPhase3?.label(c.stage)||c.stage.replaceAll('_',' '))} · ${c.assigned_to||'Unassigned'} · ${c.followup_date?fmt(c.followup_date):'No follow-up date'}`);
     if(c.reference_no)text(card,'p','Reference: '+c.reference_no);
     if(c.next_action)text(card,'p','Next action: '+c.next_action);
     const childTasks=tasks.filter(t=>Number(t.case_id)===Number(c.id));
     text(card,'small',childTasks.length+' task(s) · '+childTasks.filter(t=>(t.current_status||t.status)==='COMPLETED').length+' completed');
     button(card,isAdmin()?'Edit Job':'View Job',()=>{if(typeof openCaseEditor==='function' && isAdmin())openCaseEditor(c.id);else{switchView('cases');$('caseScope').value='selected';renderCases();}});
   }
   const timeline=[];
   jobHistory.forEach(e=>timeline.push({date:e.created_at,what:'Job '+e.action.toLowerCase()+': '+e.title+(e.note?' — '+e.note:''),who:e.actor_name||'Admin',status:e.stage}));
   cases.forEach(c=>timeline.push({date:c.created_at,what:'Job created: '+c.title,who:c.assigned_to||'—',status:c.stage}));
   tasks.forEach(t=>{timeline.push({date:t.created_at,what:'Task created: '+t.task_text,who:t.employee_name||t.assigned_to||'—',status:t.current_status||t.status});if(t.completed_at)timeline.push({date:t.completed_at,what:'Task completed: '+t.task_text,who:t.employee_name||t.assigned_to||'—',status:'COMPLETED'});});
   events.forEach(e=>timeline.push({date:e.created_at,what:'Task #'+e.task_id+' · '+e.action+(e.comment?' — '+e.comment:''),who:e.actor_name||'Admin',status:e.to_status}));
   timeline.sort((a,b)=>new Date(b.date)-new Date(a.date));
   if(!timeline.length)text(history,'p','No job or task history yet.','muted');
   for(const e of timeline.slice(0,140)){
     const row=text(history,'div','','wf3f-event');text(row,'div',e.what);text(row,'small',fmt(e.date)+' · '+e.who+' · '+String(e.status||'').replaceAll('_',' '),'tiny');
   }
 }
 async function loadProfile(mobile){if(!mobile){wf.profile=null;clearForm();$('wf3fSummary').textContent='Create a client profile or select a customer.';$('wf3fJobs').textContent='';$('wf3fHistory').textContent='';return;}
   const token=++wf.loadToken;try{const data=await call('client-history/'+encodeURIComponent(mobile));if(token!==wf.loadToken||wf.mobile!==mobile)return;wf.profile=data;
     // Do not replace fields while an employee is actively typing.
     if(!document.activeElement?.closest('#clientForm'))drawProfile(data);
   }catch(e){if(token===wf.loadToken)$('wf3fSummary').textContent=e.message;}
 }
 function paintReaders(){const nodes=document.querySelectorAll('#thread [data-wf-readers]');for(const node of nodes){const entries=wf.readers.get(node.dataset.wfReaders)||[];
   node.textContent=entries.length?'Read by: '+entries.map(r=>r.staff_name+' ('+fmt(r.first_viewed_at)+')').join(' · '):'Read by: —';
 }}
 async function getReaders(mobile){if(!mobile)return;try{const d=await call('message-readers/'+encodeURIComponent(mobile));if(wf.mobile!==mobile)return;
   wf.readers=new Map();for(const r of d.rows||[]){const key=String(r.message_id),list=wf.readers.get(key)||[];list.push(r);wf.readers.set(key,list);}paintReaders();
 }catch(e){console.warn('Could not load message read history',e.message);}}
 function queueRead(id){if(wf.sent.has(id)||!wf.active||document.hidden)return;wf.sent.add(id);wf.readQueue.add(Number(id));if(!wf.readTimer)wf.readTimer=setTimeout(flushReads,350);}
 async function flushReads(){wf.readTimer=null;if(wf.readBusy||!wf.readQueue.size||!wf.mobile)return;wf.readBusy=true;
   const mobile=wf.mobile,ids=[...wf.readQueue].slice(0,60);ids.forEach(id=>wf.readQueue.delete(id));
   try{await call('message-view','POST',{mobile,messageIds:ids});if(mobile===wf.mobile)await getReaders(mobile);}catch(e){console.warn('Message-view audit failed',e.message);ids.forEach(id=>wf.sent.delete(id));}finally{wf.readBusy=false;if(wf.readQueue.size&&!wf.readTimer)wf.readTimer=setTimeout(flushReads,700);}
 }
 function observeVisible(){wf.observer?.disconnect();if(!wf.active||document.hidden)return;
   const container=$('thread');if(!container)return;
   wf.observer=new IntersectionObserver(entries=>{
     for(const e of entries)if(e.isIntersecting&&e.intersectionRatio>=.5&&wf.active&&e.target.closest('#thread')){
       queueRead(e.target.dataset.wfMessageId);wf.observer?.unobserve(e.target);
     }
   },{root:container,threshold:[.5]});
   container.querySelectorAll('[data-wf-message-id]').forEach(node=>wf.observer.observe(node));
 }
 function setClient(mobile){const changed=wf.mobile!==mobile;wf.mobile=mobile;wf.active=$('chatView').classList.contains('active');if(changed){wf.sent.clear();wf.readQueue.clear();wf.readers.clear();wf.observer?.disconnect();wf.loadToken++;}
   getReaders(mobile);loadProfile(mobile);observeVisible();}
 // Relocate the existing client master form. Keep the legacy inputs hidden for the Phase 2 JS compatibility.
 $('wf3fClientFormHome').append($('clientBox'));
 $('wf3fNewJob').onclick=()=>{if(!wf.mobile){alert('Select or save a client first.');return;}if(!isAdmin())return;
   if(typeof clearCase==='function')clearCase();if(typeof goRight==='function')goRight('caseBox');$('caseTitle').focus();};
 document.addEventListener('wf3f:client',e=>setClient(e.detail.mobile||''));
 document.addEventListener('wf3f:view',e=>{wf.active=e.detail.name==='chat';if(e.detail.name==='profile')loadProfile(wf.mobile);observeVisible();});
 document.addEventListener('wf3f:thread',e=>{if(wf.mobile!==e.detail.mobile){wf.mobile=e.detail.mobile;wf.sent.clear();wf.readers.clear();}
   paintReaders();observeVisible();getReaders(e.detail.mobile);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)wf.observer?.disconnect();else observeVisible();});
 // When the app starts with an existing session, other scripts dispatch events on selection.
})();
