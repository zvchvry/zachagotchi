// Package source only: never collect a working directory wholesale.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {sha256} = require('./firmware-package.cjs');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
fs.mkdirSync(path.join(root, '.build'), {recursive:true});
fs.mkdirSync(path.join(root, 'release'), {recursive:true});
const build = fs.mkdtempSync(path.join(root, '.build/source-'));
const name = `Zachagotchi-${version}-Source`;
const stage = path.join(build, name);
fs.mkdirSync(stage);
const entries = ['.gitattributes','.gitignore','.github','README.md','LICENSE','CHANGELOG.md','CONTRIBUTING.md','package.json','docs','dist','firmware','installer','scripts','tests'];
function include(source) {
  const relative = path.relative(root, source).split(path.sep).join('/');
  if (fs.lstatSync(source).isSymbolicLink()) throw Error(`Source bundle cannot contain symlinks: ${relative}`);
  return !relative.split('/').some(s => ['.DS_Store','node_modules','build','vendor'].includes(s)) &&
    !/^installer\/firmware\/(?!README\.txt$)/.test(relative) &&
    !/\.(bin|elf|map|log|dmg|zip)$/.test(relative);
}
for(const entry of entries) fs.cpSync(path.join(root, entry), path.join(stage, entry), {recursive:true,filter:include});
const output = path.join(root,'release',name+'.zip');
if (fs.existsSync(output)) fs.unlinkSync(output);
const result = process.platform === 'win32'
  ? spawnSync('powershell.exe', ['-NoProfile','-Command', `Compress-Archive -LiteralPath '${stage.replaceAll("'", "''")}' -DestinationPath '${output.replaceAll("'", "''")}'`], {stdio:'inherit'})
  : spawnSync('/usr/bin/zip', ['-q','-r',output,name], {cwd:build,stdio:'inherit'});
if (result.status !== 0) throw Error(`Source ZIP creation failed. Staging: ${stage}`);
fs.writeFileSync(output+'.sha256',`${sha256(fs.readFileSync(output))}  ${path.basename(output)}\n`);
console.log(`Created ${output}\nNo tool binaries, credentials, build caches, case files or private saves included.`);
