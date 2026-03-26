import './tabContent.scss';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { getClient } from 'azure-devops-extension-api';
import {
  Attachment,
  Build,
  BuildRestClient,
} from 'azure-devops-extension-api/Build';
import {
  CommonServiceIds,
  IHostNavigationService,
} from 'azure-devops-extension-api/Common/CommonServices';

import {
  ObservableObject,
  ObservableValue,
} from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';

declare const APP_VERSION: string;

const SUMMARY_ATTACHMENT_TYPE = 'report-html';
const FILE_ATTACHMENT_TYPE = 'report-html-file';
const DOWNLOAD_ATTACHMENT_TYPE = 'report-html-download';
const LOADING_CONTENT = '<div class="wide"><p>Loading...</p></div>';
const MARKETPLACE_URL =
  'https://marketplace.visualstudio.com/items?itemName=ranouf.publish-html-tab';
const INTERNAL_REPORT_NAVIGATION_MESSAGE = 'publish-html-tab:navigate';
const INTERNAL_REPORT_HEIGHT_MESSAGE = 'publish-html-tab:height';
const INTERNAL_REPORT_LINK_ATTRIBUTE = 'data-publish-html-tab-report';
const INTERNAL_REPORT_HASH_KEY = 'report';
const HOST_REPORT_QUERY_KEY = 'phtReport';
const HOST_SUMMARY_QUERY_KEY = 'phtSummary';

interface ReportManifestEntry {
  attachmentName: string;
  displayName: string;
  fileName: string;
  relativePath?: string;
  isHtml?: boolean;
}

interface ReportManifest {
  schemaVersion: number;
  tabName: string;
  files?: ReportManifestEntry[];
  reports: ReportManifestEntry[];
  downloadAll?: {
    attachmentName: string;
    fileName: string;
  };
}

SDK.init();
SDK.ready().then(() => {
  try {
    const config = SDK.getConfiguration();
    config.onBuildChanged((build: Build) => {
      const buildAttachmentClient = new BuildAttachmentClient(build);
      buildAttachmentClient
        .init()
        .then(() => {
          displayReports(buildAttachmentClient);
        })
        .catch((error) => {
          throw new Error(error);
        });
    });
  } catch (error) {
    throw new Error(error);
  }
});

function displayReports(attachmentClient: AttachmentClient) {
  ReactDOM.render(
    <TaskAttachmentPanel attachmentClient={attachmentClient} />,
    document.getElementById('html-report-extention-container'),
  );
}

abstract class AttachmentClient {
  protected summaryAttachments: Attachment[] = [];
  protected fileAttachments: Attachment[] = [];
  protected downloadAttachments: Attachment[] = [];
  protected authHeaders: object = undefined;
  protected manifestCache: Map<string, ReportManifest> = new Map();

