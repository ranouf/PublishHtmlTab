const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function getAutoVersion() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const secondsSinceMidnight =
    (now.getUTCHours() * 60 * 60) +
    (now.getUTCMinutes() * 60) +
    now.getUTCSeconds();
  const runSuffix = process.env.GITHUB_RUN_NUMBER || String(secondsSinceMidnight);

  return `1.${year}${month}${day}.${runSuffix}`;
}

function main() {
  const version = process.argv[2] || getAutoVersion();
  const rootDir = path.resolve(__dirname, "..");

  const rootPackagePath = path.join(rootDir, "package.json");
  const taskPackagePath = path.join(rootDir, "PublishHtmlReport", "package.json");
  const extensionManifestPath = path.join(rootDir, "azure-devops-extension.json");
  const taskManifestPath = path.join(rootDir, "PublishHtmlReport", "task.json");

  const rootPackage = readJson(rootPackagePath);
  rootPackage.version = version;
  writeJson(rootPackagePath, rootPackage);

  const taskPackage = readJson(taskPackagePath);
  taskPackage.version = version;
  writeJson(taskPackagePath, taskPackage);

  const extensionManifest = readJson(extensionManifestPath);
  extensionManifest.version = version;
  writeJson(extensionManifestPath, extensionManifest);

  const taskManifest = readJson(taskManifestPath);
  const [major, minor, patch] = version.split(".");
  taskManifest.version = {
    Major: major,
    Minor: minor,
    Patch: patch
  };
  writeJson(taskManifestPath, taskManifest);

  process.stdout.write(version);
}

main();
