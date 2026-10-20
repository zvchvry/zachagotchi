const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pwsh = process.env.ZACH_PWSH || (process.platform === 'win32' ? 'powershell.exe' : null);
function childPowerShellEnv(env) {
  // PowerShell 7 can export its module path through npm/Node. Let the child
  // Windows PowerShell 5.1 reconstruct its own paths instead of loading PS7's
  // incompatible Utility module (which breaks Get-FileHash). Only the child
  // environment is changed; preserve the parent's environment and other vars.
  return Object.fromEntries(Object.entries(env).filter(([key])=>key.toLowerCase()!=='psmodulepath'));
}
test('Windows flasher safety suite (mock ports; no real hardware)', {skip:!pwsh}, () => {
  // Deliberately supply a poisoned inherited path: this must be removed even
  // when npm test was launched from PowerShell 7 rather than Windows PS 5.1.
  const env=childPowerShellEnv({...process.env,PSModulePath:path.join(root,'nonexistent-ps7-modules')});
  const result = spawnSync(pwsh, ['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-flasher.test.ps1')], {encoding:'utf8',env});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.match(result.stdout,/PASS: .*Windows flasher safety assertions/);
});
test('child PowerShell environment removes inherited module paths case-insensitively without changing parent',()=>{
  const parent={Path:'keep-path',TEMP:'keep-temp',PSModulePath:'ps7-modules',psmodulepath:'other-case'};
  const child=childPowerShellEnv(parent);
  assert.deepEqual(child,{Path:'keep-path',TEMP:'keep-temp'});
  assert.equal(parent.PSModulePath,'ps7-modules');
  assert.equal(parent.psmodulepath,'other-case');
});
test('native tool downloads and Mac/Windows builders use one version and checksum lock', () => {
  const {tools} = require('../installer/tools-lock.json');
  assert.equal(tools.filter(t=>t.platform==='macos').length,2);
  assert.equal(tools.filter(t=>t.platform==='windows').length,1);
  for (const tool of tools) {
    assert.match(tool.sha256,/^[a-f0-9]{64}$/);
    assert.match(tool.archiveSha256,/^[a-f0-9]{64}$/);
    assert.doesNotMatch(tool.path,/\.\./);
  }
  for(const name of ['build-dmg.cjs','build-windows.cjs']) {
    const source = fs.readFileSync(path.join(root,'scripts',name),'utf8');
    assert.match(source,/require\('\.\.\/package.json'\).version/);
    assert.match(source,/inspectFirmware/);
    assert.match(source,/tools-lock.json/);
    assert.match(source,/LICENSE.Zachagotchi/);
    assert.match(source,/filter:source=>!\['build','\.DS_Store'\]/);
  }
});
