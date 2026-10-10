/* Calendly owns availability, booking, and appointment notifications.
 * A webhook only wakes this script. We fetch the authoritative invitee and
 * event from the Calendly API before updating the restricted tracker.
 * Add a CALENDLY_API_TOKEN in Script Properties, never in source or chat.
 */
function calendlyApi_(path,method,body){
 if(!/^\/[a-z_0-9\/-]+(?:\?[^\s]*)?$/i.test(path))throw new Error('Invalid provider path');
 var token=PropertiesService.getScriptProperties().getProperty('CALENDLY_API_TOKEN');
 if(!token)throw new Error('Calendly API connection is not configured');
 var options={method:method||'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:false};
 if(body){options.contentType='application/json';options.payload=JSON.stringify(body);}
 var response=UrlFetchApp.fetch('https://api.calendly.com'+path,options);
 if(response.getResponseCode()<200||response.getResponseCode()>=300)throw new Error('Calendly request did not succeed');
 return JSON.parse(response.getContentText());
}
function calendlyResource_(uri,kind){
 var path=String(uri||'').replace('https://api.calendly.com','');
 var pattern=kind==='invitee'?/^\/scheduled_events\/[a-z0-9-]+\/invitees\/[a-z0-9-]+$/i:/^\/scheduled_events\/[a-z0-9-]+$/i;
 if(!String(uri||'').startsWith('https://api.calendly.com/')||!pattern.test(path))throw new Error('Invalid Calendly reference');
 return calendlyApi_(path).resource;
}
function setupCalendlyWebhook(){
 var p=PropertiesService.getScriptProperties();
 if(calendlyApi_('/users/me').resource.uri!==CALENDLY_USER)throw new Error('Use the Calendly account connected for RealeCall');
 var root=ScriptApp.getService().getUrl();
 if(!root||!/\/exec$/.test(root))throw new Error('Deploy the web app before connecting Calendly');
 var secret=p.getProperty('CALENDLY_WEBHOOK_SECRET');
 if(!secret){secret=Utilities.getUuid()+Utilities.getUuid();p.setProperty('CALENDLY_WEBHOOK_SECRET',secret);}
 var callback=root+'?calendly_secret='+encodeURIComponent(secret);
 var path='/webhook_subscriptions?organization='+encodeURIComponent(CALENDLY_ORGANIZATION)+'&user='+encodeURIComponent(CALENDLY_USER)+'&scope=user&count=100';
 var found=false;
 for(var page=0;page<10&&path;page++){
  var list=calendlyApi_(path);
  (list.collection||[]).forEach(function(h){if(h.callback_url===callback&&h.state==='active'&&h.events.indexOf('invitee.created')>=0&&h.events.indexOf('invitee.canceled')>=0)found=true;});
  if(found)break;
  path=list.pagination&&list.pagination.next_page_token?'/webhook_subscriptions?organization='+encodeURIComponent(CALENDLY_ORGANIZATION)+'&user='+encodeURIComponent(CALENDLY_USER)+'&scope=user&count=100&page_token='+encodeURIComponent(list.pagination.next_page_token):null;
 }
 if(path&&!found)throw new Error('Could not finish checking existing webhook subscriptions');
 if(!found)calendlyApi_('/webhook_subscriptions','post',{url:callback,events:['invitee.created','invitee.canceled'],organization:CALENDLY_ORGANIZATION,user:CALENDLY_USER,scope:'user'});
 var hasRetry=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='retryCalendlyBookings';});
 if(!hasRetry)ScriptApp.newTrigger('retryCalendlyBookings').timeBased().everyMinutes(5).create();
 p.setProperty('CALENDLY_SYNC_ENABLED','true');
 return {ready:true,verifiedHost:true,bookingEmailProvider:'Calendly',trackerId:DEFAULT_SPREADSHEET_ID};
}
function receiveCalendly_(e,body){
 var p=PropertiesService.getScriptProperties();var secret=p.getProperty('CALENDLY_WEBHOOK_SECRET');
 if(p.getProperty('CALENDLY_SYNC_ENABLED')!=='true'||!secret||!e.parameter||e.parameter.calendly_secret!==secret)return json_({ok:false,error:'Unauthorized'});
 var uri=body.payload&&body.payload.uri;
 if(!/^https:\/\/api.calendly.com\/scheduled_events\/[a-z0-9-]+\/invitees\/[a-z0-9-]+$/i.test(uri||''))return json_({ok:false,error:'Invalid event'});
 // Persist a minimal queue item before any provider call. Apps Script cannot
 // return custom error HTTP codes; the timed retry handles transient failures.
 var key='CAL_QUEUE_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,uri));
 var lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  if(Object.keys(p.getProperties()).filter(function(k){return k.indexOf('CAL_QUEUE_')===0;}).length>=250&&!p.getProperty(key))return json_({ok:false,error:'Queue requires attention'});
  p.setProperty(key,JSON.stringify({uri:uri,receivedAt:new Date().toISOString()}));
 }finally{lock.releaseLock();}
 processCalendlyQueue_(key);
 return json_({ok:true});
}
function retryCalendlyBookings(){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('CALENDLY_SYNC_ENABLED')!=='true')return;
 Object.keys(p.getProperties()).filter(function(k){return k.indexOf('CAL_QUEUE_')===0;}).slice(0,20).forEach(processCalendlyQueue_);
}
function processCalendlyQueue_(key){
 var p=PropertiesService.getScriptProperties();var raw=p.getProperty(key);if(!raw)return;
 try{
  var item=JSON.parse(raw);var outcome=saveVerifiedBooking_(item.uri);
  if(outcome==='saved'||outcome==='unrelated'||outcome==='older'){
   if(p.getProperty(key)===raw)p.deleteProperty(key);
  }else if(Date.now()-new Date(item.receivedAt).getTime()>7*86400000){
   // A provider booking with no matching site inquiry is outside this automation.
   if(p.getProperty(key)===raw)p.deleteProperty(key);
  }
 }catch(error){p.setProperty('CALENDLY_LAST_ERROR','A booking could not be verified or saved. Pending events will retry. '+new Date().toISOString());}
}
function saveVerifiedBooking_(uri){
 var invitee=calendlyResource_(uri,'invitee');var original=invitee;
 for(var hop=0;hop<5&&invitee.rescheduled&&invitee.new_invitee;hop++)invitee=calendlyResource_(invitee.new_invitee,'invitee');
 if(invitee.rescheduled&&invitee.new_invitee)throw new Error('Reschedule chain needs review');
 var event=calendlyResource_(invitee.event,'event');
 if(event.event_type!==CALENDLY_EVENT_TYPE||!(event.event_memberships||[]).some(function(m){return m.user===CALENDLY_USER;}))return 'unrelated';
 if(['active','canceled'].indexOf(invitee.status)<0||['active','canceled'].indexOf(event.status)<0)throw new Error('Unknown booking status');
 var reference=String(invitee.tracking&&invitee.tracking.utm_content||original.tracking&&original.tracking.utm_content||'');
 var match=/^rc-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(reference);
 var lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  var sheet=getLeadSheet_();var count=sheet.getLastRow()-1;if(count<1)return 'pending';
  var rows=sheet.getRange(2,1,count,HEADERS.length).getValues();var index=-1;
  for(var i=0;i<rows.length;i++){
   var row=rows[i];
   if((match&&String(row[0])===match[1])||(!match&&[uri,original.uri,original.old_invitee,invitee.old_invitee].filter(Boolean).indexOf(String(row[36]))>=0)){index=i;break;}
  }
  if(index<0)return match?'pending':'unrelated';
  var previous=rows[index];
  if(String(previous[8]).replace(/^'/,'').toLowerCase()!==String(invitee.email).toLowerCase())return 'unrelated';
  if(previous[43]&&new Date(invitee.created_at).getTime()<new Date(previous[43]).getTime())return 'older';
  var canceled=invitee.status==='canceled'||event.status==='canceled';
  var status=canceled?(invitee.rescheduled?'Reschedule pending':'Canceled'):(invitee.no_show?'No show':'Confirmed');
  var location=event.location||{};var link=location.join_url||location.location||'';
  // Only persist actual HTTPS meeting links as links; arbitrary provider text is omitted.
  if(!/^https:\/\/[^\s<>]+$/.test(link))link='';
  if(!Number.isFinite(Date.parse(event.start_time))||!Number.isFinite(Date.parse(event.end_time))||!Number.isFinite(Date.parse(invitee.created_at)))throw new Error('Invalid event timing');
  var values=[status,event.uri,invitee.uri,event.start_time,event.end_time,invitee.timezone||'',link,invitee.updated_at||event.updated_at||'',canceled?'Calendly cancellation / reschedule notice':'Calendly appointment confirmation',invitee.created_at,''];
  sheet.getRange(index+2,35,1,11).setValues([values.map(safeCell_)]);SpreadsheetApp.flush();
  if(!canceled&&!invitee.no_show&&new Date(event.end_time).getTime()>Date.now()){
   var mailStatus=sendBookingWelcome_(previous,invitee,event);
   sheet.getRange(index+2,43).setValue(mailStatus==='not_configured'?'Calendly appointment confirmation':'Calendly + RealeCall thank-you: '+mailStatus);
   if(mailStatus==='pending')return 'pending';
  }
  return 'saved';
 }finally{lock.releaseLock();}
}
