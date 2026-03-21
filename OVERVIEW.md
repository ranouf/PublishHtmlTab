# PublishHtmlTab

Custom Azure DevOps extension based on the original work by **Jakub Rumpca**.

## Purpose

This extension adds a pipeline task named `PublishHtmlTab` that publishes an HTML report into the Azure DevOps build results experience.

## Inputs

- `reportDir`: path to a single HTML file or to a directory whose contents must be published recursively
- `tabName`: optional tab label shown in Azure DevOps

## YAML Usage

Single HTML file:

```yaml
steps:
  - task: PublishHtmlTab@1
    displayName: Publish accessibility report
    inputs:
      reportDir: "$(Build.SourcesDirectory)/artifacts/accessibility/report.html"
      tabName: "Accessibility report"
```

Full report folder:

```yaml
steps:
  - task: PublishHtmlTab@1
    displayName: Publish HTML tab
    inputs:
      reportDir: "$(Build.SourcesDirectory)/playwright-report"
      tabName: "Playwright report"
```

## Behavior

- if `reportDir` points to a file, that HTML file is published
- if `reportDir` points to a directory, all files and subfolders are published recursively
- only `.html` and `.htm` files are exposed as report entry points in the UI
- companion assets such as `css`, `js`, `xml`, images, and nested files are also published so report dependencies remain available

## Expected Result

After the pipeline completes, Azure DevOps shows a dedicated results tab containing the published HTML report.

- if `reportDir` points to one HTML file, that page is displayed directly
- if `reportDir` points to a report folder, the task publishes the full folder and renders the appropriate HTML entry point inside Azure DevOps
