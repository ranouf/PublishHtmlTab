import "./tabContent.scss"

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as SDK from "azure-devops-extension-sdk"

import { getClient } from "azure-devops-extension-api"
import { Attachment, Build, BuildRestClient } from "azure-devops-extension-api/Build"

import { ObservableObject, ObservableValue } from "azure-devops-ui/Core/Observable"
import { Observer } from "azure-devops-ui/Observer"
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs"

const SUMMARY_ATTACHMENT_TYPE = "report-html"
const FILE_ATTACHMENT_TYPE = "report-html-file"
const LOADING_CONTENT = '<div class="wide"><p>Loading...</p></div>'

interface ReportManifestEntry {
  attachmentName: string
  displayName: string
  fileName: string
}

interface ReportManifest {
  schemaVersion: number
  tabName: string
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
      const b64encodedAuth = Buffer.from(":" + accessToken).toString("base64")
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
      <Tab name={this.getLegacyTabName(attachment.name)} id={attachment.name} key={attachment.name} url={attachment._links.self.href} />
    ))

    return (
      <div className="flex-column">
        <TabBar onSelectedTabChanged={this.onLegacyTabChanged} selectedTabId={this.selectedReportTabId} tabSize={TabSize.Tall}>
          {tabs}
        </TabBar>
        <Observer selectedReportTabId={this.selectedReportTabId} reportContents={this.reportContents}>
          {(props: { selectedReportTabId: string }) => {
            if (this.reportContents.get(props.selectedReportTabId) === LOADING_CONTENT) {
              this.reportContents.set(props.selectedReportTabId, this.wrapHtmlFromUrl(this.props.attachmentClient.getReportUrl(props.selectedReportTabId)))
            }

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

      return <Tab name={tabName} id={attachment.name} key={attachment.name} url={attachment._links.self.href} />
    })

    return (
      <div className="flex-column">
        {summaryAttachments.length > 1 ?
          <TabBar onSelectedTabChanged={this.onSummaryTabChanged} selectedTabId={this.selectedSummaryTabId} tabSize={TabSize.Tall}>
            {summaryTabs}
          </TabBar>
        : null}
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

            if (props.selectedReportTabId && this.reportContents.get(props.selectedReportTabId) === LOADING_CONTENT) {
              this.reportContents.set(props.selectedReportTabId, this.wrapHtmlFromUrl(this.props.attachmentClient.getReportUrl(props.selectedReportTabId)))
            }

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
    this.manifestContents.set(summaryAttachmentName, JSON.stringify(manifest))

    manifest.reports.forEach((report) => {
      if (this.reportContents.get(report.attachmentName) === undefined) {
        this.reportContents.add(report.attachmentName, LOADING_CONTENT)
      }
    })

    if (manifest.reports.length > 0) {
      this.selectedReportTabId.value = manifest.reports[0].attachmentName
    }
  }

  private wrapHtml(content: string): string {
    return '<iframe class="wide flex-row flex-center" srcdoc="' + this.escapeHTML(content) + '"></iframe>'
  }

  private wrapHtmlFromUrl(reportUrl: string): string {
    return '<iframe class="wide flex-row flex-center" src="' + this.escapeHTML(reportUrl) + '"></iframe>'
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
  }

  private onLegacyTabChanged = (newTabId: string) => {
    this.selectedReportTabId.value = newTabId
  }
}
