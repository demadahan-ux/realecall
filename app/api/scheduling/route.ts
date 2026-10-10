import {calendlyUrl,config,reply} from '../../../lib/runtime';
import {withPublicCors,publicPreflight} from '../../../lib/public-cors';
export async function GET(r:Request){return withPublicCors(r,reply({url:calendlyUrl(),duration:30}),config().PUBLIC_SITE_ORIGIN);}
export function OPTIONS(r:Request){return publicPreflight(r,'GET',config().PUBLIC_SITE_ORIGIN);}
