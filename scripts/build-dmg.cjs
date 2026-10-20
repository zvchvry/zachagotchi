const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectFirmware, sha256 } = require('./firmware-package.cjs');
const root = path.resolve(__dirname, '..');
const installerVersion = require('../package.json').version;
const args = process.argv.slice(2);
const preview = args.includes('--preview');
if (args.some(arg => !['--preview','--board=FNK0104B'].includes(arg))) throw Error('Usage: node scripts/build-dmg.cjs --preview OR --board=FNK0104B');
if (process.platform !== 'darwin') throw Error('Build the DMG on macOS.');
// Fail before staging a release if actual device firmware is absent or invalid.
const manifest = preview ? null : inspectFirmware(path.join(root,'installer/firmware'), args.includes('--board=FNK0104B') ? 'FNK0104B' : null);
const toolLock = require('../installer/tools-lock.json');
const lockedTools = {...toolLock, tools:toolLock.tools.filter(t => t.platform === 'macos')};
for (const tool of lockedTools.tools) {
  const file = path.join(root,'installer/vendor',tool.path);
  if (!fs.existsSync(file) || sha256(fs.readFileSync(file)) !== tool.sha256) throw Error(`Bundled tool missing or changed: ${tool.path}. Run scripts/fetch-esptool.sh.`);
}
fs.mkdirSync(path.join(root,'.build'), {recursive:true});
fs.mkdirSync(path.join(root,'release'), {recursive:true});
const build = fs.mkdtempSync(path.join(root,'.build/dmg-'));
const stage = path.join(build,'volume');
const name = preview ? 'Zachagotchi Flasher Preview' : 'Zachagotchi Flasher';
const app = path.join(stage,`${name}.app`);
const resources = path.join(app,'Contents/Resources');
const macos = path.join(app,'Contents/MacOS');
fs.mkdirSync(resources,{recursive:true}); fs.mkdirSync(macos,{recursive:true});
const write = (file, text, executable=false) => fs.writeFileSync(file,text,{mode:executable?0o755:0o644});
write(path.join(macos,'launcher'),`#!/bin/sh
set -eu
CONTENTS="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec /usr/bin/open -a Terminal "$CONTENTS/Resources/Zachagotchi Flasher.command"
`,true);
write(path.join(app,'Contents/Info.plist'),`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleDevelopmentRegion</key><string>en</string>
<key>CFBundleName</key><string>${name}</string>
<key>CFBundleDisplayName</key><string>${name}</string>
<key>CFBundleIdentifier</key><string>local.zachagotchi.flasher${preview?'.preview':''}</string>
<key>CFBundleExecutable</key><string>launcher</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${installerVersion}</string>
<key>CFBundleVersion</key><string>${installerVersion.split('.').join('')}</string>
<key>LSMinimumSystemVersion</key><string>10.15</string>
<key>LSArchitecturePriority</key><array><string>arm64</string><string>x86_64</string></array>
<key>LSRequiresNativeExecution</key><true/>
<key>LSUIElement</key><true/>
</dict></plist>`);
fs.copyFileSync(path.join(root,'installer/flash.command'),path.join(resources,'Zachagotchi Flasher.command'));
fs.chmodSync(path.join(resources,'Zachagotchi Flasher.command'),0o755);
for (const tool of lockedTools.tools) {
  fs.copyFileSync(path.join(root,'installer/vendor',tool.path),path.join(resources,tool.name));
  fs.chmodSync(path.join(resources,tool.name),0o755);
}
fs.copyFileSync(path.join(root,'installer/vendor/esptool-macos-arm64/LICENSE'),path.join(resources,'LICENSE.esptool'));
fs.copyFileSync(path.join(root,'installer/tools-lock.json'),path.join(resources,'tools-lock.json'));
fs.mkdirSync(path.join(resources,'firmware'));
if (manifest) {
  for (const file of ['bootloader.bin','partitions.bin','zachagotchi.bin']) fs.copyFileSync(path.join(root,'installer/firmware',file),path.join(resources,'firmware',file));
  write(path.join(resources,'firmware/manifest.tsv'),manifest);
  write(path.join(resources,'firmware/board.txt'),'FNK0104B\n');
} else fs.copyFileSync(path.join(root,'installer/firmware/README.txt'),path.join(resources,'firmware/README.txt'));
const readme=fs.readFileSync(path.join(root,preview?'installer/README-preview.txt':'installer/README.txt'),'utf8');
write(path.join(stage,'READ ME FIRST.txt'),readme);
write(path.join(stage,`${name}.command`),`#!/bin/bash
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec "$ROOT/${name}.app/Contents/Resources/Zachagotchi Flasher.command" "$@"
`,true);
fs.cpSync(path.join(root,'firmware'),path.join(resources,'firmware-source'),{recursive:true,filter:source=>!['build','.DS_Store'].includes(path.basename(source))});
fs.cpSync(path.join(root,'installer/licenses'),path.join(resources,'licenses'),{recursive:true});
fs.copyFileSync(path.join(root,'installer/THIRD-PARTY.txt'),path.join(resources,'THIRD-PARTY.txt'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(resources,'LICENSE.Zachagotchi'));
const check=spawnSync('/bin/bash',[path.join(resources,'Zachagotchi Flasher.command'),'--check'],{encoding:'utf8'});
if (check.status !== (preview?2:0)) throw Error(`Packaged validation failed: ${check.stdout}\n${check.stderr}`);
// Exercise the packaged native executable without opening a serial port.
const toolCheck=spawnSync('/bin/bash',[path.join(resources,'Zachagotchi Flasher.command'),'--tool-version'],{encoding:'utf8'});
if (toolCheck.status !== 0 || !toolCheck.stdout.includes(lockedTools.version)) throw Error(`Native tool check failed: ${toolCheck.stdout}\n${toolCheck.stderr}`);
const plistCheck=spawnSync('/usr/bin/plutil',['-convert','json','-o','-',path.join(app,'Contents/Info.plist')],{encoding:'utf8'});
if (plistCheck.status !== 0) throw Error(`Invalid app metadata: ${plistCheck.stderr}`);
const plist=JSON.parse(plistCheck.stdout);
if (plist.LSRequiresNativeExecution !== true || plist.LSArchitecturePriority?.[0] !== 'arm64') throw Error('Native Mac launch settings are missing.');
// Personal build: no silent claim of Developer ID signing or notarization.
const output=path.join(root,'release',`${name.replaceAll(' ','-')}-${installerVersion}.dmg`);
const result=spawnSync('/usr/bin/hdiutil',['create','-volname',name,'-srcfolder',stage,'-format','UDZO','-imagekey','zlib-level=9','-ov',output],{stdio:'inherit'});
if(result.status!==0) throw Error(`Disk image creation failed. Staged files remain at ${stage}`);
fs.writeFileSync(`${output}.sha256`,`${sha256(fs.readFileSync(output))}  ${path.basename(output)}\n`);
console.log(`Created ${output}\nMode: ${preview?'non-flashing preview; no firmware bundled':'clean-install firmware release; no backup'}\nStaging: ${stage}`);
