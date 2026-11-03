import {mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const output='dist';
mkdirSync(output,{recursive:true});
for(const file of ['index.html','styles.css','simplicity.css','app.js','enhancements.js','mode-core.js','simplicity.js','reference-db.js','knowledge-bridge.js','knowledge-core.mjs','knowledge-ui.mjs','knowledge.css','mobile.css','app-mobile.css','calendar-share.css','calendar-share.js','calendar-core.mjs','finance.css','finance-core.js','finance-ui.js','bank-ui.js','bank.css','install.js','sw.js','manifest.webmanifest','icon.svg']){
 if(!existsSync(file))throw new Error('Missing required asset: '+file);
 copyFileSync(file,join(output,file));
}
await import('./scripts/generate-icons.mjs');
console.log('LifeOS: static PWA build ready in dist/');