  private toBase64(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  public getSummaryAttachments(): Attachment[] {
    return this.summaryAttachments;
  }

  public getLegacyAttachments(): Attachment[] {
    return this.summaryAttachments;
  }

  public hasManifestMode(): boolean {
    return (
      this.summaryAttachments.length > 0 && this.fileAttachments.length > 0
    );
  }

  protected getDownloadableAttachment(
    attachments: Attachment[],
    attachmentName: string,
  ): Attachment {
    const attachment = attachments.find(
      (candidate) => candidate.name === attachmentName,
    );
    if (
      !(
        attachment &&
        attachment._links &&
        attachment._links.self &&
        attachment._links.self.href
      )
    ) {
      throw new Error('Attachment ' + attachmentName + ' is not downloadable');
    }
    return attachment;
  }

  protected async getAttachmentResponse(
    attachments: Attachment[],
    attachmentName: string,
  ): Promise<Response> {
    if (this.authHeaders === undefined) {
      const accessToken = await SDK.getAccessToken();
      const b64encodedAuth = this.toBase64(':' + accessToken);
      this.authHeaders = {
        headers: { Authorization: 'Basic ' + b64encodedAuth },
      };
    }

    const attachment = this.getDownloadableAttachment(
      attachments,
      attachmentName,
    );
    const response = await fetch(attachment._links.self.href, this.authHeaders);
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return response;
  }

  protected async getAttachmentContent(
    attachments: Attachment[],
    attachmentName: string,
  ): Promise<string> {
    const response = await this.getAttachmentResponse(
      attachments,
      attachmentName,
    );
    return response.text();
  }

  public async getManifest(attachmentName: string): Promise<ReportManifest> {
    if (!this.manifestCache.has(attachmentName)) {
      const manifestText = await this.getAttachmentContent(
        this.summaryAttachments,
        attachmentName,
      );
      this.manifestCache.set(
        attachmentName,
        JSON.parse(manifestText) as ReportManifest,
      );
    }

    return this.manifestCache.get(attachmentName);
  }

  public async getReportContent(attachmentName: string): Promise<string> {
    const sourceAttachments = this.hasManifestMode()
      ? this.fileAttachments
      : this.summaryAttachments;
    return this.getAttachmentContent(sourceAttachments, attachmentName);
  }

  public getReportUrl(attachmentName: string): string {
    const sourceAttachments = this.hasManifestMode()
      ? this.fileAttachments
      : this.summaryAttachments;
    return this.getDownloadableAttachment(sourceAttachments, attachmentName)
      ._links.self.href;
  }

  public async downloadReportArchive(
    attachmentName: string,
    fileName: string,
  ): Promise<void> {
    const response = await this.getAttachmentResponse(
      this.downloadAttachments,
      attachmentName,
    );
    const archiveBlob = await response.blob();
    const downloadUrl = URL.createObjectURL(archiveBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
  }
}

class BuildAttachmentClient extends AttachmentClient {
  private build: Build;

  constructor(build: Build) {
    super();
    this.build = build;
  }

  public async init() {
    const buildClient: BuildRestClient = getClient(BuildRestClient);
    this.summaryAttachments = await buildClient.getAttachments(
      this.build.project.id,
      this.build.id,
      SUMMARY_ATTACHMENT_TYPE,
    );
    this.fileAttachments = await buildClient.getAttachments(
      this.build.project.id,
      this.build.id,
      FILE_ATTACHMENT_TYPE,
    );
    this.downloadAttachments = await buildClient.getAttachments(
      this.build.project.id,
      this.build.id,
      DOWNLOAD_ATTACHMENT_TYPE,
    );
  }
}

interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient;
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="report-tab-icon"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M12 3V15M12 15L7 10M12 15L17 10M5 21H19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps> {
  private selectedSummaryTabId: ObservableValue<string>;
  private selectedReportTabId: ObservableValue<string>;
  private manifestContents: ObservableObject<string>;
  private reportContents: ObservableObject<string>;
  private linkedAssetContentCache: Map<string, Promise<string>>;
  private scriptBlobUrlCache: Map<string, Promise<string>>;
  private createdObjectUrls: Set<string>;
  private hostNavigationServicePromise?: Promise<IHostNavigationService>;
  private componentMounted: boolean = false;

  constructor(props: TaskAttachmentPanelProps) {
    super(props);

    const summaryAttachments = props.attachmentClient.getSummaryAttachments();
    const legacyAttachments = props.attachmentClient.getLegacyAttachments();
    const initialSummaryTabId =
      summaryAttachments.length > 0 ? summaryAttachments[0].name : '';
    const initialLegacyTabId =
      legacyAttachments.length > 0 ? legacyAttachments[0].name : '';

    this.selectedSummaryTabId = new ObservableValue(initialSummaryTabId);
    this.selectedReportTabId = new ObservableValue(
      props.attachmentClient.hasManifestMode() ? '' : initialLegacyTabId,
    );
    this.manifestContents = new ObservableObject();
    this.reportContents = new ObservableObject();
    this.linkedAssetContentCache = new Map();
    this.scriptBlobUrlCache = new Map();
    this.createdObjectUrls = new Set();
  }

  public componentDidMount() {
    this.componentMounted = true;
    window.addEventListener('message', this.onEmbeddedReportMessage);
    window.addEventListener('hashchange', this.onLocationHashChanged);
    window.addEventListener('popstate', this.onHistoryChanged);

    if (this.props.attachmentClient.hasManifestMode()) {
      this.props.attachmentClient
        .getSummaryAttachments()
        .forEach((attachment) => {
          this.manifestContents.add(attachment.name, LOADING_CONTENT);
        });

      void this.initializeManifestSelection();
      return;
    }

    this.props.attachmentClient.getLegacyAttachments().forEach((attachment) => {
      this.reportContents.add(attachment.name, LOADING_CONTENT);
    });

    if (!this.navigateToHashedReport()) {
      this.syncLocationHash(this.selectedReportTabId.value);
    }

    if (this.selectedReportTabId.value) {
      this.ensureReportContentLoaded(this.selectedReportTabId.value);
    }
  }

  public componentWillUnmount() {
    this.componentMounted = false;
    window.removeEventListener('message', this.onEmbeddedReportMessage);
    window.removeEventListener('hashchange', this.onLocationHashChanged);
    window.removeEventListener('popstate', this.onHistoryChanged);
    this.createdObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.createdObjectUrls.clear();
  }

  public escapeHTML(str: string) {
    return str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[tag] || tag,
    );
  }

  private formatErrorContent(message: string): string {
    return `<div class="wide"><p>${this.escapeHTML(message)}</p></div>`;
  }

  private isLoadingContent(content?: string): boolean {
    return !content || content === LOADING_CONTENT;
  }

  private renderLoadingState(message?: string) {
    return (
      <div className="report-loading-state">
        <div
          aria-hidden="true"
          className="report-loading-spinner"
        />
        <div className="report-loading-text">
          {message || 'Loading report content...'}
        </div>
      </div>
    );
  }

  private renderReportHtml(content?: string) {
    if (this.isLoadingContent(content)) {
      return this.renderLoadingState();
    }

    return (
      <span
        dangerouslySetInnerHTML={{
          __html: content,
        }}
      />
    );
  }

  public render() {
    if (this.props.attachmentClient.hasManifestMode()) {
      return this.renderManifestMode();
    }

    return this.renderLegacyMode();
  }

  private renderLegacyMode() {
    const attachments = this.props.attachmentClient.getLegacyAttachments();
    if (attachments.length === 0) {
      return null;
    }

    const tabs = attachments.map((attachment) => (
      <Tab
        name={this.getLegacyTabName(attachment.name)}
        id={attachment.name}
        key={attachment.name}
      />
    ));

    return (
      <div className="flex-column">
        <div className="report-tab-header">
          {attachments.length > 1 ? (
            <TabBar
              onSelectedTabChanged={this.onLegacyTabChanged}
              selectedTabId={this.selectedReportTabId}
              tabSize={TabSize.Tall}
            >
              {tabs}
            </TabBar>
          ) : (
            this.renderSingleTabTitle(
              this.getLegacyTabName(attachments[0].name),
            )
          )}
          {this.renderHeaderActions()}
        </div>
        <Observer
          selectedReportTabId={this.selectedReportTabId}
          reportContents={this.reportContents}
        >
          {(props: { selectedReportTabId: string }) => {
            return this.renderReportHtml(
              this.reportContents.get(props.selectedReportTabId),
            );
          }}
        </Observer>
      </div>
    );
  }

  private renderManifestMode() {
    const summaryAttachments =
      this.props.attachmentClient.getSummaryAttachments();
    if (summaryAttachments.length === 0) {
      return null;
    }

    return (
      <div className="flex-column">
        <div className="report-tab-header">
          {summaryAttachments.length > 1 ? (
            <Observer
              selectedSummaryTabId={this.selectedSummaryTabId}
              manifestContents={this.manifestContents}
            >
              {(props: { selectedSummaryTabId: string }) => {
                const summaryTabs = summaryAttachments.map((attachment) => {
                  const tabManifestText = this.manifestContents.get(
                    attachment.name,
                  );
                  const tabManifest =
                    tabManifestText && tabManifestText !== LOADING_CONTENT
                      ? (JSON.parse(tabManifestText) as ReportManifest)
                      : undefined;
                  const tabName = tabManifest?.tabName
                    ? tabManifest.tabName
                    : this.getLegacyTabName(attachment.name);
                  const isSelected =
                    attachment.name === props.selectedSummaryTabId;
                  const renderBadge =
                    isSelected && tabManifest?.downloadAll
                      ? () => this.renderDownloadButton(tabManifest, true)
                      : undefined;

                  return (
                    <Tab
                      id={attachment.name}
                      key={attachment.name}
                      name={tabName}
                      renderBadge={renderBadge}
                    />
                  );
                });

                return (
                  <div className="report-tab-multi-title-group">
                    <TabBar
                      onSelectedTabChanged={this.onSummaryTabChanged}
                      selectedTabId={this.selectedSummaryTabId}
                      tabSize={TabSize.Tall}
                    >
                      {summaryTabs}
                    </TabBar>
                  </div>
                );
              }}
            </Observer>
          ) : (
            <Observer
              selectedSummaryTabId={this.selectedSummaryTabId}
              manifestContents={this.manifestContents}
            >
              {(props: { selectedSummaryTabId: string }) => {
                const manifestText = this.manifestContents.get(
                  props.selectedSummaryTabId,
                );
                const manifest =
                  manifestText && manifestText !== LOADING_CONTENT
                    ? (JSON.parse(manifestText) as ReportManifest)
                    : undefined;
                const fallbackAttachment = summaryAttachments[0];
                const title = manifest?.tabName
                  ? manifest.tabName
                  : this.getLegacyTabName(fallbackAttachment.name);

                return this.renderSingleTabTitle(title, manifest);
              }}
            </Observer>
          )}
          {this.renderHeaderActions()}
        </div>
        <Observer
          selectedSummaryTabId={this.selectedSummaryTabId}
          manifestContents={this.manifestContents}
          selectedReportTabId={this.selectedReportTabId}
          reportContents={this.reportContents}
        >
          {(props: {
            selectedSummaryTabId: string;
            selectedReportTabId: string;
          }) => {
            const manifestText = this.manifestContents.get(
              props.selectedSummaryTabId,
            );
            if (!manifestText || manifestText === LOADING_CONTENT) {
              return this.renderLoadingState('Loading tab content...');
            }

            const manifest = JSON.parse(manifestText) as ReportManifest;
            const reportTabs = manifest.reports.map((report) => (
              <Tab
                name={report.displayName}
                id={report.attachmentName}
                key={report.attachmentName}
              />
            ));

            return (
              <div className="flex-column">
                {manifest.reports.length > 1 ? (
                  <TabBar
                    onSelectedTabChanged={this.onReportTabChanged}
                    selectedTabId={this.selectedReportTabId}
                    tabSize={TabSize.Tall}
                  >
                    {reportTabs}
                  </TabBar>
                ) : null}
                {this.renderReportHtml(
                  this.reportContents.get(props.selectedReportTabId),
                )}
              </div>
            );
          }}
        </Observer>
      </div>
    );
  }

  private renderSingleTabTitle(title: string, manifest?: ReportManifest) {
    return (
      <div className="report-tab-title-group">
        <button
          className="report-tab-title-button"
          onClick={() => this.navigateToFirstReport(true)}
          title="Return to the first page"
          type="button"
        >
          <span className="report-tab-title">{title}</span>
        </button>
        {this.renderDownloadButton(manifest)}
      </div>
    );
  }

  private renderDownloadButton(
    manifest?: ReportManifest,
    stopTabSelection?: boolean,
  ) {
    const downloadAll = manifest?.downloadAll;
    if (!downloadAll) {
      return null;
    }

    const downloadTooltip = `Download the full tab content archive (${downloadAll.fileName})`;

    return (
      <button
        aria-label="Download full tab content archive"
        className={`report-tab-action-button${
          stopTabSelection ? ' report-tab-action-button--in-tab' : ''
        }`}
        onClick={(event) => {
          if (stopTabSelection) {
            event.preventDefault();
            event.stopPropagation();
          }
          this.onDownloadAll();
        }}
        onMouseDown={(event) => {
          if (stopTabSelection) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        title={downloadTooltip}
        type="button"
      >
        <DownloadIcon />
      </button>
    );
  }

  private renderHeaderActions() {
    return (
      <div className="report-tab-actions">
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
    );
  }

  private async loadManifest(summaryAttachmentName: string) {
    const manifest = await this.props.attachmentClient.getManifest(
      summaryAttachmentName,
    );
    if (!this.componentMounted) {
      return;
    }

    this.manifestContents.set(summaryAttachmentName, JSON.stringify(manifest));

    manifest.reports.forEach((report) => {
      if (this.reportContents.get(report.attachmentName) === undefined) {
        this.reportContents.add(report.attachmentName, LOADING_CONTENT);
      }
    });

    if (this.navigateToHashedReport(manifest)) {
      return;
    }

    const queryReportAttachment = await this.getHostQueryParam(
      HOST_REPORT_QUERY_KEY,
    );
    const queryReportEntry = (manifest.files || manifest.reports).find(
      (report) =>
        report.attachmentName === queryReportAttachment && report.isHtml,
    );
    if (queryReportEntry) {
      if (this.reportContents.get(queryReportEntry.attachmentName) === undefined) {
        this.reportContents.add(queryReportEntry.attachmentName, LOADING_CONTENT);
      }
      this.selectedReportTabId.value = queryReportEntry.attachmentName;
      this.syncLocationHash(queryReportEntry.attachmentName);
      this.ensureReportContentLoaded(queryReportEntry.attachmentName);
      return;
    }

    const preferredReport = this.getPreferredReport(manifest);
    if (preferredReport) {
      this.selectedReportTabId.value = preferredReport.attachmentName;
      this.syncLocationHash(preferredReport.attachmentName);
      this.ensureReportContentLoaded(preferredReport.attachmentName);
    }
  }

  private wrapHtml(content: string, attachmentName: string): string {
    return (
      '<iframe class="publish-html-tab-report-frame" style="visibility:hidden;" scrolling="no" data-publish-html-tab-report-frame="' +
      this.escapeHTML(attachmentName) +
      '" srcdoc="' +
      this.escapeHTML(content) +
      '"></iframe>'
    );
  }

  private async ensureReportContentLoaded(attachmentName: string) {
    if (!attachmentName) {
      return;
    }

    if (this.reportContents.get(attachmentName) === LOADING_CONTENT) {
      try {
        const reportHtml = await this.getReportFrameContent(attachmentName);
        if (
          this.componentMounted &&
          this.reportContents.get(attachmentName) === LOADING_CONTENT
        ) {
          this.reportContents.set(attachmentName, reportHtml);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          this.componentMounted &&
          this.reportContents.get(attachmentName) === LOADING_CONTENT
        ) {
          this.reportContents.set(
            attachmentName,
            this.formatErrorContent(message),
          );
        }
      }
    }
  }

  private async getReportFrameContent(attachmentName: string): Promise<string> {
    const manifest = this.getSelectedManifest();
    if (!manifest) {
      const html =
        await this.props.attachmentClient.getReportContent(attachmentName);
      return this.wrapHtml(html, attachmentName);
    }

    const reportEntry =
      manifest.files?.find(
        (entry) => entry.attachmentName === attachmentName,
      ) ||
      manifest.reports.find((entry) => entry.attachmentName === attachmentName);

    if (!reportEntry) {
      throw new Error(
        'Report ' + attachmentName + ' was not found in the manifest',
      );
    }

    const html =
      await this.props.attachmentClient.getReportContent(attachmentName);
    const rewrittenHtml = await this.rewriteReportHtml(
      html,
      reportEntry,
      manifest,
    );
    return this.wrapHtml(rewrittenHtml, attachmentName);
  }

  private getSelectedManifest(): ReportManifest | undefined {
    const summaryAttachmentName = this.selectedSummaryTabId.value;
    if (!summaryAttachmentName) {
      return undefined;
    }

    const manifestText = this.manifestContents.get(summaryAttachmentName);
    if (!manifestText || manifestText === LOADING_CONTENT) {
      return undefined;
    }

    return JSON.parse(manifestText) as ReportManifest;
  }

  private async rewriteReportHtml(
    html: string,
    reportEntry: ReportManifestEntry,
    manifest: ReportManifest,
  ): Promise<string> {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');
    const assetMap = this.buildAssetMap(manifest);
    const reportPath = this.normalizePath(this.getReportPath(reportEntry));
    const reportDirectory = reportPath.includes('/')
      ? reportPath.substring(0, reportPath.lastIndexOf('/') + 1)
      : '';

    await this.inlineLinkedAssets(document, reportDirectory, assetMap);
    this.rewriteAnchorUrls(document, reportDirectory, assetMap);
    this.rewriteDocumentUrls(document, 'img', 'src', reportDirectory, assetMap);
    this.rewriteDocumentUrls(
      document,
      'iframe',
      'src',
      reportDirectory,
      assetMap,
    );
    this.rewriteDocumentUrls(
      document,
      'source',
      'src',
      reportDirectory,
      assetMap,
    );
    this.rewriteInlineStyles(document, reportDirectory, assetMap);
    this.injectFrameLayoutStyles(document);
    this.injectNavigationScript(document, reportEntry.attachmentName);

    return document.documentElement.outerHTML;
  }

  private injectFrameLayoutStyles(document: Document) {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      html, body {
        margin: 0 !important;
        overflow: hidden !important;
      }
    `;

    if (document.head) {
      document.head.appendChild(styleElement);
      return;
    }

    document.documentElement.prepend(styleElement);
  }

  private async inlineLinkedAssets(
    document: Document,
    reportDirectory: string,
    assetMap: Map<string, string>,
  ) {
    const stylesheetLinks = Array.from(
      document.querySelectorAll("link[rel='stylesheet'][href]"),
    );
    await Promise.all(
      stylesheetLinks.map(async (linkElement) => {
        const href = linkElement.getAttribute('href');
        if (!href || this.isExternalUrl(href)) {
          return;
        }

        const linkedEntry = this.findManifestEntryForRelativeUrl(
          reportDirectory,
          href,
        );
        if (!linkedEntry) {
          return;
        }

        const stylesheetContent = await this.getCachedAttachmentContent(
          linkedEntry.attachmentName,
        );
        const styleElement = document.createElement('style');
        styleElement.textContent = this.rewriteCssUrls(
          stylesheetContent,
          this.getBaseDirectory(linkedEntry),
          assetMap,
        );
        linkElement.replaceWith(styleElement);
      }),
    );

    const scriptLinks = Array.from(document.querySelectorAll('script[src]'));
    await Promise.all(
      scriptLinks.map(async (scriptElement) => {
        const src = scriptElement.getAttribute('src');
        if (!src || this.isExternalUrl(src)) {
          return;
        }

        const linkedEntry = this.findManifestEntryForRelativeUrl(
          reportDirectory,
          src,
        );
        if (!linkedEntry) {
          return;
        }

        const blobScriptUrl = await this.getCachedScriptBlobUrl(
          linkedEntry.attachmentName,
        );
        scriptElement.setAttribute('src', blobScriptUrl);
      }),
    );
  }

  private getCachedAttachmentContent(attachmentName: string): Promise<string> {
    const cached = this.linkedAssetContentCache.get(attachmentName);
    if (cached) {
      return cached;
    }

    const fetchPromise = this.props.attachmentClient
      .getReportContent(attachmentName)
      .catch((error) => {
        this.linkedAssetContentCache.delete(attachmentName);
        throw error;
      });

    this.linkedAssetContentCache.set(attachmentName, fetchPromise);
    return fetchPromise;
  }

  private getCachedScriptBlobUrl(attachmentName: string): Promise<string> {
    const cached = this.scriptBlobUrlCache.get(attachmentName);
    if (cached) {
      return cached;
    }

    const blobUrlPromise = this.getCachedAttachmentContent(attachmentName)
      .then((scriptContent) => {
        const blobUrl = URL.createObjectURL(
          new Blob([scriptContent], { type: 'text/javascript' }),
        );
        this.createdObjectUrls.add(blobUrl);
        return blobUrl;
      })
      .catch((error) => {
        this.scriptBlobUrlCache.delete(attachmentName);
        throw error;
      });

    this.scriptBlobUrlCache.set(attachmentName, blobUrlPromise);
    return blobUrlPromise;
  }

  private rewriteDocumentUrls(
    document: Document,
    selector: string,
    attributeName: string,
    reportDirectory: string,
    assetMap: Map<string, string>,
  ) {
    document.querySelectorAll(selector).forEach((element) => {
      const currentValue = element.getAttribute(attributeName);
      if (!currentValue || this.isExternalUrl(currentValue)) {
        return;
      }

      const resolvedPath = this.resolveRelativePath(
        reportDirectory,
        currentValue,
      );
      const resolvedUrl = assetMap.get(resolvedPath);
      if (resolvedUrl) {
        element.setAttribute(attributeName, resolvedUrl);
      }
    });
  }

  private rewriteAnchorUrls(
    document: Document,
    reportDirectory: string,
    assetMap: Map<string, string>,
  ) {
    document.querySelectorAll('a[href]').forEach((element) => {
      const currentValue = element.getAttribute('href');
      if (!currentValue || this.isExternalUrl(currentValue)) {
        return;
      }

      const linkedEntry = this.findManifestEntryForRelativeUrl(
        reportDirectory,
        currentValue,
      );
      if (linkedEntry?.isHtml) {
        element.setAttribute(
          'href',
          this.getInternalReportHash(linkedEntry.attachmentName),
        );
        element.setAttribute(
          INTERNAL_REPORT_LINK_ATTRIBUTE,
          linkedEntry.attachmentName,
        );
        element.removeAttribute('target');
        return;
      }

      const resolvedPath = this.resolveRelativePath(
        reportDirectory,
        currentValue,
      );
      const resolvedUrl = assetMap.get(resolvedPath);
      if (resolvedUrl) {
        element.setAttribute('href', resolvedUrl);
      }
    });
  }

  private injectNavigationScript(document: Document, attachmentName: string) {
    const scriptElement = document.createElement('script');
    scriptElement.textContent = `
      (function () {
        function getDocumentHeight() {
          var body = document.body;
          var doc = document.documentElement;
          return Math.max(
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            doc ? doc.scrollHeight : 0,
            doc ? doc.offsetHeight : 0
          );
        }

        function notifyHeight() {
          window.parent.postMessage(
            {
              type: "${INTERNAL_REPORT_HEIGHT_MESSAGE}",
              attachmentName: "${attachmentName}",
              height: getDocumentHeight()
            },
            "*"
          );
        }

        window.addEventListener("load", notifyHeight);
        window.addEventListener("resize", notifyHeight);

        if (typeof MutationObserver !== "undefined") {
          var observer = new MutationObserver(notifyHeight);
          observer.observe(document.documentElement, {
            attributes: true,
            childList: true,
            subtree: true
          });
        }

        notifyHeight();
      })();

      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        var link = target.closest("a[${INTERNAL_REPORT_LINK_ATTRIBUTE}]");
        if (!link) {
          return;
        }

        var attachmentName = link.getAttribute("${INTERNAL_REPORT_LINK_ATTRIBUTE}");
        if (!attachmentName) {
          return;
        }

        event.preventDefault();
        window.parent.postMessage({ type: "${INTERNAL_REPORT_NAVIGATION_MESSAGE}", attachmentName: attachmentName }, "*");
      }, true);
    `;

    if (document.body) {
      document.body.appendChild(scriptElement);
      return;
    }

    document.documentElement.appendChild(scriptElement);
  }

  private rewriteInlineStyles(
    document: Document,
    reportDirectory: string,
    assetMap: Map<string, string>,
  ) {
    document.querySelectorAll('style').forEach((styleElement) => {
      if (!styleElement.textContent) {
        return;
      }

      styleElement.textContent = this.rewriteCssUrls(
        styleElement.textContent,
        reportDirectory,
        assetMap,
      );
    });
  }

  private buildAssetMap(manifest: ReportManifest): Map<string, string> {
    const assetMap = new Map<string, string>();
    const files = manifest.files || manifest.reports;

    files.forEach((entry) => {
      const relativePath = this.normalizePath(this.getReportPath(entry));
      try {
        assetMap.set(
          relativePath,
          this.props.attachmentClient.getReportUrl(entry.attachmentName),
        );
      } catch {
        return;
      }
    });

    return assetMap;
  }

  private findManifestEntryForRelativeUrl(
    reportDirectory: string,
    relativeUrl: string,
  ): ReportManifestEntry | undefined {
    const manifest = this.getSelectedManifest();
    if (!manifest) {
      return undefined;
    }

    const resolvedPath = this.resolveRelativePath(reportDirectory, relativeUrl);
    const files = manifest.files || manifest.reports;
    return files.find(
      (entry) => this.normalizePath(this.getReportPath(entry)) === resolvedPath,
    );
  }

  private getBaseDirectory(reportEntry: ReportManifestEntry): string {
    const reportPath = this.normalizePath(this.getReportPath(reportEntry));
    return reportPath.includes('/')
      ? reportPath.substring(0, reportPath.lastIndexOf('/') + 1)
      : '';
  }

  private rewriteCssUrls(
    cssText: string,
    reportDirectory: string,
    assetMap: Map<string, string>,
  ): string {
    return cssText.replace(
      /url\((['"]?)([^)'"]+)\1\)/g,
      (_match, quote, assetUrl) => {
        if (!assetUrl || this.isExternalUrl(assetUrl)) {
          return `url(${quote}${assetUrl}${quote})`;
        }

        const resolvedPath = this.resolveRelativePath(
          reportDirectory,
          assetUrl,
        );
        const resolvedUrl = assetMap.get(resolvedPath);
        if (!resolvedUrl) {
          return `url(${quote}${assetUrl}${quote})`;
        }

        return `url(${quote}${resolvedUrl}${quote})`;
      },
    );
  }

  private resolveRelativePath(
    reportDirectory: string,
    relativeUrl: string,
  ): string {
    const [pathPart] = relativeUrl.split(/[?#]/, 1);
    const baseUrl = new URL(
      reportDirectory || '.',
      'https://publish-html-tab.local/',
    );
    const resolvedUrl = new URL(pathPart, baseUrl);
    return this.normalizePath(resolvedUrl.pathname.replace(/^\/+/, ''));
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  private getInternalReportHash(attachmentName: string): string {
    const params = new URLSearchParams();
    params.set(INTERNAL_REPORT_HASH_KEY, attachmentName);
    return `#${params.toString()}`;
  }

  private getAttachmentNameFromLocationHash(): string | undefined {
    const hash = window.location.hash;
    if (!hash || hash === '#') {
      return undefined;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    return params.get(INTERNAL_REPORT_HASH_KEY) || undefined;
  }

  private syncLocationHash(attachmentName: string, pushHistory?: boolean) {
    if (!attachmentName) {
      return;
    }

    const nextHash = this.getInternalReportHash(attachmentName);
    if (window.location.hash !== nextHash) {
      if (pushHistory) {
        window.history.pushState(null, document.title, nextHash);
      } else {
        window.history.replaceState(null, document.title, nextHash);
      }
    }

    void this.syncHostQueryState(attachmentName);
  }

  private getHostNavigationService(): Promise<IHostNavigationService> {
    if (!this.hostNavigationServicePromise) {
      this.hostNavigationServicePromise = SDK.getService<IHostNavigationService>(
        CommonServiceIds.HostNavigationService,
      );
    }

    return this.hostNavigationServicePromise;
  }

  private async syncHostQueryState(attachmentName: string): Promise<void> {
    if (!attachmentName) {
      return;
    }

    try {
      const hostNavigationService = await this.getHostNavigationService();
      hostNavigationService.setQueryParams({
        [HOST_REPORT_QUERY_KEY]: attachmentName,
        [HOST_SUMMARY_QUERY_KEY]: this.selectedSummaryTabId.value || '',
      });
    } catch {
      return;
    }
  }

  private async getHostQueryParam(key: string): Promise<string | undefined> {
    try {
      const hostNavigationService = await this.getHostNavigationService();
      const queryParams = await hostNavigationService.getQueryParams();
      const value = queryParams[key];
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  private async initializeManifestSelection(): Promise<void> {
    const hostSummaryAttachment = await this.getHostQueryParam(
      HOST_SUMMARY_QUERY_KEY,
    );
    if (!this.componentMounted) {
      return;
    }

    if (hostSummaryAttachment) {
      const hasSummaryAttachment = this.props.attachmentClient
        .getSummaryAttachments()
        .some((attachment) => attachment.name === hostSummaryAttachment);
      if (hasSummaryAttachment) {
        this.selectedSummaryTabId.value = hostSummaryAttachment;
      }
    }

    if (this.selectedSummaryTabId.value) {
      this.loadManifest(this.selectedSummaryTabId.value);
    }
  }

  private navigateToHashedReport(manifest?: ReportManifest): boolean {
    const attachmentName = this.getAttachmentNameFromLocationHash();
    if (!attachmentName) {
      return false;
    }

    if (!this.props.attachmentClient.hasManifestMode()) {
      const targetAttachment = this.props.attachmentClient
        .getLegacyAttachments()
        .find((attachment) => attachment.name === attachmentName);
      if (!targetAttachment) {
        return false;
      }

      this.selectedReportTabId.value = attachmentName;
      this.ensureReportContentLoaded(attachmentName);
      return true;
    }

    const selectedManifest = manifest || this.getSelectedManifest();
    const linkedEntry = (
      selectedManifest?.files || selectedManifest?.reports
    )?.find((entry) => entry.attachmentName === attachmentName);
    if (!linkedEntry?.isHtml) {
      return false;
    }

    if (this.reportContents.get(attachmentName) === undefined) {
      this.reportContents.add(attachmentName, LOADING_CONTENT);
    }

    this.selectedReportTabId.value = attachmentName;
    this.ensureReportContentLoaded(attachmentName);
    return true;
  }

  private updateFrameHeight(attachmentName: string, height: number) {
    if (
      !attachmentName ||
      !Number.isFinite(height) ||
      attachmentName !== this.selectedReportTabId.value
    ) {
      return;
    }

    const frame = Array.from(
      document.querySelectorAll('iframe[data-publish-html-tab-report-frame]'),
    ).find(
      (candidate) =>
        candidate.getAttribute('data-publish-html-tab-report-frame') ===
        attachmentName,
    ) as HTMLIFrameElement | undefined;
    if (!frame) {
      return;
    }

    frame.style.height = `${Math.max(320, Math.ceil(height))}px`;
    frame.style.visibility = 'visible';
  }

  private navigateToFirstReport(pushHistory?: boolean) {
    if (!this.props.attachmentClient.hasManifestMode()) {
      const firstAttachment =
        this.props.attachmentClient.getLegacyAttachments()[0];
      if (!firstAttachment) {
        return;
      }

      this.selectedReportTabId.value = firstAttachment.name;
      this.syncLocationHash(firstAttachment.name, pushHistory);
      this.ensureReportContentLoaded(firstAttachment.name);
      return;
    }

    const manifest = this.getSelectedManifest();
    if (!manifest) {
      return;
    }

    const preferredReport = this.getPreferredReport(manifest);
    if (!preferredReport) {
      return;
    }

    if (this.reportContents.get(preferredReport.attachmentName) === undefined) {
      this.reportContents.add(preferredReport.attachmentName, LOADING_CONTENT);
    }

    this.selectedReportTabId.value = preferredReport.attachmentName;
    this.syncLocationHash(preferredReport.attachmentName, pushHistory);
    this.ensureReportContentLoaded(preferredReport.attachmentName);
  }

  private isExternalUrl(url: string): boolean {
    return (
      url.startsWith('#') ||
      /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) ||
      url.startsWith('//')
    );
  }

  private getPreferredReport(
    manifest: ReportManifest,
  ): ReportManifestEntry | undefined {
    const reports = manifest.reports;
    if (reports.length === 0) {
      return undefined;
    }

    const indexReports = reports
      .filter((report) => this.isIndexReport(report))
      .sort(
        (left, right) =>
          this.getReportPath(left).length - this.getReportPath(right).length,
      );

    return indexReports[0] || reports[0];
  }

  private isIndexReport(report: ReportManifestEntry): boolean {
    const normalizedPath = this.getReportPath(report).toLowerCase();
    return (
      normalizedPath.endsWith('/index.html') ||
      normalizedPath.endsWith('/index.htm') ||
      normalizedPath === 'index.html' ||
      normalizedPath === 'index.htm'
    );
  }

  private getReportPath(report: ReportManifestEntry): string {
    return report.relativePath || report.displayName || report.fileName;
  }

  private getLegacyTabName(attachmentName: string): string {
    return attachmentName.split('.')[0];
  }

  private onEmbeddedReportMessage = (event: MessageEvent) => {
    const data = event.data as
      | { type?: string; attachmentName?: string; height?: number }
      | undefined;
    if (!data || !data.type) {
      return;
    }

    if (data.type === INTERNAL_REPORT_HEIGHT_MESSAGE) {
      if (!data.attachmentName || typeof data.height !== 'number') {
        return;
      }

      this.updateFrameHeight(data.attachmentName, data.height);
      return;
    }

    if (
      data.type !== INTERNAL_REPORT_NAVIGATION_MESSAGE ||
      !data.attachmentName
    ) {
      return;
    }

    if (this.reportContents.get(data.attachmentName) === undefined) {
      const manifest = this.getSelectedManifest();
      const linkedEntry = manifest?.files?.find(
        (entry) => entry.attachmentName === data.attachmentName,
      );

      if (!linkedEntry?.isHtml) {
        return;
      }

      this.reportContents.add(data.attachmentName, LOADING_CONTENT);
    }

    this.selectedReportTabId.value = data.attachmentName;
    this.syncLocationHash(data.attachmentName, true);
    this.ensureReportContentLoaded(data.attachmentName);
  };

  private onDownloadAll = async () => {
    const downloadAll = this.getSelectedManifest()?.downloadAll;
    if (!downloadAll) {
      return;
    }

    try {
      await this.props.attachmentClient.downloadReportArchive(
        downloadAll.attachmentName,
        downloadAll.fileName,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert('Unable to download tab content archive: ' + message);
    }
  };

  private onSummaryTabChanged = (newTabId: string) => {
    const isReselectedTab = this.selectedSummaryTabId.value === newTabId;
    this.selectedSummaryTabId.value = newTabId;
    const loadManifestPromise = this.loadManifest(newTabId);
    if (isReselectedTab) {
      loadManifestPromise
        .then(() => {
          this.navigateToFirstReport(true);
        })
        .catch(() => {
          return;
        });
    }
  };

  private onReportTabChanged = (newTabId: string) => {
    this.selectedReportTabId.value = newTabId;
    this.syncLocationHash(newTabId, true);
    this.ensureReportContentLoaded(newTabId);
  };

  private onLegacyTabChanged = (newTabId: string) => {
    this.selectedReportTabId.value = newTabId;
    this.syncLocationHash(newTabId, true);
    this.ensureReportContentLoaded(newTabId);
  };

  private onLocationHashChanged = () => {
    this.navigateToHashedReport();
  };

  private onHistoryChanged = () => {
    this.navigateToHashedReport();
  };
}
