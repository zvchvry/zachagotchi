const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pwsh = process.env.ZACH_PWSH || (process.platform === 'win32' ? 'powershell.exe' : null);
test('Windows flasher safety suite (mock ports; no real hardware)', {skip:!pwsh}, () => {
  const result = spawnSync(pwsh, ['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-flasher.test.ps1')], {encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.match(result.stdout,/PASS: .*Windows flasher safety assertions/);
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
