import "./tabContent.scss"

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as SDK from "azure-devops-extension-sdk"

import { getClient } from "azure-devops-extension-api"
import { Attachment, Build, BuildRestClient } from "azure-devops-extension-api/Build"

import { ObservableObject, ObservableValue } from "azure-devops-ui/Core/Observable"
import { Observer } from "azure-devops-ui/Observer"
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs"

declare const APP_VERSION: string

const SUMMARY_ATTACHMENT_TYPE = "report-html"
const FILE_ATTACHMENT_TYPE = "report-html-file"
const LOADING_CONTENT = '<div class="wide"><p>Loading...</p></div>'
const MARKETPLACE_URL = "https://marketplace.visualstudio.com/items?itemName=ranouf.publish-html-tab"

interface ReportManifestEntry {
  attachmentName: string
  displayName: string
  fileName: string
  relativePath?: string
  isHtml?: boolean
}

interface ReportManifest {
  schemaVersion: number
  tabName: string
  files?: ReportManifestEntry[]
  reports: ReportManifestEntry[]
}

SDK.init()
SDK.ready().then(() => {
  try {
    const config = SDK.getConfiguration()
    config.onBuildChanged((build: Build) => {
      const buildAttachmentClient = new BuildAttachmentClient(build)
      buildAttachmentClient.init().then(() => {
        displayReports(buildAttachmentClient)
      }).catch(error => { throw new Error(error) })
    })
  } catch (error) {
    throw new Error(error)
  }
})

function displayReports(attachmentClient: AttachmentClient) {
  ReactDOM.render(<TaskAttachmentPanel attachmentClient={attachmentClient} />, document.getElementById("html-report-extention-container"))
}

abstract class AttachmentClient {
  protected summaryAttachments: Attachment[] = []
  protected fileAttachments: Attachment[] = []
  protected authHeaders: object = undefined
  protected manifestCache: Map<string, ReportManifest> = new Map()

  private toBase64(value: string): string {
    const bytes = new TextEncoder().encode(value)
    let binary = ""

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })

    return btoa(binary)
  }

  public getSummaryAttachments(): Attachment[] {
    return this.summaryAttachments
  }

  public getLegacyAttachments(): Attachment[] {
    return this.summaryAttachments
  }

  public hasManifestMode(): boolean {
    return this.summaryAttachments.length > 0 && this.fileAttachments.length > 0
  }

  protected getDownloadableAttachment(attachments: Attachment[], attachmentName: string): Attachment {
    const attachment = attachments.find((candidate) => candidate.name === attachmentName)
    if (!(attachment && attachment._links && attachment._links.self && attachment._links.self.href)) {
      throw new Error("Attachment " + attachmentName + " is not downloadable")
    }
    return attachment
  }

  protected async getAttachmentContent(attachments: Attachment[], attachmentName: string): Promise<string> {
    if (this.authHeaders === undefined) {
      const accessToken = await SDK.getAccessToken()
      const b64encodedAuth = this.toBase64(":" + accessToken)
      this.authHeaders = { headers: { Authorization: "Basic " + b64encodedAuth } }
    }

    const attachment = this.getDownloadableAttachment(attachments, attachmentName)
    const response = await fetch(attachment._links.self.href, this.authHeaders)
    if (!response.ok) {
      throw new Error(response.statusText)
    }

    return response.text()
  }

  public async getManifest(attachmentName: string): Promise<ReportManifest> {
    if (!this.manifestCache.has(attachmentName)) {
      const manifestText = await this.getAttachmentContent(this.summaryAttachments, attachmentName)
      this.manifestCache.set(attachmentName, JSON.parse(manifestText) as ReportManifest)
    }

    return this.manifestCache.get(attachmentName)
  }

  public async getReportContent(attachmentName: string): Promise<string> {
    const sourceAttachments = this.hasManifestMode() ? this.fileAttachments : this.summaryAttachments
    return this.getAttachmentContent(sourceAttachments, attachmentName)
  }

  public getReportUrl(attachmentName: string): string {
    const sourceAttachments = this.hasManifestMode() ? this.fileAttachments : this.summaryAttachments
    return this.getDownloadableAttachment(sourceAttachments, attachmentName)._links.self.href
  }
}

