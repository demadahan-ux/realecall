import {z} from 'zod';
export function dateInZone(zone:string,now=new Date()){try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=(type:string)=>parts.find(p=>p.type===type)?.value;return `${part('year')}-${part('month')}-${part('day')}`;}catch{return now.toISOString().slice(0,10);}}
export const services=['Inbound & outbound calls','Email & chat support','Appointment setting','Back-office assistance'] as const;
export const leadSchema=z.object({
 requestId:z.string().uuid(),name:z.string().trim().min(2).max(100),company:z.string().trim().min(2).max(150),
 email:z.string().trim().email().max(254),website:z.string().trim().max(250).default(''),industry:z.string().trim().max(120).default(''),
 services:z.array(z.enum(services)).min(1).max(4),agents:z.enum(['1','2','3','4–5','6–10','11+','Not sure yet']),
 start:z.enum(['As soon as possible','Within 2–4 weeks','Within 1–3 months','Exploring options']),duration:z.enum(['Ongoing support','Short-term project','Not sure yet']),
 budgetStatus:z.enum(['Approved budget','Planning a budget','Need guidance']),budget:z.string().trim().max(120).default(''),role:z.enum(['Owner / decision-maker','Team manager','Researching for my team']),
 intent:z.enum(['discovery','chat','proposal','question']),bookingMode:z.enum(['team','calendly']).default('team'),mode:z.enum(['Email','Phone','WhatsApp','Video call']),phone:z.string().trim().max(40).default(''),timezone:z.string().trim().max(80),
 date:z.string().max(10).default(''),timeWindow:z.enum(['Morning (9am–12pm)','Afternoon (12pm–5pm)','Evening (5pm–8pm)','Flexible','']).default(''),
 message:z.string().trim().min(10).max(3000),consent:z.literal(true),websiteCheck:z.string().max(0).default(''),variant:z.enum(['royal','ice'])
}).superRefine((d,ctx)=>{
 if(d.intent==='chat'&&!['Email','WhatsApp'].includes(d.mode))ctx.addIssue({code:'custom',path:['mode'],message:'Choose email or WhatsApp for a written conversation.'});
 if(['Phone','WhatsApp'].includes(d.mode)&&!/^\+?[\d\s().-]{7,30}$/.test(d.phone))ctx.addIssue({code:'custom',path:['phone'],message:'Enter a phone number with country code.'});
 if(d.website&&!/^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(d.website))ctx.addIssue({code:'custom',path:['website'],message:'Use a complete website address, beginning with https://.'});
 try{new Intl.DateTimeFormat('en-US',{timeZone:d.timezone}).format();}catch{ctx.addIssue({code:'custom',path:['timezone'],message:'Choose a valid time zone.'});}
 if(d.intent==='discovery'&&d.bookingMode!=='calendly'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!d.timeWindow)ctx.addIssue({code:'custom',path:['date'],message:'Choose your preferred date and time window.'});
  else {const n=new Date(d.date+'T12:00:00Z');if(!Number.isFinite(n.getTime())||n.toISOString().slice(0,10)!==d.date||d.date<dateInZone(d.timezone))ctx.addIssue({code:'custom',path:['date'],message:'Choose a valid current or future date.'});}
 }
});
export type LeadInput=z.infer<typeof leadSchema>;
export function qualifyLead(d:Pick<LeadInput,'agents'|'start'|'duration'|'budgetStatus'|'role'|'services'>){
 const agentMin={'1':1,'2':2,'3':3,'4–5':4,'6–10':6,'11+':11,'Not sure yet':0}[d.agents];
 const premium=agentMin>=4;let score=0;const reasons:string[]=[];
 const add=(n:number,r:string)=>{score+=n;reasons.push(r);};
 if(premium)add(25,'4+ agents requested');else if(agentMin>0)add(10,'Team size identified');
 if(d.start==='As soon as possible'||d.start==='Within 2–4 weeks')add(20,'Ready to start within a month');else if(d.start==='Within 1–3 months')add(10,'Start timeframe identified');
 if(d.duration==='Ongoing support')add(20,'Ongoing support needed');else if(d.duration==='Short-term project')add(5,'Defined short-term project');
 if(d.budgetStatus==='Approved budget')add(15,'Budget approved');else if(d.budgetStatus==='Planning a budget')add(5,'Budget planning underway');
 if(d.role==='Owner / decision-maker')add(15,'Decision-maker inquiry');else if(d.role==='Team manager')add(10,'Team manager inquiry');
 if(d.services.length)add(5,'Service needs identified');
 const priority=premium||score>=75?'P1':score>=45?'P2':'P3';
 return {score,premium,priority,agentMin,reasons,fit:premium?'Premium review':score>=75?'Strong potential fit':score>=45?'Discuss requirements':'Early-stage inquiry'};
}
