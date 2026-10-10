import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {addLocalDays,nextThreeDays,localParts,FOLLOWUP_HEADERS} from '../automation/followup-model.mjs';

// Local calendar days remain correct across DST and a different client date.
assert.equal(addLocalDays('2026-10-31T13:00:00Z',3,'America/New_York').toISOString(),'2026-11-03T14:00:00.000Z');
assert.equal(addLocalDays('2026-03-07T14:00:00Z',3,'America/New_York').toISOString(),'2026-03-10T13:00:00.000Z');
const window=nextThreeDays('2026-10-12T20:30:00Z','Asia/Manila');
assert.equal(window.start.toISOString(),'2026-10-13T16:00:00.000Z');
assert.equal(window.end.toISOString(),'2026-10-16T16:00:00.000Z');
assert.equal(localParts(window.start,'Asia/Manila').day,14);

const code=fs.readFileSync(new URL('../automation/Code.gs',import.meta.url),'utf8');
const grids={'Leads':[[]],'Follow-ups':[FOLLOWUP_HEADERS]};let locked=false,quota=100,uncertain=false,failProvider=false,newBooking=false,cancelFailure=false;
const sent=[],canceled=[],resources=new Map();
const props={FOLLOWUPS_ENABLED:'true',FOLLOWUPS_ACTIVE_FROM:'2026-10-10T00:00:00Z',EMAIL_ENABLED:'true',REPLY_TO:'team@example.com',CALENDLY_API_TOKEN:'fixture-only'};
function sheet(name){
 const grid=grids[name];
 return {
  getLastRow:()=>grid.length,getMaxRows:()=>1000,
  getRange(r,c,n=1,m=1){
   return {
    getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>grid[r+i-1]?.[c+j-1]??'')),
    getValue:()=>grid[r-1]?.[c-1]??'',
    setValues(rows){rows.forEach((values,i)=>values.forEach((v,j)=>{grid[r+i-1]??=[];grid[r+i-1][c+j-1]=v;}));return this;},
    setValue(v){return this.setValues([[v]]);}
   };
  }
 };
}
let testClock=Date.now();
const ctx=vm.createContext({Date,Intl,console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})},SpreadsheetApp:{openById:()=>({getSheetByName:sheet}),flush(){}},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail(m){sent.push(m);if(uncertain)throw Error('Uncertain result');}},UrlFetchApp:{fetch(url,options){assert.equal(options.headers.Authorization,'Bearer fixture-only');if(failProvider)throw Error('Provider unavailable');let body;
 if(url.includes('/event_type_available_times?')){const params=new URL(url).searchParams;const start=new Date(params.get('start_time')).getTime();body={collection:[0,1,2].map(i=>({status:'available',invitees_remaining:1,start_time:new Date(start+i*86400000+9*3600000).toISOString()}))};}
 else if(url.includes('/scheduled_events?'))body={collection:newBooking?[{event_type:ctx.CALENDLY_EVENT_TYPE,status:'active',start_time:'2030-01-01T00:00:00Z'}]:[],pagination:{next_page_token:null}};
 else if(url.endsWith('/cancellation')){assert.equal(options.method,'post');if(cancelFailure)throw Error('Cancellation refused');const uri=url.replace('/cancellation','');const event=resources.get(uri);assert.ok(Date.parse(event.end_time)<testClock);event.status='canceled';canceled.push(uri);body={resource:event};}
 else body={resource:resources.get(url)};
 return {getResponseCode:()=>body.resource||body.collection?200:404,getContentText:()=>JSON.stringify(body)};
}}});
vm.runInContext(code,ctx);grids.Leads[0]=Array.from(ctx.HEADERS);
function fixture(){const id=crypto.randomUUID(),eventUri='https://api.calendly.com/scheduled_events/'+crypto.randomUUID(),uri=eventUri+'/invitees/'+crypto.randomUUID();
 const lead=Array(ctx.HEADERS.length).fill('');Object.assign(lead,{0:id,7:'Test Client',6:'Example Business',8:'client@example.com',33:'Yes',36:uri});grids.Leads.push(lead);
 const event={uri:eventUri,event_type:ctx.CALENDLY_EVENT_TYPE,event_memberships:[{user:ctx.CALENDLY_USER}],status:'active',start_time:'2026-10-11T23:30:00Z',end_time:'2026-10-12T00:00:00Z',invitees_counter:{limit:1,active:1}};
 const invitee={uri,event:eventUri,status:'active',email:lead[8],timezone:'Asia/Manila',no_show:{created_at:'2026-10-12T00:05:00Z'},reschedule_url:'https://calendly.com/reschedulings/'+crypto.randomUUID()};resources.set(uri,invitee);resources.set(eventUri,event);
 ctx.ensureFollowup_(lead);const row=grids['Follow-ups'].length;return {lead,event,invitee,row,values:()=>grids['Follow-ups'][row-1],run:at=>{testClock=Date.parse(at);ctx.processFollowup_(row,new Date(at));}};}