class BuildAttachmentClient extends AttachmentClient {
  private build: Build

  constructor(build: Build) {
    super()
    this.build = build
  }

  public async init() {
    const buildClient: BuildRestClient = getClient(BuildRestClient)
    this.summaryAttachments = await buildClient.getAttachments(this.build.project.id, this.build.id, SUMMARY_ATTACHMENT_TYPE)
    this.fileAttachments = await buildClient.getAttachments(this.build.project.id, this.build.id, FILE_ATTACHMENT_TYPE)
  }
}

interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps> {
  private selectedSummaryTabId: ObservableValue<string>
  private selectedReportTabId: ObservableValue<string>
  private manifestContents: ObservableObject<string>
  private reportContents: ObservableObject<string>
  private componentMounted: boolean = false

  constructor(props: TaskAttachmentPanelProps) {
    super(props)

    const summaryAttachments = props.attachmentClient.getSummaryAttachments()
    const legacyAttachments = props.attachmentClient.getLegacyAttachments()
    const initialSummaryTabId = summaryAttachments.length > 0 ? summaryAttachments[0].name : ""
    const initialLegacyTabId = legacyAttachments.length > 0 ? legacyAttachments[0].name : ""

    this.selectedSummaryTabId = new ObservableValue(initialSummaryTabId)
    this.selectedReportTabId = new ObservableValue(props.attachmentClient.hasManifestMode() ? "" : initialLegacyTabId)
    this.manifestContents = new ObservableObject()
    this.reportContents = new ObservableObject()
  }

  public componentDidMount() {
    this.componentMounted = true

    if (this.props.attachmentClient.hasManifestMode()) {
      this.props.attachmentClient.getSummaryAttachments().forEach((attachment) => {
        this.manifestContents.add(attachment.name, LOADING_CONTENT)
      })

      if (this.selectedSummaryTabId.value) {
        this.loadManifest(this.selectedSummaryTabId.value)
      }
      return
    }

    this.props.attachmentClient.getLegacyAttachments().forEach((attachment) => {
      this.reportContents.add(attachment.name, LOADING_CONTENT)
    })

    if (this.selectedReportTabId.value) {
      this.ensureReportContentLoaded(this.selectedReportTabId.value)
    }
  }

  public componentWillUnmount() {
    this.componentMounted = false
  }

  public escapeHTML(str: string) {
    return str.replace(/[&<>'"]/g, tag => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      "\"": "&quot;"
    }[tag] || tag))
  }

  private formatErrorContent(message: string): string {
    return `<div class="wide"><p>${this.escapeHTML(message)}</p></div>`
  }

  public render() {
    if (this.props.attachmentClient.hasManifestMode()) {
      return this.renderManifestMode()
    }

    return this.renderLegacyMode()
  }

  private renderLegacyMode() {
    const attachments = this.props.attachmentClient.getLegacyAttachments()
    if (attachments.length === 0) {
      return null
    }

    const tabs = attachments.map((attachment) => (
      <Tab name={this.getLegacyTabName(attachment.name)} id={attachment.name} key={attachment.name} />
    ))

    return (
      <div className="flex-column">
        <div className="report-tab-header">
          <TabBar onSelectedTabChanged={this.onLegacyTabChanged} selectedTabId={this.selectedReportTabId} tabSize={TabSize.Tall}>
            {tabs}
          </TabBar>
          <a
            className="report-tab-version"
            href={MARKETPLACE_URL}
            rel="noopener noreferrer"
            target="_blank"
            title="Open Publish HTML Tab on Visual Studio Marketplace"
          >
            v{APP_VERSION}
          </a>
        </div>
        <Observer selectedReportTabId={this.selectedReportTabId} reportContents={this.reportContents}>
          {(props: { selectedReportTabId: string }) => {
            return <span dangerouslySetInnerHTML={{ __html: this.reportContents.get(props.selectedReportTabId) || LOADING_CONTENT }} />
          }}
        </Observer>
      </div>
    )
  }

  private renderManifestMode() {
    const summaryAttachments = this.props.attachmentClient.getSummaryAttachments()
    if (summaryAttachments.length === 0) {
      return null
    }

    const summaryTabs = summaryAttachments.map((attachment) => {
      const manifestText = this.manifestContents.get(attachment.name)
      const tabName = manifestText && manifestText !== LOADING_CONTENT
        ? (JSON.parse(manifestText) as ReportManifest).tabName
        : this.getLegacyTabName(attachment.name)

      return <Tab name={tabName} id={attachment.name} key={attachment.name} />
    })

    return (
      <div className="flex-column">
        <div className="report-tab-header">
          {summaryAttachments.length > 1 ?
            <TabBar onSelectedTabChanged={this.onSummaryTabChanged} selectedTabId={this.selectedSummaryTabId} tabSize={TabSize.Tall}>
              {summaryTabs}
            </TabBar>
          : <div />}
          <a
            className="report-tab-version"
            href={MARKETPLACE_URL}
            rel="noopener noreferrer"
            target="_blank"
            title="Open Publish HTML Tab on Visual Studio Marketplace"
          >
            v{APP_VERSION}
          </a>
        </div>
        <Observer selectedSummaryTabId={this.selectedSummaryTabId} manifestContents={this.manifestContents} selectedReportTabId={this.selectedReportTabId} reportContents={this.reportContents}>
          {(props: { selectedSummaryTabId: string, selectedReportTabId: string }) => {
            const manifestText = this.manifestContents.get(props.selectedSummaryTabId)
            if (!manifestText || manifestText === LOADING_CONTENT) {
              return <span dangerouslySetInnerHTML={{ __html: LOADING_CONTENT }} />
            }

            const manifest = JSON.parse(manifestText) as ReportManifest
            const reportTabs = manifest.reports.map((report) => (
              <Tab name={report.displayName} id={report.attachmentName} key={report.attachmentName} />
            ))

            return (
              <div className="flex-column">
                {manifest.reports.length > 1 ?
                  <TabBar onSelectedTabChanged={this.onReportTabChanged} selectedTabId={this.selectedReportTabId} tabSize={TabSize.Tall}>
                    {reportTabs}
                  </TabBar>
                : null}
                <span dangerouslySetInnerHTML={{ __html: this.reportContents.get(props.selectedReportTabId) || LOADING_CONTENT }} />
              </div>
            )
          }}
        </Observer>
      </div>
    )
  }

  private async loadManifest(summaryAttachmentName: string) {
    const manifest = await this.props.attachmentClient.getManifest(summaryAttachmentName)
    if (!this.componentMounted) {
      return
    }

    this.manifestContents.set(summaryAttachmentName, JSON.stringify(manifest))

    manifest.reports.forEach((report) => {
      if (this.reportContents.get(report.attachmentName) === undefined) {
        this.reportContents.add(report.attachmentName, LOADING_CONTENT)
      }
    })

    const preferredReport = this.getPreferredReport(manifest)
    if (preferredReport) {
      this.selectedReportTabId.value = preferredReport.attachmentName
      this.ensureReportContentLoaded(preferredReport.attachmentName)
    }
  }

  private wrapHtml(content: string): string {
    return '<iframe class="wide flex-row flex-center" srcdoc="' + this.escapeHTML(content) + '"></iframe>'
  }

  private async ensureReportContentLoaded(attachmentName: string) {
    if (!attachmentName) {
      return
    }

    if (this.reportContents.get(attachmentName) === LOADING_CONTENT) {
      try {
        const reportHtml = await this.getReportFrameContent(attachmentName)
        if (this.componentMounted && this.reportContents.get(attachmentName) === LOADING_CONTENT) {
          this.reportContents.set(attachmentName, reportHtml)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (this.componentMounted && this.reportContents.get(attachmentName) === LOADING_CONTENT) {
          this.reportContents.set(attachmentName, this.formatErrorContent(message))
        }
      }
    }
  }

  private async getReportFrameContent(attachmentName: string): Promise<string> {
    const manifest = this.getSelectedManifest()
    if (!manifest) {
      const html = await this.props.attachmentClient.getReportContent(attachmentName)
      return this.wrapHtml(html)
    }

    const reportEntry = manifest.files?.find((entry) => entry.attachmentName === attachmentName)
      || manifest.reports.find((entry) => entry.attachmentName === attachmentName)

    if (!reportEntry) {
      throw new Error("Report " + attachmentName + " was not found in the manifest")
    }

    const html = await this.props.attachmentClient.getReportContent(attachmentName)
    const rewrittenHtml = await this.rewriteReportHtml(html, reportEntry, manifest)
    return this.wrapHtml(rewrittenHtml)
  }

  private getSelectedManifest(): ReportManifest | undefined {
    const summaryAttachmentName = this.selectedSummaryTabId.value
    if (!summaryAttachmentName) {
      return undefined
    }

    const manifestText = this.manifestContents.get(summaryAttachmentName)
    if (!manifestText || manifestText === LOADING_CONTENT) {
      return undefined
    }

    return JSON.parse(manifestText) as ReportManifest
  }

  private async rewriteReportHtml(html: string, reportEntry: ReportManifestEntry, manifest: ReportManifest): Promise<string> {
    const parser = new DOMParser()
    const document = parser.parseFromString(html, "text/html")
    const assetMap = this.buildAssetMap(manifest)
    const reportPath = this.normalizePath(this.getReportPath(reportEntry))
    const reportDirectory = reportPath.includes("/") ? reportPath.substring(0, reportPath.lastIndexOf("/") + 1) : ""

    await this.inlineLinkedAssets(document, reportDirectory, assetMap)
    this.rewriteDocumentUrls(document, "a", "href", reportDirectory, assetMap)
    this.rewriteDocumentUrls(document, "img", "src", reportDirectory, assetMap)
    this.rewriteDocumentUrls(document, "iframe", "src", reportDirectory, assetMap)
    this.rewriteDocumentUrls(document, "source", "src", reportDirectory, assetMap)
    this.rewriteInlineStyles(document, reportDirectory, assetMap)

    return document.documentElement.outerHTML
  }

  private async inlineLinkedAssets(document: Document, reportDirectory: string, assetMap: Map<string, string>) {
    const stylesheetLinks = Array.from(document.querySelectorAll("link[rel='stylesheet'][href]"))
    for (const linkElement of stylesheetLinks) {
      const href = linkElement.getAttribute("href")
      if (!href || this.isExternalUrl(href)) {
        continue
      }

      const linkedEntry = this.findManifestEntryForRelativeUrl(reportDirectory, href)
      if (!linkedEntry) {
        continue
      }

      const stylesheetContent = await this.props.attachmentClient.getReportContent(linkedEntry.attachmentName)
      const styleElement = document.createElement("style")
      styleElement.textContent = this.rewriteCssUrls(stylesheetContent, this.getBaseDirectory(linkedEntry), assetMap)
      linkElement.replaceWith(styleElement)
    }

    const scriptLinks = Array.from(document.querySelectorAll("script[src]"))
    for (const scriptElement of scriptLinks) {
      const src = scriptElement.getAttribute("src")
      if (!src || this.isExternalUrl(src)) {
        continue
      }

      const linkedEntry = this.findManifestEntryForRelativeUrl(reportDirectory, src)
      if (!linkedEntry) {
        continue
      }

      const scriptContent = await this.props.attachmentClient.getReportContent(linkedEntry.attachmentName)
      const inlineScriptElement = document.createElement("script")
      inlineScriptElement.textContent = scriptContent
      scriptElement.replaceWith(inlineScriptElement)
    }
  }

  private rewriteDocumentUrls(document: Document, selector: string, attributeName: string, reportDirectory: string, assetMap: Map<string, string>) {
    document.querySelectorAll(selector).forEach((element) => {
      const currentValue = element.getAttribute(attributeName)
      if (!currentValue || this.isExternalUrl(currentValue)) {
        return
      }

      const resolvedPath = this.resolveRelativePath(reportDirectory, currentValue)
      const resolvedUrl = assetMap.get(resolvedPath)
      if (resolvedUrl) {
        element.setAttribute(attributeName, resolvedUrl)
      }
    })
  }

  private rewriteInlineStyles(document: Document, reportDirectory: string, assetMap: Map<string, string>) {
    document.querySelectorAll("style").forEach((styleElement) => {
      if (!styleElement.textContent) {
        return
      }

      styleElement.textContent = this.rewriteCssUrls(styleElement.textContent, reportDirectory, assetMap)
    })
  }

  private buildAssetMap(manifest: ReportManifest): Map<string, string> {
    const assetMap = new Map<string, string>()
    const files = manifest.files || manifest.reports

    files.forEach((entry) => {
      const relativePath = this.normalizePath(this.getReportPath(entry))
      try {
        assetMap.set(relativePath, this.props.attachmentClient.getReportUrl(entry.attachmentName))
      } catch {
        return
      }
    })

    return assetMap
  }

  private findManifestEntryForRelativeUrl(reportDirectory: string, relativeUrl: string): ReportManifestEntry | undefined {
    const manifest = this.getSelectedManifest()
    if (!manifest) {
      return undefined
    }

    const resolvedPath = this.resolveRelativePath(reportDirectory, relativeUrl)
    const files = manifest.files || manifest.reports
    return files.find((entry) => this.normalizePath(this.getReportPath(entry)) === resolvedPath)
  }

  private getBaseDirectory(reportEntry: ReportManifestEntry): string {
    const reportPath = this.normalizePath(this.getReportPath(reportEntry))
    return reportPath.includes("/") ? reportPath.substring(0, reportPath.lastIndexOf("/") + 1) : ""
  }

  private rewriteCssUrls(cssText: string, reportDirectory: string, assetMap: Map<string, string>): string {
    return cssText.replace(/url\((['"]?)([^)'"]+)\1\)/g, (_match, quote, assetUrl) => {
      if (!assetUrl || this.isExternalUrl(assetUrl)) {
        return `url(${quote}${assetUrl}${quote})`
      }

      const resolvedPath = this.resolveRelativePath(reportDirectory, assetUrl)
      const resolvedUrl = assetMap.get(resolvedPath)
      if (!resolvedUrl) {
        return `url(${quote}${assetUrl}${quote})`
      }

      return `url(${quote}${resolvedUrl}${quote})`
    })
  }

  private resolveRelativePath(reportDirectory: string, relativeUrl: string): string {
    const [pathPart] = relativeUrl.split(/[?#]/, 1)
    const baseUrl = new URL(reportDirectory || ".", "https://publish-html-tab.local/")
    const resolvedUrl = new URL(pathPart, baseUrl)
    return this.normalizePath(resolvedUrl.pathname.replace(/^\/+/, ""))
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/").replace(/^\.\//, "")
  }

  private isExternalUrl(url: string): boolean {
    return url.startsWith("#")
      || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)
      || url.startsWith("//")
  }

  private getPreferredReport(manifest: ReportManifest): ReportManifestEntry | undefined {
    const reports = manifest.reports
    if (reports.length === 0) {
      return undefined
    }

    const indexReports = reports
      .filter((report) => this.isIndexReport(report))
      .sort((left, right) => this.getReportPath(left).length - this.getReportPath(right).length)

    return indexReports[0] || reports[0]
  }

  private isIndexReport(report: ReportManifestEntry): boolean {
    const normalizedPath = this.getReportPath(report).toLowerCase()
    return normalizedPath.endsWith("/index.html")
      || normalizedPath.endsWith("/index.htm")
      || normalizedPath === "index.html"
      || normalizedPath === "index.htm"
  }

  private getReportPath(report: ReportManifestEntry): string {
    return report.relativePath || report.displayName || report.fileName
  }

  private getLegacyTabName(attachmentName: string): string {
    return attachmentName.split(".")[0]
  }

  private onSummaryTabChanged = (newTabId: string) => {
    this.selectedSummaryTabId.value = newTabId
    this.loadManifest(newTabId)
  }

  private onReportTabChanged = (newTabId: string) => {
    this.selectedReportTabId.value = newTabId
    this.ensureReportContentLoaded(newTabId)
  }

  private onLegacyTabChanged = (newTabId: string) => {
    this.selectedReportTabId.value = newTabId
    this.ensureReportContentLoaded(newTabId)
  }
}
