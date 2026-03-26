const fs = require('fs');
const path = require('path');

function findLatestVsix(rootDir) {
  const files = fs
    .readdirSync(rootDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.vsix'))
    .map((fileName) => {
      const fullPath = path.join(rootDir, fileName);
      const stat = fs.statSync(fullPath);
      return {
        fullPath,
        modifiedAt: stat.mtimeMs,
        modifiedDate: stat.mtime,
      };
    });

  if (files.length === 0) {
    return undefined;
  }

  files.sort((left, right) => right.modifiedAt - left.modifiedAt);
  return files[0];
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--manifest' && next) {
      result.manifest = next;
      index += 1;
      continue;
    }
    if (token === '--overrides' && next) {
      result.overrides = next;
      index += 1;
    }
  }
  return result;
}

function readJson(filePath) {
  if (!filePath) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readExtensionInfo(rootDir, args) {
  const manifestPath = path.join(
    rootDir,
    args.manifest || 'azure-devops-extension.json',
  );
  const overridesPath = args.overrides
    ? path.join(rootDir, args.overrides)
    : undefined;
  const manifest = readJson(manifestPath);
  const overrides = overridesPath && fs.existsSync(overridesPath)
    ? readJson(overridesPath)
    : {};
  const merged = {
    ...manifest,
    ...overrides,
  };

  return {
    extensionId: merged.id || 'unknown',
    extensionVersion: merged.version || 'unknown',
    publisher: merged.publisher || 'unknown',
  };
}

function formatLocalDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const latestVsix = findLatestVsix(rootDir);
  if (!latestVsix) {
    console.log(' - VSIX summary: no .vsix file found.');
    return;
  }

  const info = readExtensionInfo(rootDir, args);
  const generatedAt = formatLocalDateTime(latestVsix.modifiedDate);

  console.log(` - Generated At: ${generatedAt}`);
  console.log(` - VSIX: ${latestVsix.fullPath}`);
  console.log(` - Extension ID: ${info.extensionId}`);
  console.log(` - Extension Version: ${info.extensionVersion}`);
  console.log(` - Publisher: ${info.publisher}`);
}

main();
