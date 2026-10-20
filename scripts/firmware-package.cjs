const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const FLASH_SIZE = 16 * 1024 * 1024;
const sha256 = data => createHash('sha256').update(data).digest('hex');

function validateImage(bytes, name, limit) {
  if (bytes.length < 24 || bytes.length > limit || bytes[0] !== 0xe9 || bytes.readUInt16LE(12) !== 9) {
    throw Error(`${name}: expected an ESP32-S3 image within its reserved size.`);
  }
}
function inspectFirmware(directory, board) {
  if (board !== 'FNK0104B') throw Error('A confirmed FNK0104B board profile is required.');
  const files = ['bootloader.bin', 'partitions.bin', 'zachagotchi.bin'];
  const data = files.map(name => fs.readFileSync(path.join(directory, name)));
  validateImage(data[0], files[0], 0x8000);
  validateImage(data[2], files[2], FLASH_SIZE - 0x10000);
  const table = data[1];
  if (table.length < 64 || table.length > 4096 || table.length % 32 !== 0) throw Error('Invalid partition-table size.');
  const partitions = [];
  for (let offset = 0; offset + 32 <= table.length; offset += 32) {
    const magic = table.readUInt16LE(offset);
    if (magic === 0xffff) break;
    if (magic === 0xebeb) {
      const expected = createHash('md5').update(table.subarray(0, offset)).digest();
      if (!expected.equals(table.subarray(offset + 16, offset + 32))) throw Error('Partition-table MD5 mismatch.');
      break;
    }
    if (magic !== 0x50aa) throw Error('Invalid partition-table entry.');
    const part = {
      type: table[offset+2], subtype: table[offset+3],
      start: table.readUInt32LE(offset+4), size: table.readUInt32LE(offset+8),
      name: table.subarray(offset+12, offset+28).toString().replace(/\0.*$/, '')
    };
    if (!part.size || part.start % 4096 || part.size % 4096 || part.start < 0x9000 || part.start + part.size > FLASH_SIZE) throw Error('Invalid partition bounds.');
    partitions.push(part);
  }
  // Stable save location. No OTA selector, filesystem or merged-image padding is written.
  const nvs = partitions.find(p => p.type === 1 && p.subtype === 2 && p.name === 'nvs');
  const app = partitions.find(p => p.type === 0 && p.subtype === 0);
  if (!nvs || nvs.start !== 0x9000 || nvs.size !== 0x5000) throw Error('NVS must occupy 0x9000–0xdfff to preserve saves.');
  if (!app || app.start !== 0x10000 || data[2].length > app.size) throw Error('Expected a factory app at 0x10000 large enough for Zachagotchi.');
  if (partitions.filter(p => p.type === 0).length !== 1) throw Error('Only the single factory-app layout is supported.');
  const sorted = partitions.toSorted((a,b) => a.start-b.start);
  for (let i=1; i<sorted.length; i++) if (sorted[i].start < sorted[i-1].start+sorted[i-1].size) throw Error('Partitions overlap.');
  const offsets = ['0x0','0x8000','0x10000'];
  return files.map((name,i) => `${offsets[i]}\t${name}\t${sha256(data[i])}\t${data[i].length}`).join('\n')+'\n';
}
module.exports = { inspectFirmware, sha256 };
