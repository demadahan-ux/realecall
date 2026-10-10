import {env} from 'cloudflare:workers';
export const config=()=>env as unknown as {DB:D1Database;APPS_SCRIPT_URL?:string;WEBHOOK_SECRET?:string;RATE_LIMIT_SALT?:string;SHEETS_URL?:string;ADMIN_EMAILS?:string;RESEND_API_KEY?:string;CONFIRMATION_EMAIL_FROM?:string;CONFIRMATION_EMAIL_REPLY_TO?:string;CONFIRMATION_EMAIL_ENABLED?:string;GOOGLE_EMAIL_ENABLED?:string;CALENDLY_URL?:string;CALENDLY_SHEET_SYNC_ENABLED?:string;FOLLOWUP_EMAIL_ENABLED?:string;PUBLIC_SITE_ORIGIN?:string};
export function calendlyUrl(){const url=config().CALENDLY_URL;return url&&/^https:\/\/calendly\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(url)?url:null;}
export function googleEmailConfigured(){const e=config();return e.GOOGLE_EMAIL_ENABLED==='true'&&!!e.APPS_SCRIPT_URL&&!!e.WEBHOOK_SECRET;}
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function digest(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');}
export function sameOrigin(r:Request){return r.headers.get('origin')===new URL(r.url).origin;}
export async function rateLimit(r:Request){
 const e=config();const now=Date.now();const bucket=Math.floor(now/3600000);const address=r.headers.get('cf-connecting-ip')||'unknown';
 const key=await digest(`${e.RATE_LIMIT_SALT||'realecall'}:lead:${address}:${bucket}`);
 const row=await e.DB.prepare('INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,(bucket+1)*3600000).first<{hits:number}>();
 const globalKey=`lead:global:${Math.floor(now/86400000)}`;
 const global=await e.DB.prepare('INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(globalKey,now+86400000).first<{hits:number}>();
 await e.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now-86400000).run();return !!row&&!!global&&row.hits<=5&&global.hits<=200;
}
export async function syncLead(id:string){
 const e=config();if(!e.APPS_SCRIPT_URL||!e.WEBHOOK_SECRET)return false;
 if(!/^https:\/\/script.google.com\/macros\/s\/[\w-]+\/exec$/.test(e.APPS_SCRIPT_URL))return false;
 const row=await e.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first<{payload:string;created_at:string;sheet_status:string}>();if(!row)return false;
 const google=googleEmailConfigured();
 const mail=await e.DB.prepare('SELECT status FROM confirmation_emails WHERE lead_id=?').bind(id).first<{status:string}>();
 if(row.sheet_status==='synced'&&(!google||mail?.status==='accepted'))return true;
 if(google)await e.DB.prepare("INSERT INTO confirmation_emails (lead_id,status,payload,attempts) VALUES (?,'pending','{}',0) ON CONFLICT(lead_id) DO NOTHING").bind(id).run();
 try{
  const res=await fetch(e.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:e.WEBHOOK_SECRET,sendConfirmation:google&&mail?.status!=='accepted',lead:{...JSON.parse(row.payload),createdAt:row.created_at}}),signal:AbortSignal.timeout(25000),redirect:'follow'});
  const body=await res.json() as {ok?:boolean;id?:string;emailStatus?:string;emailAcceptedAt?:string};if(!res.ok||!body.ok||body.id!==id)throw new Error('Sync not accepted');
  await e.DB.prepare("UPDATE leads SET sheet_status='synced',sheet_error=NULL WHERE id=?").bind(id).run();
  if(google){
   const allowed=['accepted','pending','unknown','needs_review','not_configured'];
   const status=body.emailStatus&&allowed.includes(body.emailStatus)?body.emailStatus:'unknown';
   await e.DB.prepare("INSERT INTO confirmation_emails (lead_id,status,payload,attempts,provider_id,accepted_at,error) VALUES (?,?,?,0,?,?,?) ON CONFLICT(lead_id) DO UPDATE SET status=excluded.status,provider_id=excluded.provider_id,accepted_at=excluded.accepted_at,error=excluded.error WHERE confirmation_emails.status<>'accepted'").bind(id,status,'{}',status==='accepted'?'google:'+id:null,status==='accepted'?(body.emailAcceptedAt||new Date().toISOString()):null,status==='pending'?'Google sending quota exhausted; queued in sheet':status==='needs_review'||status==='unknown'?'Check the email status in Google Sheets before retrying':status==='not_configured'?'Enable confirmation emails in Apps Script':null).run();
  }
  return true;
 }catch{
  await e.DB.prepare("UPDATE leads SET sheet_status='pending',sheet_error='Sync pending; retry from operations' WHERE id=?").bind(id).run();
  if(google)await e.DB.prepare("UPDATE confirmation_emails SET status='unknown',error='Google result unconfirmed. Retry checks the same sheet reference before sending.' WHERE lead_id=? AND status<>'accepted'").bind(id).run();
  return false;
 }
}
export function isAdmin(r:Request){const who=r.headers.get('oai-authenticated-user-email')?.toLowerCase();return !!who&&!!config().ADMIN_EMAILS?.split(',').map(x=>x.trim().toLowerCase()).includes(who);}
