var WF_API_ORIGIN = String(window.WAYFORWARD_API_ORIGIN || '').replace(/\/$/, '');
'use strict';
// Phase 3I: all "New Job" entry points share this form and API.
(function(){
 const el=id=>document.getElementById(id);
 const form=el('wfUnifiedJobForm');if(!form)return;
 let employees=[];let masterId=null;
 const jobsApi=(path,method,data)=>api('phase3/'+path,method,data);
 const serviceOptions=['GST','Income Tax','TDS','ROC / MCA','Audit','DSC','FSSAI','MSME','Accounting','Other'];
 const choose=el('wfujService');for(const name of serviceOptions)choose.add(new Option(name,name));
 const warning=msg=>{el('wfujError').textContent=msg||'';};
 const modal=el('wfUnifiedJobModal');
 async function employeesLoad(){
  const result=await jobsApi('employee-master');employees=result.rows||[];
  const select=el('wfujStaff');select.replaceChildren(new Option('Select employee',''));
  for(const e of employees){
   const op=new Option(e.employee_name+(e.can_assign?'':' — create/activate login'),String(e.staff_id||''));
   op.disabled=!e.can_assign;select.add(op);
  }
  const inactive=employees.filter(e=>!e.can_assign).map(e=>e.employee_name);
  el('wfujStaffHelp').textContent=inactive.length?'Login required for: '+inactive.join(', ')+'. Create their named logins under Staff Tasks → Employee Accounts.':'All registered employees can receive job notifications.';
 }
 function selectedMobile(){return String(state?.mobile||'').replace(/\D/g,'');}
 function findMaster(mobile){
  const list=window.WFMaster?.getContact?.(mobile);return list||null;
 }
 async function open(opts={}){
  if(!window.WFPhase3?.isAdmin?.())return status('Only Admin can create and assign new jobs.',true);
  const mobile=String(opts.mobile||selectedMobile()).replace(/\D/g,'');
  if(!/^\d{8,15}$/.test(mobile))return status('Select a registered client with a contact number first.',true);
  form.reset();warning('');masterId=null;
  el('wfujMobile').value=mobile;
  const linked=findMaster(mobile);
  masterId=linked?.id||linked?.master_id||null;
  el('wfujClient').textContent=(linked?.client_name||clientName(mobile)||'Selected client')+' · +'+mobile;
  el('wfujSourceId').value=opts.sourceMessageId||'';
  el('wfujSourceInfo').textContent=opts.sourceMessageId?'Linked to incoming WhatsApp message #'+opts.sourceMessageId:'Manually created from Client Workspace';
  if(opts.sourceText){el('wfujDescription').value=String(opts.sourceText).slice(0,3000);}
  el('wfujPriority').value='NORMAL';
  modal.hidden=false;
  try{await employeesLoad();}catch(e){warning('Could not load employee master: '+e.message);}
  el('wfujTitle').focus();
 }
 function close(){modal.hidden=true;warning('');}
 form.addEventListener('submit',async e=>{
  e.preventDefault();warning('');
  if(!el('wfujStaff').value)return warning('Select an active employee login. Create their login under Staff Tasks first.');
  const button=el('wfujSave');button.disabled=true;
  try{
   const data={mobile:el('wfujMobile').value,clientMasterId:masterId||null,
    sourceMessageId:el('wfujSourceId').value||null,service:el('wfujService').value,title:el('wfujTitle').value,
    periodLabel:el('wfujYear').value,description:el('wfujDescription').value,
    assigneeId:Number(el('wfujStaff').value),priority:el('wfujPriority').value,dueDate:el('wfujDue').value,
    followupDate:el('wfujFollowup').value,referenceNo:el('wfujReference').value,remarks:el('wfujRemarks').value};
   const result=await jobsApi('unified-jobs','POST',data);
   close();await refreshData();await window.WFPhase3?.refresh();await window.WFMaster?.refresh?.();
   window.WFRightDashboard?.show('client');status('Job '+result.jobCode+' created. Employee notified.');
  }catch(err){warning(err.message||'Could not save job.');}finally{button.disabled=false;}
 });
 el('wfujClose').onclick=close;el('wfujCancel').onclick=close;
 modal.addEventListener('click',event=>{if(event.target===modal)close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close();});
 // Assign the existing buttons to one canonical form, retaining historical edit controls.
 const entryIds=['wfQuickNewJob','addCaseForClient','wf3fNewJob'];
 for(const id of entryIds){const b=el(id);if(b)b.onclick=()=>open();}
 for(const id of ['newCase','newTask','addTaskForClient','wfmAddJob']){const button=el(id);if(button){button.hidden=true;button.onclick=null;}}
 // Existing case/task create forms stay in DOM for historical editing, but are no longer entry points.
 // Dynamic incoming WhatsApp message buttons use capture so the older handler cannot open the legacy form.
 document.addEventListener('click',e=>{
  const btn=e.target.closest?.('.wf3-msg-btn');if(!btn)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  const message=btn.closest('[data-wf-message-id]');
  if(message)open({sourceMessageId:message.dataset.wfMessageId,sourceText:message.firstChild?.textContent||''});
 },true);
 el('wfQuickAssign').onclick=()=>{switchView('phase3');status('Choose an existing assigned job to reassign.');};
 window.WFUnifiedJobs={open,close,refreshEmployees:employeesLoad};
 // Display the three seeded directory employees and a shortcut to the existing Admin staff login form.
 async function showDirectory(){
  const dest=el('wfujEmployeeDirectory');if(!dest)return;
  try{await employeesLoad();dest.replaceChildren();
   for(const x of employees){const row=document.createElement('div');row.className='wfuj-employee-row';
    const label=document.createElement('span');label.textContent=x.employee_code+' · '+x.employee_name;
    const state=document.createElement('small');state.textContent=x.can_assign?'Login active':'Login not set up';row.append(label,state);dest.append(row);
   }
  }catch(e){dest.textContent='Could not load directory: '+e.message;}
 }
 const staffTab=el('wf3StaffAdmin');if(staffTab){const heading=document.createElement('h4');heading.textContent='Employee Master · Job Assignment';
  const panel=document.createElement('div');panel.id='wfujEmployeeDirectory';
  const note=document.createElement('p');note.className='tiny';note.textContent='Prasath, Guru and Shalini are seeded once. Create a named staff login with the matching username below to activate assignments.';
  staffTab.insertBefore(note,staffTab.firstChild);staffTab.insertBefore(panel,staffTab.firstChild);staffTab.insertBefore(heading,staffTab.firstChild);
  document.addEventListener('wf3:role',()=>{if(window.WFPhase3?.isAdmin?.())showDirectory();});
  const staffForm=el('wf3StaffForm');staffForm?.addEventListener('submit',()=>setTimeout(showDirectory,1200));
  el('wf3Refresh')?.addEventListener('click',()=>showDirectory());
 }
})();
