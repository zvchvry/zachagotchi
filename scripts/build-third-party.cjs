// Keep matching upstream sources available next to the installers, not in Git.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {sha256} = require('./firmware-package.cjs');
const root = path.resolve(__dirname,'..');
const version = require('../package.json').version;
const lock = require('../installer/sources-lock.json');
const downloads = path.join(root,'.build/downloads');
fs.mkdirSync(downloads,{recursive:true});
fs.mkdirSync(path.join(root,'release'),{recursive:true});
const build = fs.mkdtempSync(path.join(root,'.build/third-party-'));
const name = `Zachagotchi-${version}-Third-Party-Sources`;
const stage = path.join(build,name);
fs.mkdirSync(stage);
(async()=>{
  for(const source of lock.sources) {
    const file = path.join(downloads,source.file);
    if(!fs.existsSync(file)) {
      const response = await fetch(source.url);
      if(!response.ok) throw Error(`Source download failed: ${source.url} (${response.status})`);
      fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
    }
    if(sha256(fs.readFileSync(file)) !== source.sha256) throw Error(`Source checksum mismatch: ${source.file}`);
    fs.copyFileSync(file,path.join(stage,source.file));
  }
  fs.copyFileSync(path.join(root,'installer/sources-lock.json'),path.join(stage,'sources-lock.json'));
  fs.copyFileSync(path.join(root,'docs/THIRD_PARTY.md'),path.join(stage,'README.md'));
  fs.copyFileSync(path.join(root,'installer/THIRD-PARTY.txt'),path.join(stage,'THIRD-PARTY.txt'));
  fs.cpSync(path.join(root,'installer/licenses'),path.join(stage,'licenses'),{recursive:true});
  fs.writeFileSync(path.join(stage,'SHA256SUMS'),lock.sources.map(s=>`${s.sha256}  ${s.file}`).join('\n')+'\n');
  const output = path.join(root,'release',name+'.zip');
  if(fs.existsSync(output)) fs.unlinkSync(output);
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe',['-NoProfile','-Command',`Compress-Archive -LiteralPath '${stage.replaceAll("'","''")}' -DestinationPath '${output.replaceAll("'","''")}'`],{stdio:'inherit'})
    : spawnSync('/usr/bin/zip',['-q','-0','-r',output,name],{cwd:build,stdio:'inherit'});
  if(result.status!==0) throw Error('Third-party source ZIP failed.');
  fs.writeFileSync(output+'.sha256',`${sha256(fs.readFileSync(output))}  ${path.basename(output)}\n`);
  console.log(`Created ${output}`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
