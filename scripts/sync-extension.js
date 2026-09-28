// Copies the shared pure modules from js/ into extension/lib/ (byte for byte).
// An unpacked extension can't load files outside its own folder, so this is how the
// extension reuses the web app's scoring without a second copy of the logic.
// Run: npm run build:ext   (tests/extension.test.js fails if the copies are stale)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED = ['metrics.js', 'words.js', 'share.js', 'rides.js'];
const DEST = path.join(ROOT, 'extension', 'lib');

function sync() {
  fs.mkdirSync(DEST, { recursive: true });
  const copied = [];
  for (const f of SHARED) {
    const src = path.join(ROOT, 'js', f);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(DEST, f));
    copied.push(f);
  }
  return copied;
}

if (require.main === module) {
  const copied = sync();
  console.log('Synced into extension/lib: ' + copied.join(', '));
}

module.exports = { SHARED, DEST, sync };
