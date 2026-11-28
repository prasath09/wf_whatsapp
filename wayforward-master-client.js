var WF_API_ORIGIN = String(window.WAYFORWARD_API_ORIGIN || '').replace(/\/$/, '');
'use strict';
// Client Master enhancements: existing WhatsApp and employee task logic remains in their original files.
(()=>{
 const el=id=>document.getElementById(id);
 const masterState={rows:[],selected:null,pendingMobile:'',loading:false,mode:'idle',lookupSeq:0,formSeq:0,baseline:'',saving:false,selectedOfficeId:null};
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
 const getContact=number=>masterState.rows.find(r=>r.primary_mobile===number||String(r.linked_mobiles||'').split(',').includes(number))||null;
 function choice(label,fn,secondary=false){const b=document.createElement('button');b.type='button';b.className=secondary?'secondary':'wfm-match';b.textContent=label;b.onclick=fn;return b;}
 function start(source='WALK_IN',mobile=''){
  if(!admin())return status('Only Admin can create client masters.',true);
  if(!allowLeave())return;resetPanel('New Client','new');el('wfmForm').hidden=false;
  el('wfSharedMaster').hidden=true;masterState.selected=null;masterState.mode='new';masterState.pendingMobile=digits(mobile);
  el('wfmForm').reset();el('wfmId').value='';el('wfmName').value='';el('wfmSource').value=source;el('wfmMobile').value=masterState.pendingMobile;
  el('wfmFormHeading').textContent=source==='WHATSAPP'?'Register WhatsApp enquiry':'New Audit Office Client';
  el('wfmFormSource').textContent=source==='WHATSAPP'?'From selected WhatsApp':'Manual registration';
  el('wfmLinkBox').hidden=true;message('');clean();switchView('master');el('wfmName').focus({preventScroll:true});
 }
 function fill(r){
  if(!r)return;
  masterState.selected=r;masterState.mode='edit';el('wfmForm').hidden=false;el('wfmUnknownActions').hidden=true;el('wfmPanelMessage').textContent=admin()?'':(r.client_name+' · '+(r.client_type||'')+' · '+(r.primary_mobile||state.mobile||'No mobile linked')+' — Only Admin can edit permanent client details.');masterState.pendingMobile='';
  const f={wfmId:r.id,wfmName:r.client_name,wfmType:r.client_type,wfmMobile:r.primary_mobile,wfmEmail:r.email,wfmPan:r.pan,wfmGstin:r.gstin,wfmTan:r.tan,wfmSource:r.acquisition_source,wfmAddress:r.address,wfmRemarks:r.remarks};
  if(r.client_type&&!Array.from(el('wfmType').options).some(o=>o.value===r.client_type))el('wfmType').add(new Option(r.client_type,r.client_type));for(const [k,v] of Object.entries(f))if(el(k))el(k).value=v??'';
  el('wfmFormHeading').textContent='Client Master · '+(r.client_code||'#'+r.id);el('wfmFormSource').textContent='Existing client';
  el('wfmLinkBox').hidden=true;message('Linked WhatsApp: '+(r.linked_mobiles||'None yet'));
  const shared=el('wfSharedMaster');shared.hidden=!admin();shared.onclick=()=>window.open('https://prasath09.github.io/wayforward-main-crm/?client='+encodeURIComponent(r.id),'_blank','noopener');
  clean();if(state.view!=='master')switchView('master');
 }
 function snapshot(){return JSON.stringify([...el('wfmForm').querySelectorAll('input,select,textarea')].map(x=>x.value));}
 function clean(){masterState.baseline=snapshot();}
 function dirty(){return ['edit','new'].includes(masterState.mode)&&masterState.baseline!==snapshot();}
 function allowLeave(){if(masterState.saving){status('Client Master save is in progress.',true);return false;}return !dirty()||confirm('Discard unsaved Client Master changes?');}
 function resetPanel(label,mode='idle'){
  ++masterState.formSeq;masterState.mode=mode;masterState.selected=null;masterState.pendingMobile='';el('wfmForm').reset();el('wfmId').value='';el('wfmForm').hidden=true;el('wfSharedMaster').hidden=true;el('wfmLinkBox').hidden=true;el('wfmUnknownActions').hidden=true;el('wfmFormHeading').textContent=label;el('wfmFormSource').textContent='';el('wfmPanelMessage').textContent='';clean();
 }
 async function fetchRecords(){
  if(!state.logged)return;
  if(masterState.loading)return masterState.loading;
  const task=(async()=>{try{const rows=[];let offset=0;for(;;){const data=await request('clients?offset='+offset);rows.push(...(data.rows||[]));if(!data.nextOffset)break;offset=data.nextOffset;}if(!state.logged)return;masterState.rows=rows;state.masterRows=rows;drawList();}catch(e){status('Client list: '+e.message,true);throw e;}})();
  masterState.loading=task;try{await task;}finally{masterState.loading=false;}
 }
 async function loadSelected(){
  const mobile=state.mobile,officeId=masterState.selectedOfficeId;
  resetPanel(mobile||officeId?'Loading selected client…':'Select a client from the left panel','loading');const seq=masterState.formSeq;
  if(!mobile&&!officeId){masterState.mode='idle';return;}
  try{const cached=mobile?getContact(mobile):null;let data=await request(officeId?'record/'+encodeURIComponent(officeId):'lookup/'+encodeURIComponent(mobile));if(!data.client&&cached?.primary_mobile===mobile){const fallback=await request('record/'+encodeURIComponent(cached.id));if(fallback.client?.primary_mobile===mobile)data=fallback;}
   if(seq!==masterState.formSeq||state.mobile!==mobile||masterState.selectedOfficeId!==officeId||state.view!=='master'||!state.logged)return;
   if(data.client?.id){fill(data.client);return;}
   if(!mobile)throw Error('Selected master record is unavailable.');
   resetPanel('Unregistered contact · +'+mobile,'unknown');el('wfmPanelMessage').textContent='Register this enquiry or link it to an existing client.';el('wfmUnknownActions').hidden=!admin();
  }catch(e){if(seq===masterState.formSeq){resetPanel('Unable to load selected client','error');el('wfmPanelMessage').textContent=e.message;}}
 }
 function selectionChanged(){resetPanel('Select Client Master');if(state.view==='master')void loadSelected();}
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
  if(!admin()||masterState.saving||masterState.mode!=='link')return;
  const mobile=masterState.pendingMobile;
  if(!mobile)return message('Choose a WhatsApp enquiry first.',true);
  if(!confirm('Verify that +'+mobile+' belongs to '+r.client_name+' ('+(r.client_code||r.id)+'). Link this number to the existing Client Master?'))return;
  let confirmed=false;masterState.saving=true;
  try{for(let i=0;i<2;i++){
   try{await request('link','POST',{masterId:r.id,mobile,confirmNameConflict:confirmed});await fetchRecords().catch(()=>{});if(state.mobile!==mobile)return;masterState.saving=false;el('wfmLinkBox').hidden=true;message('WhatsApp number linked successfully to '+r.client_name);await refreshAll();await selectClient(mobile,{keepView:true});return;}
   catch(e){if(e.code==='LEGACY_NAME'&&!confirmed&&confirm(e.message+'\nAre you certain both records belong to the same client?')){confirmed=true;continue;}el('wfmPanelMessage').textContent=e.message;return;}
  }}finally{masterState.saving=false;}
 }
 async function updateChatActions(mobile){
  const pane=el('wfmChatActions');
  const seq=++masterState.lookupSeq;if(!mobile||!state.conversations.some(c=>c.mobile===mobile)){pane.hidden=true;return;}
  pane.hidden=false;el('wfmCreateFromChat').hidden=true;el('wfmLinkFromChat').hidden=true;el('wfmViewLinked').hidden=true;
  el('wfmChatState').textContent='Checking Client Master...';
  try{
   const data=await request('lookup/'+encodeURIComponent(mobile));if(seq!==masterState.lookupSeq||mobile!==state.mobile)return;
   const found=data.client;
   el('wfmCreateFromChat').hidden=!!found||!admin();
   el('wfmLinkFromChat').hidden=!!found||!admin();
   el('wfmViewLinked').hidden=!found;
   el('wfmChatState').textContent=found?'Client '+found.client_code:'New contact · Not registered';
   el('wfmViewLinked').onclick=()=>editSelected(mobile);
  }catch(e){if(seq!==masterState.lookupSeq||mobile!==state.mobile)return;el('wfmChatState').textContent='Client Master lookup failed';el('wfmCreateFromChat').hidden=true;el('wfmLinkFromChat').hidden=true;el('wfmViewLinked').hidden=true;}
 }
 function openLink(mobile){
  if(!admin()||!allowLeave())return;resetPanel('Link existing client','link');
  masterState.pendingMobile=digits(mobile);masterState.mode='link';
  el('wfmLinkBox').hidden=false;el('wfmLinkHelp').textContent='Link +'+masterState.pendingMobile+' to an existing client. Verify the identity before linking.';
  el('wfmPanelMessage').textContent='Search for the existing client below.';
  switchView('master');el('wfmLookup').value='';searchResults();el('wfmLookup').focus({preventScroll:true});
 }
 async function save(event){
  event.preventDefault();if(!admin()||masterState.saving||!['new','edit'].includes(masterState.mode)||el('wfmForm').hidden)return;
  if(masterState.mode==='edit'&&String(masterState.selected?.id)!==el('wfmId').value)return message('Selected client mismatch. Reload before saving.',true);
  const body={core_version:masterState.selected?.core_version,id:el('wfmId').value||undefined,name:el('wfmName').value.trim(),clientType:el('wfmType').value,
   mobile:digits(el('wfmMobile').value),email:el('wfmEmail').value.trim(),pan:el('wfmPan').value.trim(),
   gstin:el('wfmGstin').value.trim(),tan:el('wfmTan').value.trim(),source:el('wfmSource').value,
   address:el('wfmAddress').value.trim(),remarks:el('wfmRemarks').value.trim()};
  const isNew=!body.id;
  if(isNew){
   const similar=masterState.rows.filter(r=>norm(r.client_name)===norm(body.name)||body.mobile&&String(r.linked_mobiles||'').split(',').includes(body.mobile)||body.pan&&norm(r.pan)===norm(body.pan)||body.gstin&&norm(r.gstin)===norm(body.gstin));
   if(similar.length&&!confirm('Possible existing client: '+similar.slice(0,3).map(r=>r.client_name+' ('+r.client_code+')').join(', ')+'. Verify the record before creating another. Continue?'))return;
  }
  const btn=el('wfmSave');btn.disabled=true;masterState.saving=true;let confirmed=false,mirrorConfirmed=false;
  try{
   for(let attempt=0;attempt<3;attempt++){
    try{
     const result=await request('save','POST',{...body,confirmNameConflict:confirmed,confirmMirrorReconcile:mirrorConfirmed});
     message('Saved successfully. Client code '+('WF-'+String(result.id).padStart(6,'0'))+'.'+(result.mobile?' WhatsApp / mobile linked.':' No WhatsApp needed.'));
     clean();await fetchRecords().catch(()=>{});await refreshAll();
     masterState.saving=false;
     if(result.mobile){await selectClient(result.mobile,{keepView:true});}else{await openMasterOnly({id:result.id});}
     if(state.view!=='master')switchView('master');else await loadSelected();
     if(masterState.mode==='edit')message('Client Master saved successfully.');return;
    }catch(e){if(e.code==='LEGACY_PROFILE'&&!mirrorConfirmed&&confirm(e.message)){mirrorConfirmed=true;continue;}if(e.code==='LEGACY_NAME'&&!confirmed&&confirm(e.message+'\nConfirm that this is the correct customer before updating the chat name.')){confirmed=true;continue;}message(e.message,true);return;}
   }
  }finally{btn.disabled=false;masterState.saving=false;}
 }
 async function openMasterOnly(r){
  if(!allowLeave())return false;masterState.selectedOfficeId=String(r.id);resetPanel('Loading office client…');state.mobile='';state.messagesSignature='';state.canReply=false;state.closedMobile='';state.closedThroughId=0;el('note').value='';el('notes').textContent='No mobile linked.';el('reply').disabled=true;el('send').disabled=true;renderMessages([]);updateSavedMessageAvailability();clearCase();clearTask();renderWorkspace();loadDocuments();loadTemplateConsent();el('current').textContent=r.client_name||'Office client';document.dispatchEvent(new CustomEvent('wf3f:client',{detail:{mobile:''}}));drawList();if(state.view!=='master')switchView('master');else await loadSelected();return true;
 }
 el('wfmNewLeft').onclick=()=>start('WALK_IN');el('wfmNewProfile').onclick=()=>start('WALK_IN');el('wfmNewInProfile').onclick=()=>start('WALK_IN');
 el('wfmCreateFromChat').onclick=()=>start('WHATSAPP',state.mobile);el('wfmLinkFromChat').onclick=()=>openLink(state.mobile);
 el('wfmRegisterSelected').onclick=()=>start('WHATSAPP',state.mobile);el('wfmLinkSelected').onclick=()=>openLink(state.mobile);
 el('wfmClear').onclick=()=>{if(allowLeave())void loadSelected();};el('wfmForm').onsubmit=save;
 el('wfmReloadSelected').onclick=()=>{if(allowLeave())void loadSelected();};el('wfmLookup').oninput=searchResults;
 document.querySelectorAll('[data-wfm-scope]').forEach(b=>b.onclick=()=>{state.masterScope=b.dataset.wfmScope;document.querySelectorAll('[data-wfm-scope]').forEach(x=>x.classList.toggle('selected',x===b));drawList();});
 document.addEventListener('wf3f:client',e=>{void updateChatActions(e.detail?.mobile||'');});
 document.addEventListener('wf3f:view',e=>{if(e.detail.name==='master'&&!['new','link','edit','loading'].includes(masterState.mode))void loadSelected();});
 document.addEventListener('wf3:role',()=>{if(state.logged)void fetchRecords().catch(()=>{});});
 el('loginForm').addEventListener('submit',()=>setTimeout(()=>void fetchRecords().catch(()=>{}),1300));
 document.addEventListener('wf3:reset',()=>{masterState.rows=[];state.masterRows=[];masterState.selectedOfficeId=null;resetPanel('Select a client');el('wfmChatActions').hidden=true;});
 setTimeout(()=>void fetchRecords().catch(()=>{}),1600);
 async function editSelected(mobile){
  if(!mobile||mobile!==state.mobile)return status('Select a registered client first.',true);
  if(!allowLeave())return;resetPanel('Loading selected client');if(state.view!=='master')switchView('master');else await loadSelected();
 }
 window.WFMaster={start,openLink,openMasterOnly,refresh:fetchRecords,getContact,updateChatActions,editSelected,allowLeave,selectionChanged,selectedOfficeId:()=>masterState.selectedOfficeId,clearOffice:()=>{masterState.selectedOfficeId=null;},leaveMaster:()=>resetPanel('Select Client Master'),isSaving:()=>masterState.saving};
})();
