/* RealeCall Sheets + transactional email integration.
 * Script Properties: WEBHOOK_SECRET (32+ random characters), EMAIL_ENABLED=true.
 * The web app runs as the Google account that deploys it. No inbox access is used.
 */
function getLeadSheet_() {
 var sheet=SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID).getSheetByName('Leads');
 if(!sheet||JSON.stringify(sheet.getRange(1,1,1,HEADERS.length).getValues()[0])!==JSON.stringify(HEADERS))throw new Error('Lead tracker headers differ.');
 return sheet;
}
function setupRealeCall() {
 var p=PropertiesService.getScriptProperties();
 if((p.getProperty('WEBHOOK_SECRET')||'').length<32)throw new Error('Add WEBHOOK_SECRET in Project Settings first.');
 SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID).setSpreadsheetTimeZone('Etc/UTC');
 var sheet=getLeadSheet_();sheet.setFrozenRows(1);sheet.setFrozenColumns(2);
 if(!sheet.getFilter())sheet.getRange(1,1,sheet.getMaxRows(),HEADERS.length).createFilter();
 return {ready:true,remainingDailyEmailQuota:MailApp.getRemainingDailyQuota(),emailEnabled:p.getProperty('EMAIL_ENABLED')==='true'};
}
function safeCell_(value){var s=String(value==null?'':value);return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;}
function validLead_(d){
 if(!d||!/^[-0-9a-f]{36}$/i.test(d.requestId)||d.consent!==true||d.websiteCheck)return false;
 if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(d.email||'')||d.email.length>254)return false;
 if(typeof d.name!=='string'||d.name.length<2||d.name.length>100||typeof d.company!=='string'||d.company.length<2||d.company.length>150||typeof d.message!=='string'||d.message.length<10||d.message.length>3000)return false;
 if(!Array.isArray(d.services)||!d.services.length||d.services.length>4||d.services.some(function(x){return SERVICES.indexOf(x)<0;}))return false;
 if(LEAD_OPTIONS.L.indexOf(d.agents)<0||LEAD_OPTIONS.N.indexOf(d.start)<0||LEAD_OPTIONS.O.indexOf(d.duration)<0||LEAD_OPTIONS.P.indexOf(d.budgetStatus)<0||LEAD_OPTIONS.R.indexOf(d.role)<0||LEAD_OPTIONS.S.indexOf(d.intent)<0||LEAD_OPTIONS.J.indexOf(d.mode)<0)return false;
 if(d.intent==='chat'&&['Email','WhatsApp'].indexOf(d.mode)<0)return false;
 if(['Phone','WhatsApp'].indexOf(d.mode)>=0&&!/^\+?[\d\s().-]{7,30}$/.test(d.phone||''))return false;
 if(d.intent==='discovery'&&d.bookingMode!=='calendly'&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!d.timeWindow))return false;
 return typeof d.timezone==='string'&&d.timezone.length>0&&d.timezone.length<=80;
}
function doGet(){return json_({ok:true,service:'RealeCall inquiry automation',version:4});}
function doPost(e){
 var lock=LockService.getScriptLock();var row=0;var sheet;var d;
 try{
  if(!e||!e.postData||e.postData.contents.length>18000)return json_({ok:false,error:'Invalid request'});
  var body=JSON.parse(e.postData.contents);
  if(body.event==='invitee.created'||body.event==='invitee.canceled')return receiveCalendly_(e,body);
  var p=PropertiesService.getScriptProperties();var secret=p.getProperty('WEBHOOK_SECRET');
  if(!secret||secret.length<32||body.secret!==secret)return json_({ok:false,error:'Unauthorized'});
  if(body.action==='check'){getLeadSheet_();return json_({ok:true,version:4,emailEnabled:p.getProperty('EMAIL_ENABLED')==='true',quota:MailApp.getRemainingDailyQuota(),calendlyEnabled:p.getProperty('CALENDLY_SYNC_ENABLED')==='true',followupsEnabled:p.getProperty('FOLLOWUPS_ENABLED')==='true',spreadsheetId:DEFAULT_SPREADSHEET_ID});}
  d=body.lead;if(!validLead_(d))return json_({ok:false,error:'Invalid inquiry'});
  lock.waitLock(10000);sheet=getLeadSheet_();
  var last=Math.max(sheet.getLastRow(),2);var ids=sheet.getRange(2,1,last-1,1).getValues();
  for(var i=0;i<ids.length;i++)if(String(ids[i][0])===d.requestId){row=i+2;break;}
  if(row){
   if(String(sheet.getRange(row,9).getValue()).toLowerCase()!==d.email.toLowerCase())return json_({ok:false,error:'Reference mismatch'});
  }else{
   row=last+1;for(var j=0;j<ids.length;j++)if(!ids[j][0]){row=j+2;break;}
   if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
   var values=[d.requestId,new Date(d.createdAt||new Date().toISOString()),'','','','New',d.company,d.name,d.email,d.mode,d.phone||'',d.agents,d.services.join(', '),d.start,d.duration,d.budgetStatus,d.budget||'',d.role,d.intent,d.date||'',d.timeWindow||'',d.timezone,d.website||'',d.industry||'',d.message,'','','',d.variant||'','','not_configured','','','Yes'];
   while(values.length<HEADERS.length)values.push('');
   if(d.intent==='discovery'&&d.bookingMode==='calendly')values[34]='Awaiting booking';
   sheet.getRange(row,1,1,HEADERS.length).setValues([values.map(function(v){return v instanceof Date?v:safeCell_(v);})]);
   var f=sheetFormulas(row);Object.keys(f).forEach(function(col){sheet.getRange(col+row).setFormula(f[col]);});
   sheet.getRange(row,2).setNumberFormat('yyyy-mm-dd hh:mm');sheet.getRange(row,11).setNumberFormat('@');SpreadsheetApp.flush();
  }
  var status=String(sheet.getRange(row,31).getValue()||'not_configured');
  if(status==='sending'){status='needs_review';sheet.getRange(row,31).setValue(status);sheet.getRange(row,33).setValue('Previous send result is uncertain. Check Sent mail before manually retrying.');}
  if(body.sendConfirmation===true&&p.getProperty('EMAIL_ENABLED')==='true'&&['accepted','needs_review','unknown'].indexOf(status)<0){
   if(MailApp.getRemainingDailyQuota()<1){status='pending';sheet.getRange(row,31).setValue(status);sheet.getRange(row,33).setValue('Daily email quota reached. Retry from the inquiry desk after quota resets.');}
   else{
    // Persist sending before MailApp. Uncertain sends are never automatically repeated.
    sheet.getRange(row,31,1,3).setValues([['sending','','']]);SpreadsheetApp.flush();
    try{
     var message=confirmationMessage(d);var options={to:d.email,subject:message.subject,body:message.text,htmlBody:message.html,name:'RealeCall'};
     var replyTo=p.getProperty('REPLY_TO');if(replyTo&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(replyTo))options.replyTo=replyTo;
     MailApp.sendEmail(options);status='accepted';sheet.getRange(row,31,1,3).setValues([[status,new Date().toISOString(),'']]);
    }catch(mailError){status='needs_review';sheet.getRange(row,31,1,3).setValues([[status,'','Google did not confirm sending. Check Sent mail before manually retrying.']]);}
   }
  }
  SpreadsheetApp.flush();return json_({ok:true,id:d.requestId,emailStatus:status,emailAcceptedAt:String(sheet.getRange(row,32).getValue()||'')});
 }catch(err){return json_({ok:false,error:'Automation could not be confirmed. Retry from the inquiry desk using the same reference.'});}
 finally{if(lock.hasLock())lock.releaseLock();}
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
