// Install pinned build tools locally; no Homebrew or system-wide installation.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {sha256}=require('./firmware-package.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.build/arduino');
const lock=require('../firmware/toolchain-lock.json');
if(process.platform!=='darwin')throw Error('This setup script currently supports macOS.');
const marker=process.arch==='arm64'?'macOS_ARM64':process.arch==='x64'?'macOS_64bit':null;
const archive=lock.archives.find(a=>marker&&a.name.includes(marker));
if(!archive)throw Error('Unsupported Mac architecture.');
fs.mkdirSync(dir,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)throw Error(`${path.basename(cmd)} failed (${r.status}).`);}
const tarball=path.join(dir,archive.name);
if(!fs.existsSync(tarball))run('/usr/bin/curl',['--fail','--location','--retry','2',archive.url,'-o',tarball]);
if(sha256(fs.readFileSync(tarball))!==archive.sha256)throw Error('Arduino CLI archive checksum mismatch.');
run('/usr/bin/tar',['-xzf',tarball,'-C',dir,'arduino-cli']);
const config=path.join(dir,'arduino-cli.yaml');
// JSON strings are also valid quoted YAML scalars, including paths with spaces.
fs.writeFileSync(config,`board_manager:\n  additional_urls:\n    - https://espressif.github.io/arduino-esp32/package_esp32_index.json\ndirectories:\n  data: ${JSON.stringify(path.join(dir,'data'))}\n  downloads: ${JSON.stringify(path.join(dir,'downloads'))}\n  user: ${JSON.stringify(path.join(dir,'user'))}\n`);
const cli=path.join(dir,'arduino-cli');
run(cli,['core','update-index','--config-file',config]);
run(cli,['core','install',`esp32:esp32@${lock.esp32}`,'--config-file',config]);
for(const library of lock.libraries)run(cli,['lib','install',library,'--config-file',config]);
console.log('Build dependencies installed locally. Run npm run build:firmware with a working Python 3.');
