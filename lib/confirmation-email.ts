import {config,googleEmailConfigured,syncLead} from './runtime';
import {leadSchema} from './qualification';
import {confirmationMessage} from './confirmation-template';
export type EmailStatus='not_configured'|'pending'|'sending'|'accepted'|'failed'|'unknown'|'needs_review';
type EmailRow={lead_id:string;status:EmailStatus;payload:string;attempts:number;first_attempt_at:number|null;last_attempt_at:number|null;provider_id:string|null;error:string|null};
const address=(v:string|undefined)=>!!v&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v)&&v.length<255;
export function emailConfigured(){const e=config();return googleEmailConfigured()||(e.CONFIRMATION_EMAIL_ENABLED==='true'&&!!e.RESEND_API_KEY&&address(e.CONFIRMATION_EMAIL_FROM)&&(!e.CONFIRMATION_EMAIL_REPLY_TO||address(e.CONFIRMATION_EMAIL_REPLY_TO)));}
export async function emailStatus(id:string):Promise<EmailStatus>{const row=await config().DB.prepare('SELECT status FROM confirmation_emails WHERE lead_id=?').bind(id).first<{status:EmailStatus}>();return row?.status||'not_configured';}
export async function sendConfirmation(id:string):Promise<EmailStatus>{
 const e=config();if(!emailConfigured())return 'not_configured';
 if(googleEmailConfigured()){await syncLead(id);return await emailStatus(id);}
 let first=0;
 try{
  const lead=await e.DB.prepare('SELECT payload FROM leads WHERE id=?').bind(id).first<{payload:string}>();if(!lead)return 'failed';
  const input=leadSchema.safeParse(JSON.parse(lead.payload));
  // Date validation applies on intake. A saved request may now have a past preferred date.
  const stored=JSON.parse(lead.payload);if(!input.success&&!(input.error.issues.every(x=>x.path[0]==='date')))return 'failed';
  if(stored.requestId!==id||stored.consent!==true||!address(stored.email))return 'failed';
  const message=confirmationMessage(stored);
  const payload=JSON.stringify({from:`RealeCall <${e.CONFIRMATION_EMAIL_FROM}>`,to:[stored.email],...message,...(e.CONFIRMATION_EMAIL_REPLY_TO?{reply_to:e.CONFIRMATION_EMAIL_REPLY_TO}:{})});
  await e.DB.prepare("INSERT INTO confirmation_emails (lead_id,status,payload,attempts) VALUES (?,'pending',?,0) ON CONFLICT(lead_id) DO NOTHING").bind(id,payload).run();
  let row=await e.DB.prepare('SELECT * FROM confirmation_emails WHERE lead_id=?').bind(id).first<EmailRow>();if(!row)return 'failed';
  if(row.status==='accepted'||row.status==='needs_review')return row.status;
  const now=Date.now();first=row.first_attempt_at||now;
  // Resend retains idempotency keys for 24 hours. Do not replay uncertain attempts after that window.
  if(row.first_attempt_at&&now-row.first_attempt_at>=23*3600000){await e.DB.prepare("UPDATE confirmation_emails SET status='needs_review',error='Check provider history before sending again' WHERE lead_id=? AND status<>'accepted'").bind(id).run();return 'needs_review';}
  if(row.attempts>=3)return row.status;
  if(row.last_attempt_at&&now-row.last_attempt_at<30000)return row.status;
  row=await e.DB.prepare("UPDATE confirmation_emails SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,error=NULL WHERE lead_id=? AND status IN ('pending','failed','unknown','sending') AND attempts<3 AND (last_attempt_at IS NULL OR last_attempt_at<?) RETURNING *").bind(now,now,id,now-30000).first<EmailRow>();
  if(!row)return await emailStatus(id);
  first=row.first_attempt_at||first;
  let response:Response;
  try{response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${e.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`realecall-receipt-v1-${id}`},body:row.payload,signal:AbortSignal.timeout(8000)});}
  catch{await e.DB.prepare("UPDATE confirmation_emails SET status='unknown',error='Provider response not confirmed; retry uses the same receipt key' WHERE lead_id=? AND status<>'accepted'").bind(id).run();return 'unknown';}
  const result=await response.json().catch(()=>null) as {id?:string}|null;
  if(response.ok&&typeof result?.id==='string'&&result.id.length>0){await e.DB.prepare("UPDATE confirmation_emails SET status='accepted',provider_id=?,accepted_at=?,error=NULL WHERE lead_id=?").bind(result.id,new Date().toISOString(),id).run();return 'accepted';}
  const status:EmailStatus=response.status>=500||response.ok?'unknown':'failed';
  await e.DB.prepare('UPDATE confirmation_emails SET status=?,error=? WHERE lead_id=? AND status<>?').bind(status,`Email service HTTP ${response.status}`,id,'accepted').run();return status;
 }catch{
  // An email failure must never turn a successfully saved inquiry into a failed booking request.
  try{const status=await emailStatus(id);if(status==='accepted')return status;}catch{}
  return first?'unknown':'failed';
 }
}
