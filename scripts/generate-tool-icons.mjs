import fs from 'node:fs';
import * as simpleIcons from 'simple-icons';

const logos=JSON.parse(fs.readFileSync(new URL('../node_modules/@iconify-json/logos/icons.json',import.meta.url),'utf8'));
const selections={
 zendesk:{logo:'zendesk-icon'},intercom:{logo:'intercom-icon'},hubspot:{simple:'siHubspot'},salesforce:{logo:'salesforce'},shopify:{simple:'siShopify'},
 google:{logo:'google-icon'},'google-sheets':{simple:'siGooglesheets'},'google-docs':{simple:'siGoogledocs'},microsoft:{logo:'microsoft-icon'},slack:{logo:'slack-icon'},zoom:{logo:'zoom-icon'},'microsoft-teams':{logo:'microsoft-teams'},
 trello:{simple:'siTrello'},asana:{logo:'asana-icon'},monday:{logo:'monday-icon'},notion:{logo:'notion-icon'},clickup:{logo:'clickup-icon'},openai:{logo:'openai-icon'},claude:{logo:'claude-icon'},gemini:{logo:'google-gemini-icon'}
};
const directory=new URL('../public/tool-icons/',import.meta.url);fs.mkdirSync(directory,{recursive:true});
for(const [name,selection] of Object.entries(selections)){
 let svg;
 if(selection.simple){
  const icon=simpleIcons[selection.simple];if(!icon)throw Error('Missing brand asset: '+name);
  svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${icon.hex}"><path d="${icon.path}"/></svg>`;
 }else{
  const icon=logos.icons[selection.logo];if(!icon||icon.rotate||icon.hFlip||icon.vFlip)throw Error('Unsupported brand asset: '+name);
  svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left||0} ${icon.top||0} ${icon.width||logos.width||16} ${icon.height||logos.height||16}">${icon.body}</svg>`;
 }
 if(/<script|<foreignObject|\son[a-z]+\s*=|(?:xlink:)?href=["'](?!#)|url\((?!#)/i.test(svg))throw Error('Asset is not self-contained: '+name);
 fs.writeFileSync(new URL(name+'.svg',directory),svg+'\n');
}
console.log(`Saved ${Object.keys(selections).length} self-contained tool logos.`);
