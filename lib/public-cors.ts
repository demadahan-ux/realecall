// Cross-origin access is limited to the public inquiry/scheduling endpoints.
// The owner desk continues to require authenticated, same-origin requests.
export function publicOriginAllowed(request:Request,allowedOrigin?:string){
 const origin=request.headers.get('origin');
 if(origin===new URL(request.url).origin)return true;
 if(!origin||!allowedOrigin)return false;
 try{
  const allowed=new URL(allowedOrigin);
  return allowed.protocol==='https:'&&allowed.origin===allowedOrigin&&origin===allowedOrigin;
 }catch{return false;}
}

export function withPublicCors(request:Request,response:Response,allowedOrigin?:string){
 const headers=new Headers(response.headers);
 headers.set('Vary','Origin');
 if(publicOriginAllowed(request,allowedOrigin))headers.set('Access-Control-Allow-Origin',request.headers.get('origin')!);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function publicPreflight(request:Request,method:'POST'|'GET',allowedOrigin?:string){
 const requestedHeaders=(request.headers.get('access-control-request-headers')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 if(!publicOriginAllowed(request,allowedOrigin)||request.headers.get('access-control-request-method')!==method||requestedHeaders.some(name=>name!=='content-type')){
  return new Response(null,{status:403,headers:{'Cache-Control':'no-store','Vary':'Origin'}});
 }
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':request.headers.get('origin')!,'Access-Control-Allow-Methods':method,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store'}});
}
