const fs = require('node:fs');
const path = require('node:path');

function nextVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid version: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (major === 0 && (minor > 599 || patch > 9)) throw new Error(`Version outside pre-1.0 range: ${version}`);
  if (major === 0 && minor === 0) return patch < 9 ? `0.0.${patch + 1}` : '0.1.0';
  if (major === 0) {
    if (minor === 599 && patch === 9) return '1.0.0';
    return patch < 9 ? `0.${minor}.${patch + 1}` : `0.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const packagePath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.version = nextVersion(pkg.version);
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  const lockPath = path.join(root, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = pkg.version;
    if (lock.packages?.['']) lock.packages[''].version = pkg.version;
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(root, 'VERSION'), `v${pkg.version}\n`);
  console.log(`Version bumped to v${pkg.version}`);
}

module.exports = { nextVersion };
