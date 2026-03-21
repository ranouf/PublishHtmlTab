const os = require('os');
const fs = require('fs');
const path = require('path');
const tl = require('azure-pipelines-task-lib/task');
const dashify = require('dashify');
const globby = require('globby');
const { load } = require('cheerio');

const SUMMARY_ATTACHMENT_TYPE = 'report-html';
const FILE_ATTACHMENT_TYPE = 'report-html-file';

function getContext() {
  return {
    jobName: dashify(tl.getVariable('Agent.JobName') || 'job'),
    stageName: dashify(tl.getVariable('System.StageDisplayName') || '__default'),
    stageAttempt: tl.getVariable('System.StageAttempt') || '1',
    tabName: (tl.getInput('tabName', false) || 'HTML-Report').trim() || 'HTML-Report'
  };
}

function getReportFiles(reportDirInput) {
  const resolvedPath = path.resolve(reportDirInput);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`reportDir does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (stats.isDirectory()) {
    const files = globby.sync(['**/*'], {
      cwd: resolvedPath,
      absolute: true,
      dot: true,
      onlyFiles: true
    });

    const htmlFiles = files.filter((filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      return extension === '.html' || extension === '.htm';
    });

    if (htmlFiles.length === 0) {
      throw new Error(`No HTML files were found in directory: ${resolvedPath}`);
    }

    return files.sort((left, right) => left.localeCompare(right));
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (extension !== '.html' && extension !== '.htm') {
    throw new Error(`reportDir must point to an HTML file or a directory containing HTML files: ${resolvedPath}`);
  }

  return [resolvedPath];
}

function normalizeHtml(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const document = load(fileContent);
  fs.writeFileSync(filePath, document.html(), 'utf8');
}

function getSummaryAttachmentName(context) {
  return `${context.tabName}.${context.jobName}.${context.stageName}.${context.stageAttempt}`;
}

function getFileAttachmentName(context, index, fileName) {
  const relativePathToken = Buffer.from(fileName, 'utf8').toString('base64url');

  return [
    context.tabName,
    context.jobName,
    context.stageName,
    context.stageAttempt,
    String(index),
    relativePathToken
  ].join('.');
}

function isHtmlFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.html' || extension === '.htm';
}

function getDisplayName(reportRoot, filePath) {
  const relativePath = path.relative(reportRoot, filePath);
  if (relativePath && relativePath !== '') {
    return relativePath.replace(/\\/g, '/');
  }

  return path.basename(filePath);
}

function isRootIndexHtml(displayName) {
  const normalizedName = displayName.toLowerCase();
  return normalizedName === 'index.html' || normalizedName === 'index.htm';
}

function shouldExposeInManifest(htmlEntries) {
  const rootIndexEntry = htmlEntries.find((entry) => isRootIndexHtml(entry.displayName));
  if (rootIndexEntry) {
    return [rootIndexEntry];
  }

  return htmlEntries;
}

function run() {
  const reportDirInput = tl.getInput('reportDir', true);
  const resolvedInputPath = path.resolve(reportDirInput);
  const reportFiles = getReportFiles(reportDirInput);
  const context = getContext();
  const reportRoot = fs.statSync(resolvedInputPath).isDirectory()
    ? resolvedInputPath
    : path.dirname(resolvedInputPath);

  const manifest = {
    schemaVersion: 1,
    tabName: context.tabName,
    jobName: context.jobName,
    stageName: context.stageName,
    stageAttempt: context.stageAttempt,
    files: [],
    reports: []
  };
  const htmlEntries = [];

  reportFiles.forEach((filePath, index) => {
    tl.debug(`Publishing report ${filePath}`);
    if (isHtmlFile(filePath)) {
      normalizeHtml(filePath);
    }

    const displayName = getDisplayName(reportRoot, filePath);
    const attachmentName = getFileAttachmentName(context, index, displayName);

    const manifestEntry = {
      attachmentName,
      fileName: path.basename(filePath),
      displayName,
      relativePath: displayName,
      isHtml: isHtmlFile(filePath)
    };

    manifest.files.push(manifestEntry);

    if (manifestEntry.isHtml) {
      htmlEntries.push(manifestEntry);
    }

    tl.command('task.addattachment', {
      type: FILE_ATTACHMENT_TYPE,
      name: attachmentName
    }, filePath);
  });

  manifest.reports = shouldExposeInManifest(htmlEntries);

  const tempDirectory = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
  const manifestPath = path.join(tempDirectory, `publish-html-report-${Date.now()}.json`);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  tl.addAttachment(SUMMARY_ATTACHMENT_TYPE, getSummaryAttachmentName(context), manifestPath);
}

try {
  run();
} catch (error) {
  tl.setResult(tl.TaskResult.Failed, error.message);
}
