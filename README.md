# PublishHtmlTab

[![PR Validation](https://github.com/ranouf/PublishHtmlTab/actions/workflows/pr-validation.yml/badge.svg)](https://github.com/ranouf/PublishHtmlTab/actions/workflows/pr-validation.yml)
[![Release VSIX](https://github.com/ranouf/PublishHtmlTab/actions/workflows/release-vsix.yml/badge.svg)](https://github.com/ranouf/PublishHtmlTab/actions/workflows/release-vsix.yml)
[![Tests](https://img.shields.io/badge/tests-jest%20%2B%20rtl-brightgreen)](https://github.com/ranouf/PublishHtmlTab/actions/workflows/pr-validation.yml)

This project extends Azure DevOps with a custom pipeline task that publishes HTML content directly inside the build results UI.

## Credits

This extension was originally created by **Jakub Rumpca**.  
This repository keeps that work alive, updates it for a modern Node runtime, and improves the publishing flow so it can handle both a single HTML file and a full directory of content.

## What The Extension Does

The extension adds a task named `Publish HTML Tab` to Azure DevOps pipelines.

When the task runs:

1. It reads the `reportDir` input.
2. If `reportDir` points to a file, it publishes that HTML file.
3. If `reportDir` points to a directory, it publishes the entire directory recursively, including files such as `.css`, `.js`, `.xml`, images, and nested subfolders.
4. It creates the attachments Azure DevOps needs so the content becomes visible from the build results page.
5. Only the `.html` / `.htm` files become selectable entry points in the UI, but their companion assets are also published so relative references can resolve correctly.
6. The web extension reads those attachments and renders the content inside an embedded tab.
7. Internal links between published HTML pages stay inside the current extension tab instead of downloading the linked file.
8. When enabled, the task also publishes a `.zip` archive of the full tab content so users can download everything from the UI.

## Inputs

### `reportDir`

Required.  
Path to:

- a single HTML file, or
- a directory whose full contents must be published recursively

### `tabName`

Optional.  
Name of the Azure DevOps tab shown in the build results page.

### `enableDownloadAll`

Optional boolean.  
When set to `true`, the task creates a `.zip` archive from the published file or directory and exposes a download button in the extension tab.

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

## Example: Downloadable Help Or FAQ Content

```yaml
steps:
  - task: PublishHtmlTab@1
    displayName: Publish help center
    inputs:
      reportDir: "$(Build.SourcesDirectory)/docs/help-center"
      tabName: "Help Center"
      enableDownloadAll: true
```

## Expected Result

After the pipeline finishes:

- Azure DevOps shows a new build results tab with the name provided in `tabName`
- if `reportDir` points to one HTML file, that page is displayed directly
- if `reportDir` points to a folder, the task publishes all files and subfolders, while the tab displays the HTML entry points from that folder
- the HTML content is rendered directly inside Azure DevOps, so users do not need to leave the build results experience
- links between published HTML pages stay inside the current extension tab
- if `enableDownloadAll: true`, the extension shows a `Download` button that downloads a `.zip` named after the tab

## How It Works Internally

The solution is composed of two parts:

- the pipeline task in `PublishHtmlReport/task.json`, which publishes the HTML content and optional download archive
- the viewer in `src/tabContent.tsx`, which loads and renders those artifacts inside Azure DevOps

The task writes a small manifest attachment plus the published content files.  
When `enableDownloadAll` is enabled, it also writes a dedicated download attachment containing the generated `.zip` archive.  
The Azure DevOps extension reads that manifest to know which HTML files to display, how to label them, and whether a full download archive should be exposed.

## CI And Release Workflows

This repository includes two GitHub Actions workflows:

- `.github/workflows/pr-validation.yml` validates pull requests targeting `main`
- `.github/workflows/release-vsix.yml` builds a release VSIX and publishes it as a GitHub Release when changes reach `main`

The PR validation workflow runs:

- Prettier check
- ESLint
- Jest + React Testing Library test suite
- web extension build
- VSIX packaging

It also posts a pull request comment with pass/fail badges for each validation step.

The test suite enforces a global coverage gate in CI:

- statements: `>= 84%`
- lines: `>= 84%`
- functions: `>= 90%`
- branches: `>= 67%`

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

To run the frontend test suite locally:

```bash
npm run test:ci
```

This command also verifies the enforced coverage thresholds used by CI.

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
      enableDownloadAll: true
```

If the extension is not installed in the target organization, Azure DevOps will not recognize `PublishHtmlTab@1`.
