/* A separate, verified booking thank-you. Does not send from browser events.
 * One durable record per Calendly invitee; uncertain sends require review.
 */
var BOOKING_EMAIL_HEADERS=['Calendly invitee','Request ID','Recipient','Status','Accepted (UTC)','Issue'];
function bookingEmailSheet_(){
 var book=SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
 var sheet=book.getSheetByName('Booking Emails');
 if(!sheet){sheet=book.insertSheet('Booking Emails');sheet.getRange(1,1,1,BOOKING_EMAIL_HEADERS.length).setValues([BOOKING_EMAIL_HEADERS]);sheet.setFrozenRows(1);}
 if(JSON.stringify(sheet.getRange(1,1,1,BOOKING_EMAIL_HEADERS.length).getValues()[0])!==JSON.stringify(BOOKING_EMAIL_HEADERS))throw new Error('Booking email ledger headers differ');
 return sheet;
}
function setupBookingEmails(){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('EMAIL_ENABLED')!=='true'||p.getProperty('CALENDLY_SYNC_ENABLED')!=='true')throw new Error('Authorise and verify Google email and Calendly sync first');
 if(calendlyApi_('/users/me').resource.uri!==CALENDLY_USER)throw new Error('Use the configured Calendly host');
 getLeadSheet_();bookingEmailSheet_();
 p.setProperty('BOOKING_EMAIL_ENABLED','true');
 return {ready:true,quota:MailApp.getRemainingDailyQuota()};
}
function sendBookingWelcome_(lead,invitee,event){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('BOOKING_EMAIL_ENABLED')!=='true'||p.getProperty('EMAIL_ENABLED')!=='true')return 'not_configured';
 if(String(lead[33])!=='Yes'||String(lead[8]).replace(/^'/,'').toLowerCase()!==String(invitee.email).toLowerCase())return 'no_consent';
 if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(invitee.email||''))return 'invalid_recipient';
 var sheet=bookingEmailSheet_();var last=sheet.getLastRow();var row=0;
 if(last>1){var ids=sheet.getRange(2,1,last-1,1).getValues();for(var i=0;i<ids.length;i++)if(String(ids[i][0])===invitee.uri){row=i+2;break;}}
 if(!row){row=last+1;if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);sheet.getRange(row,1,1,6).setValues([[invitee.uri,String(lead[0]),safeCell_(invitee.email),'pending','','']]);}
 var status=String(sheet.getRange(row,4).getValue());
 if(['accepted','needs_review','sending'].indexOf(status)>=0)return status==='sending'?'needs_review':status;
 if(MailApp.getRemainingDailyQuota()<1)return 'pending';
 var zone=invitee.timezone||'Etc/UTC';var date,start,end;
 try{date=Utilities.formatDate(new Date(event.start_time),zone,'EEEE, MMMM d, yyyy');start=Utilities.formatDate(new Date(event.start_time),zone,'h:mm a');end=Utilities.formatDate(new Date(event.end_time),zone,'h:mm a');}
 catch(error){zone='Etc/UTC';date=Utilities.formatDate(new Date(event.start_time),zone,'yyyy-MM-dd');start=Utilities.formatDate(new Date(event.start_time),zone,'HH:mm');end=Utilities.formatDate(new Date(event.end_time),zone,'HH:mm');}
 var location=event.location||{};
 var message=bookingConfirmationMessage({name:String(lead[7]).replace(/^'/,''),reference:confirmationReference(String(lead[0])),eventName:event.name||'RealeCall Discovery Call',date:date,start:start,end:end,timezone:zone,meetingUrl:location.join_url||location.location||'',calendlyUrl:CALENDLY_URL,rescheduleUrl:invitee.reschedule_url||'',cancelUrl:invitee.cancel_url||''});
 sheet.getRange(row,4,1,3).setValues([['sending','','']]);SpreadsheetApp.flush();
 try{
  var options={to:invitee.email,name:'RealeCall',subject:message.subject,body:message.text,htmlBody:message.html};
  var replyTo=p.getProperty('REPLY_TO');if(replyTo&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(replyTo))options.replyTo=replyTo;
  MailApp.sendEmail(options);sheet.getRange(row,4,1,3).setValues([['accepted',new Date().toISOString(),'']]);SpreadsheetApp.flush();return 'accepted';
 }catch(error){sheet.getRange(row,4,1,3).setValues([['needs_review','','Sending result is uncertain. Check Sent mail before retrying.']]);SpreadsheetApp.flush();return 'needs_review';}
}
