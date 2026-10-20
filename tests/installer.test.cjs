const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { inspectFirmware } = require('../scripts/firmware-package.cjs');
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zach-flasher-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const firmware=path.join(dir,'firmware');fs.mkdirSync(firmware);
  const image=Buffer.alloc(128);image[0]=0xe9;image.writeUInt16LE(9,12);
  fs.writeFileSync(path.join(firmware,'bootloader.bin'),image);
  fs.writeFileSync(path.join(firmware,'zachagotchi.bin'),image);
  const table=Buffer.alloc(96,0xff);
  function partition(at,type,subtype,start,size,name) {
    table.fill(0,at,at+32);table.writeUInt16LE(0x50aa,at);table[at+2]=type;table[at+3]=subtype;
    table.writeUInt32LE(start,at+4);table.writeUInt32LE(size,at+8);table.write(name,at+12);
  }
  partition(0,1,2,0x9000,0x5000,'nvs');partition(32,0,0,0x10000,0x300000,'factory');
  fs.writeFileSync(path.join(firmware,'partitions.bin'),table);
  return {dir,firmware,table};
}
test('firmware images exclude NVS even though clean install erases all flash',t=>{
  const {firmware}=fixture(t);const manifest=inspectFirmware(firmware,'FNK0104B');
  assert.deepEqual(manifest.trim().split('\n').map(line=>line.split('\t')[0]),['0x0','0x8000','0x10000']);
});

