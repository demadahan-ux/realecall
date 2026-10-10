type PublicSiteConfig={basePath?:string;apiOrigin?:string};
declare global {interface Window {REALECALL_PUBLIC_SITE?:PublicSiteConfig}}

function settings(){return typeof window==='undefined'?{}:window.REALECALL_PUBLIC_SITE||{};}
export function sitePath(path:string){
 const base=settings().basePath?.replace(/\/$/,'')||'';
 return `${base}${path.startsWith('/')?path:`/${path}`}`;
}
export function apiUrl(path:string){
 const origin=settings().apiOrigin;
 return origin?new URL(path,origin).toString():path;
}
