const fs = require('node:fs');
const path = require('node:path');
const {inspectFirmware,sha256} = require('./firmware-package.cjs');
const root = path.resolve(__dirname,'..');
const version = require('../package.json').version;
const dir = path.join(root,'release');
const expected = [`Zachagotchi-Flasher-${version}.dmg`,`Zachagotchi-Flasher-${version}-Windows-x64.zip`,`Zachagotchi-${version}-Source.zip`,`Zachagotchi-${version}-Third-Party-Sources.zip`];
for(const name of expected) {
  const file = path.join(dir,name);
  const checksum = fs.readFileSync(file+'.sha256','utf8').trim();
  if(checksum !== `${sha256(fs.readFileSync(file))}  ${name}`) throw Error(`Checksum mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
for (const name of fs.readdirSync(dir)) if (/\.(dmg|zip)(\.sha256)?$/.test(name) && !expected.some(n=>name===n||name===n+'.sha256')) throw Error(`Old/unexpected release artifact: ${name}. Remove it deliberately before the first public release.`);
inspectFirmware(path.join(root,'installer/firmware'),'FNK0104B');
const readme = fs.readFileSync(path.join(root,'README.md'),'utf8');
for(const [,image] of readme.matchAll(/src="(docs\/images\/[^"?#]+)"/g)) if(!fs.existsSync(path.join(root,image))) throw Error(`Missing README image: ${image}`);
for(const name of ['installer/README.txt','installer/README-Windows.txt','CHANGELOG.md','README.md']) if(!fs.readFileSync(path.join(root,name),'utf8').includes(version)) throw Error(`Outdated version in ${name}`);
console.log('Release payload and documentation checks passed. This does not replace hardware testing.');
