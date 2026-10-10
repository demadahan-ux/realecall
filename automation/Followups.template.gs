/* Appointment emails only. An elapsed meeting is NEVER assumed to be a no-show.
 * A host must mark the invitee as a no-show in Calendly first.
 * No-show emails start only after setupNoShowFollowups is explicitly activated.
 */
var FU={id:0,name:1,company:2,email:3,status:4,start:5,zone:6,noShow:7,first:8,checkDue:9,checkSent:10,closeDue:11,closeSent:12,next:13,reschedule:14,slots:15,checked:16,issue:17,stop:18,closed:19,invitee:20,event:21,sending:22,attempt:23,closing:24,attendance:25,end:26};
function getFollowupSheet_(){
 var s=SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID).getSheetByName('Follow-ups');
 if(!s||JSON.stringify(s.getRange(1,1,1,FOLLOWUP_HEADERS.length).getValues()[0])!==JSON.stringify(FOLLOWUP_HEADERS))throw new Error('Follow-up tracker headers differ');
 return s;
}
function setupNoShowFollowups(){
 var p=PropertiesService.getScriptProperties();getLeadSheet_();getFollowupSheet_();
 if(p.getProperty('EMAIL_ENABLED')!=='true'||p.getProperty('CALENDLY_SYNC_ENABLED')!=='true')throw new Error('Connect and test inquiry email and Calendly sync first');
 if(calendlyApi_('/users/me').resource.uri!==CALENDLY_USER)throw new Error('Wrong Calendly host');
 if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(p.getProperty('REPLY_TO')||''))throw new Error('Set a monitored REPLY_TO address');
 if(p.getProperty('FOLLOWUP_WEBSITE_READY')!=='true')throw new Error('Verify that the configured RealeCall website is accessible to clients before enabling closing emails');
 if(!p.getProperty('FOLLOWUPS_ACTIVE_FROM'))p.setProperty('FOLLOWUPS_ACTIVE_FROM',new Date().toISOString());
 if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='runRealeCallFollowups';}))ScriptApp.newTrigger('runRealeCallFollowups').timeBased().everyMinutes(15).create();
 p.setProperty('FOLLOWUPS_ENABLED','true');
 return {ready:true,channel:'Email',cadence:'Marked no-show, 3 days later, another 3 days later',checkIntervalMinutes:15};
}
function stopNoShowFollowups(){PropertiesService.getScriptProperties().setProperty('FOLLOWUPS_ENABLED','false');}
function writeFollowup_(sheet,row,values){
 sheet.getRange(row,1,1,FOLLOWUP_HEADERS.length).setValues([values.map(function(v){return v instanceof Date||typeof v==='boolean'||typeof v==='number'?v:safeCell_(v);})]);SpreadsheetApp.flush();
}
function verifyFollowupBooking_(uri,email){
 var invitee=calendlyResource_(uri,'invitee');var event=calendlyResource_(invitee.event,'event');
 if(event.event_type!==CALENDLY_EVENT_TYPE||!(event.event_memberships||[]).some(function(m){return m.user===CALENDLY_USER;})||String(invitee.email).toLowerCase()!==String(email).replace(/^'/,'').toLowerCase())throw new Error('Booking does not match this lead');
 if(!Number.isFinite(Date.parse(event.start_time))||!Number.isFinite(Date.parse(event.end_time)))throw new Error('Missing booking times');
 localParts(Date.now(),invitee.timezone||'');
 return {invitee:invitee,event:event};
}
function ensureFollowup_(lead){
 if(!lead[36]||String(lead[33])!=='Yes')return;
 var b=verifyFollowupBooking_(String(lead[36]),lead[8]);var lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  var sheet=getFollowupSheet_();var n=sheet.getLastRow()-1;var ids=n>0?sheet.getRange(2,FU.invitee+1,n,1).getValues():[];
  if(ids.some(function(x){return x[0]===b.invitee.uri;}))return;
  var v=Array(FOLLOWUP_HEADERS.length).fill('');v[FU.id]=lead[0];v[FU.name]=lead[7];v[FU.company]=lead[6];v[FU.email]=lead[8];v[FU.status]='Scheduled';v[FU.start]=new Date(b.event.start_time);v[FU.end]=new Date(b.event.end_time);v[FU.zone]=b.invitee.timezone;v[FU.invitee]=b.invitee.uri;v[FU.event]=b.event.uri;v[FU.stop]=false;v[FU.attendance]='Pending review';
  if(b.invitee.rescheduled)v[FU.status]='Rescheduled';else if(b.invitee.status==='canceled'||b.event.status==='canceled')v[FU.status]='Canceled';
  if(v[FU.status]!=='Scheduled')v[FU.closed]=new Date();
  var row=sheet.getLastRow()+1;if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
  writeFollowup_(sheet,row,v);
 }finally{lock.releaseLock();}
}
function runRealeCallFollowups(){
 var p=PropertiesService.getScriptProperties();if(p.getProperty('FOLLOWUPS_ENABLED')!=='true')return;
 var began=Date.now(),leads=getLeadSheet_(),n=leads.getLastRow()-1;
 if(n>0){
  var cursor=Number(p.getProperty('FOLLOWUP_LEAD_CURSOR')||0)%n,rows=leads.getRange(2,1,n,HEADERS.length).getValues();
  for(var i=0;i<Math.min(n,20)&&Date.now()-began<180000;i++){
   var at=(cursor+i)%n;try{ensureFollowup_(rows[at]);}catch(e){p.setProperty('FOLLOWUPS_LAST_ERROR','Could not verify a booking. '+new Date().toISOString());}
   p.setProperty('FOLLOWUP_LEAD_CURSOR',String((at+1)%n));
  }
 }
 var sheet=getFollowupSheet_(),count=sheet.getLastRow()-1;if(count<1)return;
 var next=Number(p.getProperty('FOLLOWUP_CASE_CURSOR')||0)%count;
 for(var j=0;j<Math.min(count,20)&&Date.now()-began<240000;j++){
  var index=(next+j)%count;processFollowup_(index+2,new Date());p.setProperty('FOLLOWUP_CASE_CURSOR',String((index+1)%count));
 }
 p.setProperty('FOLLOWUPS_LAST_RUN',new Date().toISOString());
}
function futureBooking_(email,now){
 var path='/scheduled_events?user='+encodeURIComponent(CALENDLY_USER)+'&invitee_email='+encodeURIComponent(String(email).replace(/^'/,''))+'&status=active&min_start_time='+encodeURIComponent(now.toISOString())+'&count=100';
 for(var page=0;page<10;page++){
  var result=calendlyApi_(path);
  if(!Array.isArray(result.collection))throw new Error('New-booking check returned incomplete data');
  if((result.collection||[]).some(function(e){return e.event_type===CALENDLY_EVENT_TYPE&&e.status==='active'&&Date.parse(e.start_time)>now.getTime();}))return true;
  var token=result.pagination&&result.pagination.next_page_token;if(!token)return false;
  path=path.replace(/&page_token=.*$/,'')+'&page_token='+encodeURIComponent(token);
 }
 throw new Error('Could not finish checking newer bookings');
}
function availableFollowupTimes_(now,zone){
 var window=nextThreeDays(now,zone);var result=calendlyApi_('/event_type_available_times?event_type='+encodeURIComponent(CALENDLY_EVENT_TYPE)+'&start_time='+encodeURIComponent(window.start.toISOString())+'&end_time='+encodeURIComponent(window.end.toISOString()));
 if(!Array.isArray(result.collection))throw new Error('Availability check returned incomplete data');
 var seen={},labels=[];
 (result.collection||[]).filter(function(t){return t.status==='available'&&t.invitees_remaining>0&&Date.parse(t.start_time)>=window.start.getTime()&&Date.parse(t.start_time)<window.end.getTime();}).sort(function(a,b){return Date.parse(a.start_time)-Date.parse(b.start_time);}).forEach(function(t){
  var d=localParts(t.start_time,zone),key=d.year+'-'+d.month+'-'+d.day;
  if(!seen[key]&&labels.length<3){seen[key]=true;labels.push(localLabel(t.start_time,zone));}
 });
 return labels;
}
function safeRescheduleUrl_(url){return /^https:\/\/calendly\.com\/reschedulings\/[a-z0-9-]+(?:\?[^\s<>]*)?$/i.test(String(url||''))?url:'';}
function processFollowup_(row,now){
 var p=PropertiesService.getScriptProperties();if(p.getProperty('FOLLOWUPS_ENABLED')!=='true')return;
 var lock=LockService.getScriptLock();lock.waitLock(10000);var sheet,v;
 try{
  sheet=getFollowupSheet_();v=sheet.getRange(row,1,1,FOLLOWUP_HEADERS.length).getValues()[0];if(!v[FU.id])return;
  if(['Closed','Canceled','Rescheduled','Attended','Stopped'].indexOf(v[FU.status])>=0)return;
  if(v[FU.stop]===true||v[FU.attendance]==='Attended'){v[FU.status]=v[FU.attendance]==='Attended'?'Attended':'Stopped';v[FU.next]='';v[FU.closed]=now;writeFollowup_(sheet,row,v);return;}
  if(v[FU.sending]!==''&&v[FU.sending]!=null){v[FU.status]='Needs review';v[FU.issue]='A send result is uncertain. Check Google Sent mail; do not clear the sending stage until reviewed.';v[FU.next]='';writeFollowup_(sheet,row,v);return;}
  // Check the original lead and consent, not just the editable follow-up email cell.
  var leadSheet=getLeadSheet_(),leadCount=leadSheet.getLastRow()-1;
  var leadRows=leadCount>0?leadSheet.getRange(2,1,leadCount,HEADERS.length).getValues():[];
  var lead=leadRows.filter(function(x){return x[0]===v[FU.id];})[0];
  if(!lead||String(lead[33])!=='Yes'||String(lead[8]).toLowerCase()!==String(v[FU.email]).toLowerCase())throw new Error('Lead consent or email needs review');
  var b=verifyFollowupBooking_(v[FU.invitee],v[FU.email]),invitee=b.invitee,event=b.event;v[FU.checked]=now;
  if(lead[36]===invitee.uri){var mainIndex=leadRows.indexOf(lead)+2;leadSheet.getRange(mainIndex,35).setValue(invitee.status==='canceled'||event.status==='canceled'?'Canceled':invitee.no_show?'No show':'Confirmed');}
  if(invitee.rescheduled||Date.parse(event.start_time)>new Date(v[FU.start]).getTime()){v[FU.status]='Rescheduled';v[FU.next]='';v[FU.closed]=now;writeFollowup_(sheet,row,v);return;}
  if((invitee.status==='canceled'||event.status==='canceled')&&!v[FU.closing]){v[FU.status]='Canceled';v[FU.next]='';v[FU.closed]=now;writeFollowup_(sheet,row,v);return;}
  if(Date.parse(event.end_time)>now.getTime()){v[FU.status]='Scheduled';v[FU.next]='';writeFollowup_(sheet,row,v);return;}
  if(!invitee.no_show&&!v[FU.closing]){v[FU.status]='Awaiting attendance';v[FU.next]='';v[FU.issue]='Mark a genuine no-show in Calendly, or set Team attendance to Attended.';writeFollowup_(sheet,row,v);return;}
  var marked=invitee.no_show&&Date.parse(invitee.no_show.created_at),activated=Date.parse(p.getProperty('FOLLOWUPS_ACTIVE_FROM')||'');
  if(!v[FU.closing]&&(!Number.isFinite(marked)||!Number.isFinite(activated)||marked<activated)){v[FU.status]='Needs review';v[FU.issue]='This no-show predates activation or its timestamp is missing. No automatic email will be sent.';v[FU.next]='';writeFollowup_(sheet,row,v);return;}
  if(!v[FU.noShow])v[FU.noShow]=new Date(marked);v[FU.zone]=invitee.timezone;v[FU.reschedule]=safeRescheduleUrl_(invitee.reschedule_url)||CALENDLY_URL;v[FU.issue]='';
  var stage=v[FU.checkSent]?2:v[FU.first]?1:0;var due=stage===0?nextContactTime(now,v[FU.zone]):new Date(stage===1?v[FU.checkDue]:v[FU.closeDue]);
  if(!Number.isFinite(due.getTime()))throw new Error('Follow-up due time needs review');
  v[FU.status]=stage===0?'No show':stage===1?'Awaiting reschedule':'Check-in sent';v[FU.next]=due;
  if(now.getTime()<due.getTime()){writeFollowup_(sheet,row,v);return;}
  var allowed=nextContactTime(now,v[FU.zone]);if(allowed>now){v[FU.next]=allowed;writeFollowup_(sheet,row,v);return;}
  // Re-check every time, including independent new bookings through the website.
  if(futureBooking_(v[FU.email],now)){v[FU.status]='Rescheduled';v[FU.next]='';v[FU.closed]=now;writeFollowup_(sheet,row,v);return;}
  if(p.getProperty('EMAIL_ENABLED')!=='true'||MailApp.getRemainingDailyQuota()<1){v[FU.issue]='Email paused or daily quota reached; will retry without advancing the sequence.';writeFollowup_(sheet,row,v);return;}
  var slots=stage<2?availableFollowupTimes_(now,v[FU.zone]):[];if(stage<2)v[FU.slots]=slots.join('\n');
  if(stage===2){
   if(event.status!=='canceled'){
    if(!event.invitees_counter||event.invitees_counter.limit!==1||event.invitees_counter.active>1)throw new Error('Only a past one-to-one appointment can be closed automatically');
    // Durable intent lets a retry recognize our own closure. Never close a new slot.
    v[FU.closing]=now;writeFollowup_(sheet,row,v);
    calendlyApi_(String(event.uri).replace('https://api.calendly.com','')+'/cancellation','post',{reason:'Closing this missed RealeCall appointment after rescheduling reminders. You are welcome to rebook at '+WEBSITE_URL});
    event=calendlyResource_(event.uri,'event');if(event.status!=='canceled')throw new Error('Calendar closure not confirmed');
    if(lead[36]===invitee.uri)leadSheet.getRange(mainIndex,35).setValue('Canceled');
   }
   v[FU.closed]=now;
  }
  var message=followupMessage(stage,{name:String(v[FU.name]).replace(/^'/,''),timezone:v[FU.zone],appointment:localLabel(v[FU.start],v[FU.zone]),rescheduleUrl:v[FU.reschedule],bookingUrl:CALENDLY_URL,websiteUrl:WEBSITE_URL,slots:slots});
  var replyTo=p.getProperty('REPLY_TO');if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(replyTo||''))throw new Error('A monitored reply address is required');
  if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(String(v[FU.email]).replace(/^'/,'')))throw new Error('Recipient email needs review');
  v[FU.sending]=stage;v[FU.attempt]=now;writeFollowup_(sheet,row,v);
  try{MailApp.sendEmail({to:String(v[FU.email]).replace(/^'/,''),subject:message.subject,body:message.text,name:'RealeCall',replyTo:replyTo});}
  catch(error){v[FU.status]='Needs review';v[FU.next]='';v[FU.issue]='Google did not confirm sending. Review Sent mail before retrying.';writeFollowup_(sheet,row,v);return;}
  v[FU.sending]='';v[FU.issue]='';
  if(stage===0){v[FU.first]=now;v[FU.checkDue]=nextContactTime(addLocalDays(now,3,v[FU.zone]),v[FU.zone]);v[FU.next]=v[FU.checkDue];v[FU.status]='Awaiting reschedule';}
  else if(stage===1){v[FU.checkSent]=now;v[FU.closeDue]=nextContactTime(addLocalDays(now,3,v[FU.zone]),v[FU.zone]);v[FU.next]=v[FU.closeDue];v[FU.status]='Check-in sent';}
  else{v[FU.closeSent]=now;v[FU.next]='';v[FU.status]='Closed';}
  writeFollowup_(sheet,row,v);
 }catch(error){if(v&&sheet){v[FU.issue]=String(error.message||'Provider verification failed; no email sent').slice(0,220);writeFollowup_(sheet,row,v);}}
 finally{lock.releaseLock();}
}
