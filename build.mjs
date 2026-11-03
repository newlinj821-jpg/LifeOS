import {mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const output='dist';
mkdirSync(output,{recursive:true});
for(const file of ['index.html','styles.css','simplicity.css','app.js','enhancements.js','mode-core.js','simplicity.js','sw.js','manifest.webmanifest','icon.svg']){
 if(!existsSync(file))throw new Error('Missing required asset: '+file);
 copyFileSync(file,join(output,file));
}
console.log('LifeOS: static PWA build ready in dist/');
