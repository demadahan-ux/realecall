import {emailStatus,sendConfirmation} from '../../../lib/confirmation-email';
import {leadSchema,qualifyLead} from '../../../lib/qualification';
import {config,reply,rateLimit,digest,syncLead,googleEmailConfigured,calendlyUrl} from '../../../lib/runtime';
import {publicOriginAllowed,withPublicCors,publicPreflight} from '../../../lib/public-cors';
export async function POST(r:Request){
 const origin=config().PUBLIC_SITE_ORIGIN;
 if(!publicOriginAllowed(r,origin))return reply({error:'Please submit from the RealeCall website.'},403);
 return withPublicCors(r,await saveLead(r),origin);
}
export function OPTIONS(r:Request){return publicPreflight(r,'POST',config().PUBLIC_SITE_ORIGIN);}
async function saveLead(r:Request){
 if(!r.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 try{
  const raw=await r.text();if(raw.length>15000)return reply({error:'Your inquiry is too long.'},413);
  let incoming;try{incoming=JSON.parse(raw);}catch{return reply({error:'Please check your form and try again.'},400);}
  const parsed=leadSchema.safeParse(incoming);if(!parsed.success)return reply({error:parsed.error.issues[0].message,field:parsed.error.issues[0].path[0]},400);
  const d=parsed.data;if(d.intent==='discovery'&&d.bookingMode==='calendly'&&!calendlyUrl())return reply({error:'Online scheduling is unavailable. Ask the team to arrange a time instead.'},503);const hash=await digest(JSON.stringify(d));const db=config().DB;
  const previous=await db.prepare('SELECT payload_hash FROM leads WHERE id=?').bind(d.requestId).first<{payload_hash:string}>();
  if(previous){if(previous.payload_hash!==hash)return reply({error:'This request changed. Please refresh and submit again.'},409);return reply({ok:true,reference:'RC-'+d.requestId.slice(0,8).toUpperCase(),duplicate:true,emailStatus:await emailStatus(d.requestId)});}
  if(!await rateLimit(r))return reply({error:'Too many requests. Please try again later.'},429);
  const q=qualifyLead(d);const createdAt=new Date().toISOString();
  await db.prepare('INSERT INTO leads (id,created_at,payload,payload_hash,score,premium,priority,reasons,sheet_status,status) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(d.requestId,createdAt,JSON.stringify(d),hash,q.score,q.premium?1:0,q.priority,JSON.stringify(q.reasons),'pending','New').run();
  let mailStatus;
  if(googleEmailConfigured()){await syncLead(d.requestId);mailStatus=await emailStatus(d.requestId);}
  else {[mailStatus]=await Promise.all([sendConfirmation(d.requestId),syncLead(d.requestId)]);}
  return reply({ok:true,reference:'RC-'+d.requestId.slice(0,8).toUpperCase(),emailStatus:mailStatus},201);
 }catch{return reply({error:'We could not confirm your submission. Your details are still here; please try again.'},503);}
}
