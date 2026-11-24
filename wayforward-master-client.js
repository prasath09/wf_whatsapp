var WF_API_ORIGIN = String(window.WAYFORWARD_API_ORIGIN || '').replace(/\/$/, '');
'use strict';
// Client Master enhancements: existing WhatsApp and employee task logic remains in their original files.
(()=>{
 const el=id=>document.getElementById(id);
 const masterState={rows:[],selected:null,pendingMobile:'',loading:false,mode:'new',lookupSeq:0};
 const digits=v=>String(v||'').replace(/\D/g,'');
 const norm=v=>String(v??'').trim().toLowerCase();
 const admin=()=>!!window.WFPhase3?.isAdmin?.();
 async function request(path,method='GET',payload){
  const res=await fetch(WF_API_ORIGIN+'/api/wayforward/master/'+path,{method,credentials:'include',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok){const error=new Error(data.message||'Client Master request failed ('+res.status+')');error.code=data.code;throw error;}
  return data;
 }
 function message(txt,bad=false){el('wfmMessage').textContent=txt;el('wfmMessage').style.color=bad?'#b52b38':'#08764d';}
 const getContact=number=>masterState.rows.find(r=>String(r.linked_mobiles||'').split(',').includes(number))||null;
 function choice(label,fn,secondary=false){const b=document.createElement('button');b.type='button';b.className=secondary?'secondary':'wfm-match';b.textContent=label;b.onclick=fn;return b;}
 function start(source='WALK_IN',mobile=''){
  if(!admin())return status('Only Admin can create client masters.',true);
  el('wfmJobsBox').hidden=true;masterState.selected=null;masterState.mode='new';masterState.pendingMobile=digits(mobile);
  el('wfmForm').reset();el('wfmId').value='';el('wfmName').value='';el('wfmSource').value=source;el('wfmMobile').value=masterState.pendingMobile;
  el('wfmFormHeading').textContent=source==='WHATSAPP'?'Register WhatsApp enquiry':'New Audit Office Client';
  el('wfmFormSource').textContent=source==='WHATSAPP'?'From selected WhatsApp':'Manual registration';
  el('wfmLinkBox').hidden=true;message('');switchView('master');el('wfmName').focus({preventScroll:true});
 }
 function fill(r){
  if(!r)return;
  masterState.selected=r;masterState.mode='edit';masterState.pendingMobile='';
  const f={wfmId:r.id,wfmName:r.client_name,wfmType:r.client_type,wfmMobile:r.primary_mobile,wfmEmail:r.email,wfmPan:r.pan,wfmGstin:r.gstin,wfmTan:r.tan,wfmSource:r.acquisition_source,wfmAddress:r.address,wfmRemarks:r.remarks};
  for(const [k,v] of Object.entries(f))if(el(k))el(k).value=v??'';
  el('wfmFormHeading').textContent='Client Master · '+(r.client_code||'#'+r.id);el('wfmFormSource').textContent='Existing client';
  el('wfmLinkBox').hidden=true;message('Linked WhatsApp: '+(r.linked_mobiles||'None yet'));
  el('wfmJobsBox').hidden=false;void loadJobs(r);
  switchView('master');
 }
 async function loadJobs(r){
  const host=el('wfmJobsList'),audit=el('wfmAudit');host.replaceChildren();audit.replaceChildren();
  host.textContent='Loading linked jobs...';
  try{const data=await request('jobs/'+encodeURIComponent(r.id));if(Number(masterState.selected?.id)!==Number(r.id))return;
   host.replaceChildren();
   if(!data.cases?.length)host.textContent='No jobs recorded yet. Add a mobile to the client master, then create a job.';
   for(const job of data.cases||[]){
    const box=document.createElement('div');box.className='wfm-box';
    const title=document.createElement('strong');title.textContent=job.title+' · '+job.service;
    const meta=document.createElement('div');meta.className='tiny';meta.textContent=job.stage.replaceAll('_',' ')+' · '+(job.assigned_to||'Unassigned')+' · '+job.open_tasks+' open task(s) · '+job.mobile;
    box.append(title,meta,choice('Open job',async()=>{await selectClient(job.mobile);openCaseEditor(job.id);},true));host.append(box);
   }
   if(data.history?.length){const heading=document.createElement('h4');heading.textContent='Recent job history';audit.append(heading);
    for(const h of data.history.slice(0,15)){const line=document.createElement('div');line.className='tiny';line.style.padding='3px 0';line.textContent=h.action+' · '+h.title+' · '+h.stage+' · '+h.actor_name+' · '+String(h.created_at).slice(0,16);audit.append(line);}
   }
  }catch(e){host.textContent=e.message;}
 }
 function listDirectory(){
  const host=el('wfmDirectory');host.replaceChildren();const q=norm(el('wfmDirectorySearch').value);
  const records=masterState.rows.filter(r=>[r.client_name,r.client_code,r.primary_mobile,r.linked_mobiles,r.pan,r.gstin,r.tan].some(x=>norm(x).includes(q)));
  if(!records.length){host.textContent='No matching registered clients.';return;}
  for(const r of records.slice(0,100)){
   const b=choice((r.client_code||'#'+r.id)+' · '+r.client_name+' · '+(r.client_type||'')+' · '+(r.linked_mobiles||'No WhatsApp linked'),()=>{
    if(!admin()&&r.primary_mobile){selectClient(r.primary_mobile);return;}
    if(!admin())return status('Client details can only be edited by Admin.',true);
    fill(r);
   });host.append(b);
  }
 }
 async function fetchRecords(){
  if(!state.logged||masterState.loading)return;
  masterState.loading=true;
  try{const data=await request('clients');masterState.rows=data.rows||[];state.masterRows=masterState.rows;listDirectory();drawList();}
  catch(e){el('wfmDirectory').textContent=e.message;}
  finally{masterState.loading=false;}
 }
 function searchResults(){
  const host=el('wfmResults');host.replaceChildren();const q=norm(el('wfmLookup').value);
  if(!q){const t=document.createElement('div');t.className='tiny';t.textContent='Search for the existing client to link.';host.append(t);return;}
  const rows=masterState.rows.filter(r=>[r.client_name,r.client_code,r.primary_mobile,r.linked_mobiles,r.pan,r.gstin].some(v=>norm(v).includes(q)));
  for(const r of rows.slice(0,20)){
   const box=document.createElement('div');box.className='wfm-box';
   const text=document.createElement('div');text.textContent=(r.client_code||'#'+r.id)+' · '+r.client_name+' · '+r.client_type;box.append(text);
   const hint=document.createElement('small');hint.className='tiny';hint.textContent=r.linked_mobiles?'Already linked: '+r.linked_mobiles:'No WhatsApp number linked';box.append(hint);
   box.append(choice('Link this client to +'+masterState.pendingMobile,()=>link(r),true));host.append(box);
  }
  if(!rows.length)host.textContent='No matching client. Use Create New Client instead.';
 }
 async function link(r){
  if(!admin())return;
  const mobile=masterState.pendingMobile;
  if(!mobile)return message('Choose a WhatsApp enquiry first.',true);
  if(!confirm('Verify that +'+mobile+' belongs to '+r.client_name+' ('+(r.client_code||r.id)+'). Link this number to the existing Client Master?'))return;
  let confirmed=false;
  for(let i=0;i<2;i++){
   try{await request('link','POST',{masterId:r.id,mobile,confirmNameConflict:confirmed});await fetchRecords();el('wfmLinkBox').hidden=true;message('WhatsApp number linked successfully to '+r.client_name);await refreshAll();await selectClient(mobile);return;}
   catch(e){if(e.code==='LEGACY_NAME'&&!confirmed&&confirm(e.message+'\nAre you certain both records belong to the same client?')){confirmed=true;continue;}message(e.message,true);return;}
  }
 }
 async function updateChatActions(mobile){
  const pane=el('wfmChatActions');
  if(!mobile||!state.conversations.some(c=>c.mobile===mobile)){pane.hidden=true;return;}
  pane.hidden=false;const seq=++masterState.lookupSeq;
  el('wfmChatState').textContent='Checking Client Master...';
  try{
   const data=await request('lookup/'+encodeURIComponent(mobile));if(seq!==masterState.lookupSeq||mobile!==state.mobile)return;
   const found=data.client;
   el('wfmCreateFromChat').hidden=!!found||!admin();
   el('wfmLinkFromChat').hidden=!!found||!admin();
   el('wfmViewLinked').hidden=!found;
   el('wfmChatState').textContent=found?'Client '+found.client_code:'New contact · Not registered';
   el('wfmViewLinked').onclick=()=>fill(found);
  }catch(e){el('wfmChatState').textContent='Client Master lookup failed';el('wfmCreateFromChat').hidden=true;el('wfmLinkFromChat').hidden=true;el('wfmViewLinked').hidden=true;}
 }
 function openLink(mobile){
  if(!admin())return;
  masterState.pendingMobile=digits(mobile);masterState.mode='link';
  el('wfmLinkBox').hidden=false;el('wfmLinkHelp').textContent='Link +'+masterState.pendingMobile+' to an existing client. Verify the identity before linking.';
  message('Search the Client Master below and choose the correct record.');
  switchView('master');el('wfmLookup').value='';searchResults();el('wfmLookup').focus({preventScroll:true});
 }
 async function save(event){
  event.preventDefault();if(!admin())return message('Admin role required.',true);
  const body={id:el('wfmId').value||undefined,name:el('wfmName').value.trim(),clientType:el('wfmType').value,
   mobile:digits(el('wfmMobile').value),email:el('wfmEmail').value.trim(),pan:el('wfmPan').value.trim(),
   gstin:el('wfmGstin').value.trim(),tan:el('wfmTan').value.trim(),source:el('wfmSource').value,
   address:el('wfmAddress').value.trim(),remarks:el('wfmRemarks').value.trim()};
  const isNew=!body.id;
  if(isNew){
   const similar=masterState.rows.filter(r=>norm(r.client_name)===norm(body.name)||body.mobile&&String(r.linked_mobiles||'').split(',').includes(body.mobile)||body.pan&&norm(r.pan)===norm(body.pan)||body.gstin&&norm(r.gstin)===norm(body.gstin));
   if(similar.length&&!confirm('Possible existing client: '+similar.slice(0,3).map(r=>r.client_name+' ('+r.client_code+')').join(', ')+'. Verify the record before creating another. Continue?'))return;
  }
  const btn=el('wfmSave');btn.disabled=true;let confirmed=false;
  try{
   for(let attempt=0;attempt<2;attempt++){
    try{
     const result=await request('save','POST',{...body,confirmNameConflict:confirmed});
     message('Saved successfully. Client code '+('WF-'+String(result.id).padStart(6,'0'))+'.'+(result.mobile?' WhatsApp / mobile linked.':' No WhatsApp needed.'));
     await fetchRecords();await refreshAll();
     const r=masterState.rows.find(v=>Number(v.id)===Number(result.id));if(r)fill(r);
     if(result.mobile){await selectClient(result.mobile);switchView('master');}
     return;
    }catch(e){if(e.code==='LEGACY_NAME'&&!confirmed&&confirm(e.message+'\nConfirm that this is the correct customer before updating the chat name.')){confirmed=true;continue;}message(e.message,true);return;}
   }
  }finally{btn.disabled=false;}
 }
 function openMasterOnly(r){if(!r.primary_mobile&&!r.linked_mobiles){state.mobile='';state.messagesSignature='';renderWorkspace();drawList();}if(admin())fill(r);else{switchView('master');el('wfmDirectorySearch').value=r.client_name;listDirectory();}}
 el('wfmNewLeft').onclick=()=>start('WALK_IN');el('wfmNewProfile').onclick=()=>start('WALK_IN');el('wfmNewInProfile').onclick=()=>start('WALK_IN');
 el('wfmCreateFromChat').onclick=()=>start('WHATSAPP',state.mobile);el('wfmLinkFromChat').onclick=()=>openLink(state.mobile);
 el('wfmClear').onclick=()=>start('WALK_IN');el('wfmForm').onsubmit=save;
 el('wfmAddJob').hidden=true;el('wfmAddJob').onclick=null;
 el('wfmRefresh').onclick=fetchRecords;el('wfmLookup').oninput=searchResults;el('wfmDirectorySearch').oninput=listDirectory;
 document.querySelectorAll('[data-wfm-scope]').forEach(b=>b.onclick=()=>{state.masterScope=b.dataset.wfmScope;document.querySelectorAll('[data-wfm-scope]').forEach(x=>x.classList.toggle('selected',x===b));drawList();});
 document.addEventListener('wf3f:client',e=>{void updateChatActions(e.detail?.mobile||'');});
 el('loginForm').addEventListener('submit',()=>setTimeout(fetchRecords,1300));
 el('logout').addEventListener('click',()=>{masterState.rows=[];state.masterRows=[];el('wfmChatActions').hidden=true;});
 setTimeout(fetchRecords,1600);
 window.WFMaster={start,openLink,openMasterOnly,refresh:fetchRecords,getContact,updateChatActions};
})();
