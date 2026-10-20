const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {inspectFirmware}=require('./firmware-package.cjs');
const root=path.resolve(__dirname,'..');
const python=process.env.ZACH_PYTHON || 'python3';
const pythonCheck=spawnSync(python,['--version'],{encoding:'utf8'});
if(pythonCheck.status!==0)throw Error('A working Python 3 is required to generate the partition table. Set ZACH_PYTHON to its executable path. The DMG itself does not need Python.');
require('./build-avatar.cjs');
const sketch=path.join(root,'firmware/Zachagotchi');
// The sketch is plain C++ with explicit declarations. Arduino's legacy Intel-only
// ctags prototype generator is unnecessary; no Rosetta or system install is needed.
const ino=fs.readFileSync(path.join(sketch,'Zachagotchi.ino'),'utf8');
if(ino.split('\n').some(line=>line.trim()&&!line.trim().startsWith('//')))throw Error('Keep executable code in main.cpp, with explicit declarations.');
const output=path.join(root,'.build/firmware-output');
const args=['compile','--config-file',path.join(root,'.build/arduino/arduino-cli.yaml'),
  '--fqbn','esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,CDCOnBoot=cdc,USBMode=hwcdc,PartitionScheme=custom',
  '--build-property','tools.ctags.pattern=/usr/bin/true',
  '--build-property',`tools.gen_esp32part.cmd="${python}" "{runtime.platform.path}/tools/gen_esp32part.py"`,
  '--build-path',path.join(root,'.build/firmware-build'),'--output-dir',output,sketch];
const result=spawnSync(path.join(root,'.build/arduino/arduino-cli'),args,{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const firmware=path.join(root,'installer/firmware');
for(const [from,to] of [['bootloader.bin','bootloader.bin'],['partitions.bin','partitions.bin'],['bin','zachagotchi.bin']]){
  fs.copyFileSync(path.join(output,`Zachagotchi.ino.${from}`),path.join(firmware,to));
}
const manifest=inspectFirmware(firmware,'FNK0104B');
fs.writeFileSync(path.join(firmware,'manifest.tsv'),manifest);
fs.writeFileSync(path.join(firmware,'board.txt'),'FNK0104B\n');
console.log('Firmware built and validated for Freenove FNK0104B. Hardware testing is still required.');
