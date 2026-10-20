const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectFirmware, sha256 } = require('./firmware-package.cjs');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const lock = require('../installer/tools-lock.json');
const tool = lock.tools.find(t => t.platform === 'windows');
const executable = path.join(root, 'installer/vendor', tool.path);
const manifest = inspectFirmware(path.join(root, 'installer/firmware'), 'FNK0104B');
if (!fs.existsSync(executable) || sha256(fs.readFileSync(executable)) !== tool.sha256) throw Error('Missing/changed Windows tool. Run npm run fetch:tools.');
fs.mkdirSync(path.join(root, '.build'), {recursive:true});
fs.mkdirSync(path.join(root, 'release'), {recursive:true});
const build = fs.mkdtempSync(path.join(root, '.build/windows-'));
const name = `Zachagotchi-Flasher-${version}-Windows-x64`;
const stage = path.join(build, name);
fs.mkdirSync(path.join(stage, 'firmware'), {recursive:true});
for (const file of ['flash.ps1', 'Zachagotchi Flasher.cmd', 'THIRD-PARTY.txt', 'README-Windows.txt', 'tools-lock.json']) fs.copyFileSync(path.join(root, 'installer', file), path.join(stage, file));
fs.copyFileSync(executable, path.join(stage, 'esptool.exe'));
fs.copyFileSync(path.join(path.dirname(executable), 'LICENSE'), path.join(stage, 'LICENSE.esptool'));
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE.Zachagotchi'));
fs.cpSync(path.join(root, 'installer/licenses'), path.join(stage, 'licenses'), {recursive:true});
fs.cpSync(path.join(root, 'firmware'), path.join(stage, 'firmware-source'), {recursive:true,filter:source=>!['build','.DS_Store'].includes(path.basename(source))});
for (const file of ['bootloader.bin', 'partitions.bin', 'zachagotchi.bin', 'board.txt']) fs.copyFileSync(path.join(root, 'installer/firmware', file), path.join(stage, 'firmware', file));
fs.writeFileSync(path.join(stage, 'firmware/manifest.tsv'), manifest);
const output = path.join(root, 'release', name + '.zip');
// Avoid stale entries when rebuilding the same ZIP.
if (fs.existsSync(output)) fs.unlinkSync(output);
const result = process.platform === 'win32'
  ? spawnSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -LiteralPath '${stage.replaceAll("'", "''")}' -DestinationPath '${output.replaceAll("'", "''")}'`], {stdio:'inherit'})
  : spawnSync('/usr/bin/zip', ['-q', '-r', output, name], {cwd:build, stdio:'inherit'});
if (result.status !== 0) throw Error(`Windows ZIP creation failed. Staging: ${stage}`);
fs.writeFileSync(output + '.sha256', `${sha256(fs.readFileSync(output))}  ${path.basename(output)}\n`);
console.log(`Created ${output}\nStaging: ${stage}\nWindows hardware testing is required before marking the release stable.`);
