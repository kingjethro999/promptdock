const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'frontend');
const output = path.join(source, 'dist');
const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
if (apiBase && !/^https?:\/\/[^/]+$/i.test(apiBase)) throw new Error('PUBLIC_API_URL must be an HTTP(S) origin without a path.');
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'favicon.svg']) fs.copyFileSync(path.join(source, file), path.join(output, file));
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
fs.writeFileSync(path.join(output, 'config.js'), `window.PROMPTDOCK_CONFIG = ${JSON.stringify({ apiBase, version })};\n`);
console.log(`Built frontend ${version} with API origin ${apiBase || '(same origin)'}`);
