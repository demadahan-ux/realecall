import {emailConfigured} from '../../../lib/confirmation-email';
import {config,reply,isAdmin,sameOrigin,syncLead,calendlyUrl} from '../../../lib/runtime';
export async function GET(r:Request){
 if(!isAdmin(r))return reply({error:'Owner access is not configured for this account.'},403);
 const e=config();const rows=await e.DB.prepare("SELECT l.id,l.created_at,l.payload,l.score,l.premium,l.priority,l.reasons,l.sheet_status,l.status,COALESCE(m.status,'not_configured') AS email_status,COALESCE(m.attempts,0) AS email_attempts,m.provider_id AS email_provider_id,m.error AS email_error FROM leads l LEFT JOIN confirmation_emails m ON l.id=m.lead_id ORDER BY l.premium DESC,l.score DESC,l.created_at ASC LIMIT 200").all<{id:string;payload:string;reasons:string}>();
 return reply({leads:rows.results.map(x=>({...x,payload:JSON.parse(x.payload),reasons:JSON.parse(x.reasons)})),connections:{sheets:!!e.APPS_SCRIPT_URL&&!!e.WEBHOOK_SECRET,sheetsUrl:e.SHEETS_URL||null,emailEnabled:emailConfigured(),emailFrom:e.CONFIRMATION_EMAIL_FROM||'the authorised Google account',calendlyUrl:calendlyUrl(),calendlySheetSync:e.CALENDLY_SHEET_SYNC_ENABLED==='true',followupsEnabled:e.FOLLOWUP_EMAIL_ENABLED==='true'}});
}
export async function POST(r:Request){
 if(!isAdmin(r)||!sameOrigin(r))return reply({error:'Forbidden'},403);
 const rows=await config().DB.prepare("SELECT l.id FROM leads l LEFT JOIN confirmation_emails m ON l.id=m.lead_id WHERE l.sheet_status='pending' OR m.status IN ('pending','unknown') ORDER BY l.created_at LIMIT 20").all<{id:string}>();let synced=0;
 for(const row of rows.results)if(await syncLead(row.id))synced++;return reply({ok:true,synced,attempted:rows.results.length});
}
