# PublishHtmlTab

Custom Azure DevOps extension based on the original work by **Jakub Rumpca**.

## Purpose

This extension adds a pipeline task named `PublishHtmlTab` that publishes HTML content into the Azure DevOps build results experience.

It works for classic HTML reports, but also for help pages, FAQ content, internal documentation, or any small static HTML site you want to expose directly in a pipeline result tab.

## Inputs

- `reportDir`: path to a single HTML file or to a directory whose contents must be published recursively
- `tabName`: optional tab label shown in Azure DevOps
- `enableDownloadAll`: optional boolean that adds a `Download` button for a `.zip` archive of the full tab content

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

Downloadable help content:

```yaml
steps:
  - task: PublishHtmlTab@1
    displayName: Publish help center
    inputs:
      reportDir: "$(Build.SourcesDirectory)/docs/help-center"
      tabName: "Help Center"
      enableDownloadAll: true
```

## Behavior

- if `reportDir` points to a file, that HTML file is published
- if `reportDir` points to a directory, all files and subfolders are published recursively
- only `.html` and `.htm` files are exposed as selectable entry points in the UI
- companion assets such as `css`, `js`, `xml`, images, and nested files are also published so dependencies remain available
- links between published HTML pages stay inside the current extension tab
- when `enableDownloadAll` is enabled, the extension exposes a `Download` button that retrieves a `.zip` archive named after the tab

## Expected Result

After the pipeline completes, Azure DevOps shows a dedicated results tab containing the published HTML content.

- if `reportDir` points to one HTML file, that page is displayed directly
- if `reportDir` points to a folder, the task publishes the full folder and renders the appropriate HTML entry point inside Azure DevOps
- if `enableDownloadAll` is enabled, users can download the full published content from the same tab
