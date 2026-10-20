// Download only official, checksum-pinned tools. Node 20+; no npm dependencies.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {sha256} = require('./firmware-package.cjs');
const root = path.resolve(__dirname, '..');
const lock = require('../installer/tools-lock.json');
const args = process.argv.slice(2);
if (args.some(a => !['--platform=macos','--platform=windows'].includes(a)) || args.length > 1) throw Error('Use --platform=macos or --platform=windows, or no argument for both.');
const platform = args[0]?.split('=')[1];
const downloads = path.join(root, '.build/downloads');
const vendor = path.join(root, 'installer/vendor');
fs.mkdirSync(downloads, {recursive:true}); fs.mkdirSync(vendor, {recursive:true});
function run(command, argv) {
  const result = spawnSync(command, argv, {stdio:'inherit'});
  if (result.status !== 0) throw Error(`${command} failed (${result.status}).`);
}
(async () => {
  for (const tool of lock.tools.filter(t => !platform || t.platform === platform)) {
    const existing = path.join(vendor, tool.path);
    if (fs.existsSync(existing) && sha256(fs.readFileSync(existing)) === tool.sha256 && fs.existsSync(path.join(path.dirname(existing),'LICENSE'))) {
      console.log(`Verified existing ${tool.name}`);
      continue;
    }
    const archive = path.join(downloads, tool.archive);
    if (!fs.existsSync(archive)) {
      const url = `https://github.com/espressif/esptool/releases/download/v${lock.version}/${tool.archive}`;
      const response = await fetch(url);
      if (!response.ok) throw Error(`Download failed: ${response.status} ${url}`);
      fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
    }
    if (sha256(fs.readFileSync(archive)) !== tool.archiveSha256) throw Error(`Archive checksum mismatch: ${archive}`);
    const folder = tool.path.split('/')[0];
    if (tool.platform === 'windows') {
      if (process.platform === 'win32') {
        run('powershell.exe', ['-NoProfile','-Command', `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${vendor.replaceAll("'", "''")}' -Force`]);
      } else run('/usr/bin/unzip', ['-oq', archive, `${folder}/esptool.exe`, `${folder}/LICENSE`, '-d', vendor]);
    } else run('tar', ['-xzf', archive, '-C', vendor, `${folder}/esptool`, `${folder}/LICENSE`]);
    const executable = path.join(vendor, tool.path);
    if (sha256(fs.readFileSync(executable)) !== tool.sha256) throw Error(`Executable checksum mismatch: ${tool.path}`);
    if (tool.platform === 'macos' && process.platform !== 'win32') fs.chmodSync(executable, 0o755);
    console.log(`Verified ${tool.name}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