const firstTime='2026-10-12T01:00:00Z',checkTime='2026-10-15T01:00:00Z',closeTime='2026-10-18T01:00:00Z';
const f=fixture();f.invitee.no_show=null;f.run(firstTime);assert.equal(sent.length,0);assert.equal(f.values()[4],'Awaiting attendance');
f.invitee.no_show={created_at:'2026-10-12T00:05:00Z'};f.run(firstTime);assert.equal(sent.length,1);assert.equal(f.values()[4],'Awaiting reschedule');assert.equal(f.values()[9].toISOString(),new Date(checkTime).toISOString());assert.equal(f.lead[34],'No show');assert.match(sent[0].body,/Oct 13/);assert.match(sent[0].body,/Asia\/Manila/);
f.run(firstTime);assert.equal(sent.length,1);f.run(checkTime);assert.equal(sent.length,2);assert.equal(f.values()[4],'Check-in sent');assert.equal(f.values()[11].toISOString(),new Date(closeTime).toISOString());
cancelFailure=true;f.run(closeTime);assert.equal(sent.length,2);assert.equal(canceled.length,0);assert.match(f.values()[17],/Calendly request|Cancellation/);cancelFailure=false;
f.run(closeTime);assert.equal(sent.length,3);assert.equal(canceled.length,1);assert.equal(f.values()[4],'Closed');assert.match(sent[2].body,/removed it from our calendar/);f.run(closeTime);assert.equal(sent.length,3);
const before=sent.length;
const stopped=fixture();stopped.values()[18]=true;stopped.run(firstTime);assert.equal(stopped.values()[4],'Stopped');assert.equal(sent.length,before);
const attended=fixture();attended.values()[25]='Attended';attended.run(firstTime);assert.equal(attended.values()[4],'Attended');assert.equal(sent.length,before);
const rescheduled=fixture();newBooking=true;rescheduled.run(firstTime);assert.equal(rescheduled.values()[4],'Rescheduled');assert.equal(sent.length,before);newBooking=false;
const old=fixture();old.invitee.no_show.created_at='2026-10-01T00:00:00Z';old.run(firstTime);assert.equal(old.values()[4],'Needs review');assert.equal(sent.length,before);
const paused=fixture();quota=0;paused.run(firstTime);assert.equal(paused.values()[8],'');assert.equal(sent.length,before);quota=100;
failProvider=true;paused.run(firstTime);assert.equal(sent.length,before);assert.equal(paused.values()[8],'');failProvider=false;
const canceledByClient=fixture();canceledByClient.invitee.status='canceled';canceledByClient.run(firstTime);assert.equal(canceledByClient.values()[4],'Canceled');assert.equal(sent.length,before);
const invalid=fixture();invalid.values()[3]='other@example.com';invalid.run(firstTime);assert.equal(sent.length,before);assert.match(invalid.values()[17],/email/);
const uncertainFlow=fixture();uncertain=true;uncertainFlow.run(firstTime);assert.equal(sent.length,before+1);assert.equal(uncertainFlow.values()[4],'Needs review');uncertain=false;uncertainFlow.run(checkTime);assert.equal(sent.length,before+1);
const night=fixture();night.run('2026-10-12T15:00:00Z');assert.equal(sent.length,before+1);assert.equal(night.values()[13].toISOString(),'2026-10-13T01:00:00.000Z');
assert.equal(locked,false);
console.log('PASS: no false no-shows; local dates/DST; 3+3 day cadence; duplicate and uncertain-send holds; quota/provider retries; recipient matching; stop/attendance/cancellation/rebooking suppression; verified calendar closure before final email. In-memory only.');
