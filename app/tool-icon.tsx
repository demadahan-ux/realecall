import {Clapperboard,Landmark,MessagesSquare,Palette,TicketCheck} from 'lucide-react';
import {sitePath} from '../lib/public-site';

const brands:Record<string,string[]>={
 Zendesk:['zendesk'],Intercom:['intercom'],HubSpot:['hubspot'],Salesforce:['salesforce'],Shopify:['shopify'],
 'Google Workspace':['google'],'Google Sheets & Docs':['google-sheets','google-docs'],'Microsoft Office: Word, Excel & PowerPoint':['microsoft'],Slack:['slack'],Zoom:['zoom'],'Microsoft Teams':['microsoft-teams'],
 Trello:['trello'],Asana:['asana'],'Monday.com':['monday'],Notion:['notion'],ClickUp:['clickup'],'Google Search':['google'],ChatGPT:['openai'],Claude:['claude'],Gemini:['gemini']
};
const symbols:Record<string,typeof Palette>={Canva:Palette,CapCut:Clapperboard,'Live chat systems':MessagesSquare,'Help desk platforms':TicketCheck,'Public records websites':Landmark};
export default function ToolIcon({name}:{name:string}){
 const marks=brands[name];const Symbol=symbols[name];
 return <span className={`team-tool-icon${marks&&marks.length>1?' team-tool-icon-pair':''}${name==='Canva'?' design-tool-icon':''}`} aria-hidden="true">
  {marks?marks.map(mark=><img key={mark} src={sitePath(`/tool-icons/${mark}.svg`)} alt="" width="20" height="20" loading="lazy"/>):Symbol?<Symbol size={20} strokeWidth={1.8}/>:null}
 </span>;
}
