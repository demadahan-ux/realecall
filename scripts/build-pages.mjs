import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react from '@vitejs/plugin-react';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apiOrigin=process.env.REALECALL_API_ORIGIN;
if(!apiOrigin||new URL(apiOrigin).protocol!=='https:'||new URL(apiOrigin).origin!==apiOrigin)throw new Error('Set REALECALL_API_ORIGIN to the configured HTTPS inquiry API origin.');
const output=path.join(root,'pages-dist');
await build({
 configFile:false,root:path.join(root,'static-site'),base:'/realecall/',publicDir:path.join(root,'public'),plugins:[react()],
 define:{__REALECALL_API_ORIGIN__:JSON.stringify(apiOrigin),__REALECALL_BASE_PATH__:JSON.stringify('/realecall')},
 build:{outDir:output,emptyOutDir:true,assetsDir:'assets',sourcemap:false}
});
const html=await fs.readFile(path.join(output,'index.html'),'utf8');
for(const route of ['royal-blue','soft-ice']){
 await fs.mkdir(path.join(output,route),{recursive:true});
 await fs.writeFile(path.join(output,route,'index.html'),html);
}
await fs.writeFile(path.join(output,'.nojekyll'),'');
console.log('GitHub Pages output ready in pages-dist/.');
