# PublishHtmlTab

This project extends Azure DevOps with a custom pipeline task that publishes HTML reports directly inside the build results UI.

## Credits

This extension was originally created by **Jakub Rumpca**.  
This repository keeps that work alive, updates it for a modern Node runtime, and improves the publishing flow so it can handle both a single HTML file and a full report directory.

## What The Extension Does

The extension adds a task named `Publish HTML Tab` to Azure DevOps pipelines.

When the task runs:

1. It reads the `reportDir` input.
2. If `reportDir` points to a file, it publishes that HTML file.
3. If `reportDir` points to a directory, it publishes the entire directory recursively, including files such as `.css`, `.js`, `.xml`, images, and nested subfolders.
4. It creates the attachments Azure DevOps needs so the report becomes visible from the build results page.
5. Only the `.html` / `.htm` files become selectable report entries in the UI, but their companion assets are also published so relative references can resolve correctly.
6. The web extension reads those attachments and renders the report content inside an embedded tab.

## Inputs

### `reportDir`

Required.  
Path to:

- a single HTML file, or
- a directory whose full contents must be published recursively

### `tabName`

Optional.  
Name of the Azure DevOps tab shown in the build results page.

## Example: Single HTML File

```yaml
steps:
  - task: PublishHtmlTab@1
    displayName: Publish accessibility report
    inputs:
      reportDir: "$(Build.SourcesDirectory)/artifacts/accessibility/report.html"
      tabName: "Accessibility report"
```

## Example: Full Report Folder

```yaml
steps:
  - task: PublishHtmlTab@1
    displayName: Publish Playwright report
    inputs:
      reportDir: "$(Build.SourcesDirectory)/playwright-report"
      tabName: "Playwright report"
```

## Expected Result

After the pipeline finishes:

- Azure DevOps shows a new build results tab with the name provided in `tabName`
- if `reportDir` points to one HTML file, that report is displayed directly
- if `reportDir` points to a folder, the task publishes all files and subfolders, while the tab displays the HTML entry points from that folder
- the report content is rendered directly inside Azure DevOps, so users do not need to download the file manually

## How It Works Internally

The solution is composed of two parts:

- the pipeline task in `PublishHtmlReport/task.json`, which publishes the HTML artifacts
- the viewer in `src/tabContent.tsx`, which loads and renders those artifacts inside Azure DevOps

The task writes a small manifest attachment plus the published report files.  
The Azure DevOps extension reads that manifest to know which HTML files to display and how to label them, while the other assets remain available for relative links used by the report.

## CI And Release Workflows

This repository includes two GitHub Actions workflows:

- `.github/workflows/pr-validation.yml` validates pull requests targeting `main`
- `.github/workflows/release-vsix.yml` builds a release VSIX and publishes it as a GitHub Release when changes reach `main`

The release workflow does not publish to the Visual Studio Marketplace.  
It only generates the `.vsix` package so it can be uploaded manually.

Versioning is handled automatically in CI.  
During PR validation and release generation, the workflow computes a version in the form `1.YYYYMMDD.RUN_NUMBER` and updates the extension manifests before packaging.

## How To Make The Task Available In Azure DevOps

To use `PublishHtmlTab@1` in an Azure DevOps YAML pipeline, the extension must be installed in the target Azure DevOps organization.

### 1. Build Or Download The VSIX

Use the VSIX attached to the GitHub Release, or generate one locally with:

```bash
npm run build:release
```

### 2. Upload The VSIX To Marketplace

Upload the generated VSIX to your publisher, for example on:

`https://marketplace.visualstudio.com/manage/publishers/ranouf`

### 3. Install The Extension In Azure DevOps

After publication:

- if the extension is public, install it from the Marketplace
- if the extension is private, share it with your Azure DevOps organization and install it there

### 4. Use The Task In YAML

Once installed in the organization, the task becomes available in pipelines:

```yaml
steps:
  - task: PublishHtmlTab@1
    inputs:
      reportDir: "$(Build.SourcesDirectory)/playwright-report"
      tabName: "Playwright report"
```

If the extension is not installed in the target organization, Azure DevOps will not recognize `PublishHtmlTab@1`.
