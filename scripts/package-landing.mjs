import {cp,copyFile,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const hackathon=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(hackathon,'dist');
const landing=path.resolve(hackathon,'landing/out');
const appHtml=path.join(dist,'index.html');
const landingHtml=path.join(landing,'index.html');

const [app,home]=await Promise.all([readFile(appHtml,'utf8'),readFile(landingHtml,'utf8')]);
if(!app.includes('/assets/')||!home.includes('href="/app"')){
 throw new Error('Build the Vite app and static landing page before packaging.');
}

await mkdir(path.join(dist,'app'),{recursive:true});
await copyFile(appHtml,path.join(dist,'app/index.html'));
for(const entry of await readdir(landing,{withFileTypes:true})){
 await cp(path.join(landing,entry.name),path.join(dist,entry.name),{recursive:entry.isDirectory(),force:true});
}
// Next exports a few executable bootstrap scripts inside each static HTML file.
// Serve those exact build-time bytes from this origin under the Worker's strict CSP.
for (const entry of await readdir(landing, {recursive:true})) {
  if (!entry.endsWith('.html')) continue;
  const filename=path.join(dist,entry);
  const html=await readFile(filename,'utf8');
  const assets=new Map();
  const packaged=html.replace(/<script(\s[^>]*|)>([\s\S]*?)<\/script>/gi,(tag,attrs,body)=>{
    if (!body.trim() || /\s(?:src|type)=/i.test(attrs)) return tag;
    const hash=createHash('sha256').update(body).digest('hex');
    const name=`bootstrap-${hash}.js`;
    assets.set(name,body);
    return `<script${attrs} src="/_next/static/chunks/${name}"></script>`;
  });
  for (const [name,body] of assets) await writeFile(path.join(dist,'_next/static/chunks',name),body);
  if (packaged!==html) await writeFile(filename,packaged);
}
console.log('Packaged the screenshot landing at / and the working checker at /app.');
