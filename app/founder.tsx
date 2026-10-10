import {Headphones,MessagesSquare,BriefcaseBusiness,Sparkles} from 'lucide-react';
import ToolIcon from './tool-icon';
import ClientFeedback from './client-feedback';
import {sitePath} from '../lib/public-site';

const tools=[
 {title:'Customer support & commerce',icon:Headphones,items:['Zendesk','Intercom','HubSpot','Salesforce','Shopify','Live chat systems','Help desk platforms']},
 {title:'Everyday collaboration',icon:MessagesSquare,items:['Google Workspace','Google Sheets & Docs','Microsoft Office: Word, Excel & PowerPoint','Slack','Zoom','Microsoft Teams']},
 {title:'Projects & operations',icon:BriefcaseBusiness,items:['Trello','Asana','Monday.com','Notion','ClickUp','Google Search','Public records websites']},
 {title:'Content & AI assistance',icon:Sparkles,items:['Canva','CapCut','ChatGPT','Claude','Gemini']}
];

export default function Founder(){return <>
 <section id="founder" className="section founder-section"><div className="container founder-grid">
  <figure className="founder-portrait"><img src={sitePath('/april-carol-sapallo.png')} width="800" height="800" loading="lazy" alt="April Carol Sapallo, founder of One-Click Virtual Support and RealeCall"/><figcaption><span>MEET OUR FOUNDER</span><strong>April Carol Sapallo</strong><p>One-Click Virtual Support &amp; RealeCall</p></figcaption></figure>
  <div className="founder-copy"><p className="eyebrow">A REAL PERSON BEHIND REALECALL</p><h2>Built by someone<br/>who’s done <span>the work.</span></h2><p>April Carol Sapallo is the founder of One-Click Virtual Support and RealeCall. In the industry since 2022, she brings hands-on experience in customer support, client relationships, recruitment, training, and team operations.</p><p>She has helped grow a customer support account from around 15 people to more than 50. That experience shapes RealeCall’s approach: choose the right people, prepare them well, set clear expectations, and keep quality and accountability part of everyday work.</p><blockquote>“When a business trusts us with its customers, they’re trusting us with part of their reputation too. And I don’t take that lightly.”<cite>April Carol Sapallo · Founder</cite></blockquote><div className="founder-profile"><span><strong>Top Rated Plus</strong><small>Upwork profile</small></span><span><strong>100% Job Success</strong><small>Upwork profile</small></span></div></div>
 </div></section>
 <ClientFeedback/>
 <section id="team-tools" className="section team-tools-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">TOOLS OUR TEAM WORKS WITH</p><h2>Support that fits<br/><span>your way of working.</span></h2></div><p>From your help desk to your shared workspace, we work with the tools that keep your customers and team connected.</p></div><div className="team-tools-grid">{tools.map(group=><article className="team-tool-group" key={group.title}><group.icon size={23}/><h3>{group.title}</h3><ul>{group.items.map(tool=><li key={tool}><ToolIcon name={tool}/><span className="team-tool-name">{tool}</span></li>)}</ul></article>)}</div></div></section>
 </>;}
