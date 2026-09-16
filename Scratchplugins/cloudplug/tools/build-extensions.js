// Builds the two deliverables that share src/cloudplug-core.js:
//   public/extension.js            — TurboWarp custom extension
//   browser-extension/inject.js    — page script for the scratch.mit.edu browser plugin
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const SERVER = process.env.CLOUDPLUG_SERVER || 'https://cloudplug.apps.tas-ndc.kuhn-labs.com';
const core = fs.readFileSync(path.join(root, 'src', 'cloudplug-core.js'), 'utf8');
const glue = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8').replace(/__SERVER__/g, SERVER);
fs.writeFileSync(path.join(root, 'public', 'extension.js'), `// CloudPlug — TurboWarp extension (built from src/). Load: Add Extension → Custom Extension → URL to this file.\n${core}\n${glue('turbowarp-glue.js')}`);
fs.writeFileSync(path.join(root, 'browser-extension', 'inject.js'), `// CloudPlug — page script injected into scratch.mit.edu (built from src/).\n${core}\n${glue('inject-glue.js')}`);
console.log('built public/extension.js and browser-extension/inject.js');
