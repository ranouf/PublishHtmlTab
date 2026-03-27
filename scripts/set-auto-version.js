const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getAutoVersion() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const secondsSinceMidnight =
    now.getUTCHours() * 60 * 60 +
    now.getUTCMinutes() * 60 +
    now.getUTCSeconds();
  const runSuffix =
    process.env.GITHUB_RUN_NUMBER || String(secondsSinceMidnight);

  return `1.${year}${month}${day}.${runSuffix}`;
}

function updateVersionField(filePath, version) {
  const content = readJson(filePath);
  content.version = version;
  writeJson(filePath, content);
}

function updateTaskManifestVersion(filePath, version) {
  const taskManifest = readJson(filePath);
  const [major, minor, patch] = version.split('.');
  taskManifest.version = {
    Major: major,
    Minor: minor,
    Patch: patch,
  };
  writeJson(filePath, taskManifest);
}

function getVersionFilePaths(rootDir) {
  return {
    extensionManifestPath: path.join(rootDir, 'azure-devops-extension.json'),
    rootPackagePath: path.join(rootDir, 'package.json'),
    taskManifestPath: path.join(rootDir, 'PublishHtmlReport', 'task.json'),
    taskPackagePath: path.join(rootDir, 'PublishHtmlReport', 'package.json'),
  };
}

function main() {
  const version = process.argv[2] || getAutoVersion();
  const rootDir = path.resolve(__dirname, '..');
  const {
    extensionManifestPath,
    rootPackagePath,
    taskManifestPath,
    taskPackagePath,
  } = getVersionFilePaths(rootDir);

  updateVersionField(rootPackagePath, version);
  updateVersionField(taskPackagePath, version);
  updateVersionField(extensionManifestPath, version);
  updateTaskManifestVersion(taskManifestPath, version);

  process.stdout.write(version);
}

main();
