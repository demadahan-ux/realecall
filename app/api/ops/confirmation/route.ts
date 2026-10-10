import {config,isAdmin,reply,sameOrigin} from '../../../../lib/runtime';
import {emailConfigured,sendConfirmation} from '../../../../lib/confirmation-email';
import {confirmationMessage} from '../../../../lib/confirmation-template';
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export async function GET(r:Request){
 if(!isAdmin(r))return reply({error:'Owner access required.'},403);
 const id=new URL(r.url).searchParams.get('id')||'';if(!validId(id))return reply({error:'Invalid request reference.'},400);
 const row=await config().DB.prepare('SELECT payload FROM leads WHERE id=?').bind(id).first<{payload:string}>();if(!row)return reply({error:'Inquiry not found.'},404);
 return new Response(confirmationMessage(JSON.parse(row.payload)).html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",'X-Content-Type-Options':'nosniff'}});
}
export async function POST(r:Request){
 if(!isAdmin(r)||!sameOrigin(r))return reply({error:'Owner access required.'},403);
 if(!emailConfigured())return reply({error:'Connect and verify the RealeCall sender first.'},503);
 if(!r.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 let id='';try{const raw=await r.text();if(raw.length>500)return reply({error:'Invalid request.'},400);id=JSON.parse(raw).id;}catch{return reply({error:'Invalid request.'},400);}
 if(typeof id!=='string'||!validId(id))return reply({error:'Invalid request reference.'},400);
 const lead=await config().DB.prepare('SELECT id FROM leads WHERE id=?').bind(id).first();if(!lead)return reply({error:'Inquiry not found.'},404);
 const status=await sendConfirmation(id);return reply({ok:status==='accepted',status},status==='accepted'?200:202);
}