function cleanInstallFixture(t, options={}) {
  const {dir,firmware}=fixture(t);
  fs.writeFileSync(path.join(firmware,'board.txt'),'FNK0104B\n');
  fs.writeFileSync(path.join(firmware,'manifest.tsv'),inspectFirmware(firmware,'FNK0104B'));
  const command=path.join(dir,'flash.command');
  // Use fake ports and fake tools only. No real serial device can be opened.
  const source=fs.readFileSync(path.join(__dirname,'../installer/flash.command'),'utf8');
  fs.writeFileSync(command,source.replace('for p in /dev/cu.*;', 'for p in "$ROOT"/cu.*;'));
  fs.writeFileSync(path.join(dir,'cu.test'),'');
  const calls=path.join(dir,'calls');
  const fake=`#!/bin/bash
ROOT="$(dirname "$0")"
printf '%s\\n' "$*" >> "$ROOT/calls"
case " $* " in
  *' flash-id '*)
    ${options.failAt==='flash-id'?'exit 1':''}
    printf 'Detected flash size: ${options.size || '16MB'}\\n'
    ${options.corruptAfterCheck?'printf damaged >> "$ROOT/firmware/zachagotchi.bin"':''}
    ;;
  *' write-flash '*) ${options.failAt==='write-flash'?'exit 1':':'} ;;
  *' verify-flash '*) ${options.failAt==='verify-flash'?'exit 1':':'} ;;
  *) exit 99 ;;
esac
`;
  for(const architecture of ['arm64','amd64']) fs.writeFileSync(path.join(dir,`esptool-${architecture}`),fake,{mode:0o755});
  return {
    dir,firmware,
    run(input='1\nINSTALL\n') { return spawnSync('/bin/bash',[command],{input,encoding:'utf8',env:{...process.env,TMPDIR:dir+'/'}}); },
    calls() { return fs.existsSync(calls)?fs.readFileSync(calls,'utf8').trim().split('\n'):[]; }
  };
}
test('clean install checks hardware then erases, writes and verifies without reading a backup',{skip:process.platform!=='darwin'},t=>{
  const f=cleanInstallFixture(t);const result=f.run();
  assert.equal(result.status,0,result.stderr);
  const calls=f.calls();assert.equal(calls.length,3);
  assert.match(calls[0],/--chip esp32s3 .* flash-id$/);
  assert.match(calls[1],/write-flash --erase-all 0x0 .*bootloader.bin 0x8000 .*partitions.bin 0x10000 .*zachagotchi.bin$/);
  assert.match(calls[2],/--after watchdog-reset verify-flash /);
  assert.doesNotMatch(calls.join('\n'),/read-flash|original.bin|--force/);
  assert.match(result.stdout,/installed and verified/);
});
test('cancel and EOF never connect to or erase the board',{skip:process.platform!=='darwin'},t=>{
  const f=cleanInstallFixture(t);
  for(const input of ['q\n','1\n\n','1\ninstall\n','1\n']) {
    assert.equal(f.run(input).status,0);
    assert.deepEqual(f.calls(),[]);
  }
});
test('missing or corrupt firmware stops before any board access',{skip:process.platform!=='darwin'},t=>{
  const f=cleanInstallFixture(t);
  fs.appendFileSync(path.join(f.firmware,'zachagotchi.bin'),'damaged');
  assert.equal(f.run().status,1);
  assert.deepEqual(f.calls(),[]);
});
for(const [name,options,expectedCalls] of [
  ['connection failure',{failAt:'flash-id'},1],
  ['wrong flash size',{size:'8MB'},1],
  ['unknown flash size',{size:'unknown'},1],
  ['firmware changed after hardware check',{corruptAfterCheck:true},1],
  ['write failure',{failAt:'write-flash'},2],
  ['verification failure',{failAt:'verify-flash'},3]
]) test(`clean install stops safely on ${name}`,{skip:process.platform!=='darwin'},t=>{
  const f=cleanInstallFixture(t,options);const result=f.run();
  assert.equal(result.status,1);
  assert.equal(f.calls().length,expectedCalls);
  assert.doesNotMatch(result.stdout,/installed and verified/);
  if(expectedCalls===1) assert.doesNotMatch(f.calls().join('\n'),/write-flash|erase/);
});
test('rejects wrong chip, unknown model, missing binaries and changed NVS layout',t=>{
  const {firmware,table}=fixture(t);
  assert.throws(()=>inspectFirmware(firmware,'FNK0104A'),/confirmed/);
  assert.throws(()=>inspectFirmware(path.join(firmware,'missing'),'FNK0104B'),/ENOENT/);
  table.writeUInt32LE(0xa000,4);fs.writeFileSync(path.join(firmware,'partitions.bin'),table);
  assert.throws(()=>inspectFirmware(firmware,'FNK0104B'),/NVS/);
  const image=Buffer.alloc(32);image[0]=0xe9;
  fs.writeFileSync(path.join(firmware,'bootloader.bin'),image);
  assert.throws(()=>inspectFirmware(firmware,'FNK0104B'),/ESP32-S3/);
});
test('checks partition-table digest when present',t=>{
  const {firmware,table}=fixture(t);
  table.writeUInt16LE(0xebeb,64);
  createHash('md5').update(table.subarray(0,64)).digest().copy(table,80);
  fs.writeFileSync(path.join(firmware,'partitions.bin'),table);
  assert.doesNotThrow(()=>inspectFirmware(firmware,'FNK0104B'));
  table[95]^=1;fs.writeFileSync(path.join(firmware,'partitions.bin'),table);
  assert.throws(()=>inspectFirmware(firmware,'FNK0104B'),/MD5/);
});
test('packaged flasher rejects missing payload and verifies valid files without serial access',{skip:process.platform!=='darwin'},t=>{
  const {dir,firmware}=fixture(t);
  const command=path.join(dir,'flash.command');
  fs.copyFileSync(path.join(__dirname,'../installer/flash.command'),command);
  const check=()=>spawnSync('/bin/bash',[command,'--check'],{encoding:'utf8'});
  assert.equal(check().status,2);
  fs.writeFileSync(path.join(firmware,'board.txt'),'FNK0104B\n');
  fs.writeFileSync(path.join(firmware,'manifest.tsv'),inspectFirmware(firmware,'FNK0104B'));
  assert.equal(check().status,0);
  fs.appendFileSync(path.join(firmware,'zachagotchi.bin'),'damaged');
  assert.equal(check().status,2);
});
test('tool diagnostic selects the native Mac binary without connecting to a board',{skip:process.platform!=='darwin'},t=>{
  const {dir}=fixture(t);
  const command=path.join(dir,'flash.command');
  fs.copyFileSync(path.join(__dirname,'../installer/flash.command'),command);
  for (const architecture of ['arm64','amd64']) {
    fs.writeFileSync(path.join(dir,`esptool-${architecture}`),`#!/bin/bash\n[[ "$#" == 1 && "$1" == version ]] || exit 99\nprintf '${architecture} version-check-only\\n'\n`,{mode:0o755});
  }
  const result=spawnSync('/bin/bash',[command,'--tool-version'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,new RegExp(`${process.arch==='arm64'?'arm64':'amd64'} version-check-only`));
  assert.doesNotMatch(result.stdout,/USB serial ports|Checking chip/);
});
test('Apple Silicon hardware wins over a translated shell architecture',{skip:process.platform!=='darwin'},t=>{
  const {dir}=fixture(t);
  const source=fs.readFileSync(path.join(__dirname,'../installer/flash.command'),'utf8');
  const selection=source.slice(source.indexOf('select_tool() {'),source.indexOf('\nvalidate_firmware()'));
  for (const name of ['esptool-arm64','esptool-amd64']) fs.writeFileSync(path.join(dir,name),'#!/bin/sh\nexit 0\n',{mode:0o755});
  for (const [uname,armCapable,expected] of [['x86_64','1','arm64'],['x86_64','0','amd64'],['arm64','','arm64']]) {
    // Replace only OS probes in a copy of the real selector; production paths stay fixed.
    const selector=selection.replace('/usr/bin/uname -m',`printf '${uname}'`).replace('/usr/sbin/sysctl -n hw.optional.arm64',`printf '${armCapable}'`);
    const result=spawnSync('/bin/bash',['-c',`ROOT="$1"; fail() { exit 1; }; ${selector}\nselect_tool\nprintf '%s' "$TOOL"`,'test',dir],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout,path.join(dir,`esptool-${expected}`));
  }
});
