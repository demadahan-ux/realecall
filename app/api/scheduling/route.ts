import {calendlyUrl,reply} from '../../../lib/runtime';
export async function GET(){return reply({url:calendlyUrl(),duration:30});}
