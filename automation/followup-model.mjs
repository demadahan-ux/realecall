export const FOLLOWUP_HEADERS=['Request ID','Contact name','Company','Email','Status','Appointment (UTC)','Customer time zone','No show marked (UTC)','First email accepted (UTC)','Check-in due (UTC)','Check-in accepted (UTC)','Close due (UTC)','Closing email accepted (UTC)','Next action (UTC)','Reschedule link','Suggested times (local)','Last checked (UTC)','Email / sync issue','Stop follow-ups','Closed at (UTC)','Calendly invitee','Calendly event','Sending stage','Last send attempt (UTC)','Closure requested (UTC)','Team attendance','Appointment end (UTC)'];
export const FOLLOWUP_VIEWS={
 'Overdue':`=IFNA(FILTER('Follow-ups'!A2:AA,'Follow-ups'!A2:A<>"",((('Follow-ups'!N2:N<>"")*('Follow-ups'!N2:N<NOW()))+('Follow-ups'!E2:E="Needs review")+('Follow-ups'!E2:E="Awaiting attendance"))>0,'Follow-ups'!S2:S<>TRUE),"")`,
 'No Show':`=IFNA(FILTER('Follow-ups'!A2:AA,'Follow-ups'!H2:H<>"",REGEXMATCH('Follow-ups'!E2:E,"^(No show|Awaiting reschedule|Check-in sent|Needs review)$")),"")`,
 'Closed Slots':`=IFNA(FILTER('Follow-ups'!A2:AA,REGEXMATCH('Follow-ups'!E2:E,"^(Closed|Canceled|Rescheduled|Attended|Stopped)$")),"")`
};
export function localParts(when,zone){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(when));
 return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function localInstant(parts,zone){
 const target=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour||0,parts.minute||0,parts.second||0);let result=target;
 for(let i=0;i<6;i++){const p=localParts(result,zone);const wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);const delta=target-wall;if(!delta)return new Date(result);result+=delta;}
 throw new Error('Local appointment time could not be resolved');
}
export function addLocalDays(when,days,zone,hour){
 const p=localParts(when,zone),d=new Date(Date.UTC(p.year,p.month-1,p.day+days));
 return localInstant({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:hour===undefined?p.hour:hour,minute:hour===undefined?p.minute:0,second:hour===undefined?p.second:0},zone);
}
export function nextContactTime(when,zone){const p=localParts(when,zone);return p.hour<9?addLocalDays(when,0,zone,9):p.hour>=18?addLocalDays(when,1,zone,9):new Date(when);}
export function nextThreeDays(when,zone){return {start:addLocalDays(when,1,zone,0),end:addLocalDays(when,4,zone,0)};}
export function localLabel(when,zone){return new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(when));}
export function followupMessage(stage,d){
 const first=String(d.name||'there').trim().split(/\s+/)[0];
 const signoff='Take care,\nApril & the RealeCall team';
 const availability=d.slots.length?'These times were available when we prepared this note ('+d.timezone+'):\n'+d.slots.map(t=>'• '+t).join('\n')+'\n\nAvailability can change; Calendly will confirm your chosen time.':'There are no available times in the next three days in your time zone ('+d.timezone+'). The calendar link shows later options.';
 const subjects=['Shall we find another time? | RealeCall','A quick check-in about our call | RealeCall','Closing the loop on our missed call | RealeCall'];
 const bodies=[
  'Hi '+first+',\n\nIt looks like we missed each other for our RealeCall call on '+d.appointment+'. We understand that plans can change.\n\nIf you would still like to chat, choose another time here:\n'+d.rescheduleUrl+'\n\n'+availability+'\n\nIf that link no longer offers a time, you can make a fresh booking here:\n'+d.bookingUrl+'\n\n'+signoff,
  'Hi '+first+',\n\nJust checking whether you would still like to reconnect. If so, you can choose a time that works for you here:\n'+d.rescheduleUrl+'\n\n'+availability+'\n\nYou can also make a fresh booking here:\n'+d.bookingUrl+'\n\nIf now is not a good time, that is completely fine.\n\n'+signoff,
  'Hi '+first+',\n\nWe have now closed the missed appointment and removed it from our calendar. No new time has been reserved, and this is our last follow-up about that appointment.\n\nIf you would like support later, you are welcome to book another conversation through our website:\n'+d.websiteUrl+'\n\n'+signoff
 ];
 if(!Number.isInteger(stage)||stage<0||stage>2)throw new Error('Invalid follow-up stage');
 return {subject:subjects[stage],text:bodies[stage]};
}
