import * as React from 'react';

import { Attachment } from 'azure-devops-extension-api/Build';

import {
  HOST_REPORT_QUERY_KEY,
  HOST_SUMMARY_QUERY_KEY,
  INTERNAL_REPORT_FRAME_ATTRIBUTE,
  INTERNAL_REPORT_HEIGHT_MESSAGE,
  INTERNAL_REPORT_LINK_CLICK_MESSAGE,
  INTERNAL_REPORT_NAVIGATION_MESSAGE,
  MIN_REPORT_FRAME_HEIGHT,
} from '../constants';
import { trackPublishTabDownloadClicked } from '../application/analytics/trackPublishTabDownloadClicked';
import { trackPublishTabDownloadFailed } from '../application/analytics/trackPublishTabDownloadFailed';
import { trackPublishTabLinkClicked } from '../application/analytics/trackPublishTabLinkClicked';
import { trackPublishTabNavigationFailed } from '../application/analytics/trackPublishTabNavigationFailed';
import { trackPublishTabOpened } from '../application/analytics/trackPublishTabOpened';
import { trackPublishTabSelected } from '../application/analytics/trackPublishTabSelected';
import {
  AnalyticsErrorKind,
  AnalyticsMode,
  AnalyticsNavigationSource,
  AnalyticsTabType,
} from '../domain/analytics';
import { hashValue } from '../infrastructure/analytics/hash';
import {
  bucketManifestSize,
  normalizeErrorKind,
  sanitizeLinkDetails,
  sanitizeTrackedPath,
} from '../infrastructure/analytics/sanitizers';
import {
  EmbeddedReportMessage,
  PublishTabContainerProps,
  PublishTabContainerState,
  PublishTabHeaderTab,
  ReportManifest,
  PublishTabViewProps,
  SelectReportOptions,
} from '../models';
import { AttachmentClient } from '../services/attachments/AttachmentClient';
import { HostNavigationService } from '../services/navigation/HostNavigationService';
import { ReportHtmlService } from '../services/reports/ReportHtmlService';
import { formatErrorHtml, formatNotFoundHtml } from '../utils/html';
import {
  findManifestEntryByAttachmentName,
  getLegacyTabTitle,
  getManifestEntries,
  getPreferredReportEntry,
  getReportPath,
} from '../utils/reportManifest';
import {
  createInternalReportHash,
  getAttachmentNameFromHash,
} from '../utils/reportPaths';
import { PublishTabView } from '../ui/components/PublishTabView';

/**
 * Stateful controller component that coordinates PublishTab services and view models.
 */
export class PublishTabContainer extends React.Component<
  PublishTabContainerProps,
  PublishTabContainerState
> {
  // The container owns orchestration only; rendering stays delegated to pure components.
  private readonly hostNavigationService = new HostNavigationService();
  private readonly openedAtMs = Date.now();
  private readonly reportHtmlService: ReportHtmlService;
  private hasTrackedOpenedEvent = false;
  private isComponentMounted = false;
  private lastTrackedTabChangeAtMs = this.openedAtMs;

  /**
   * Creates the PublishTab controller for the current build context.
   *
   * @param {PublishTabContainerProps} props - Container dependencies and build-scoped services.
   */
  constructor(props: PublishTabContainerProps) {
    super(props);

    this.reportHtmlService = new ReportHtmlService(props.attachmentClient);
    this.state = this.createInitialState(props.attachmentClient);
  }

  /**
   * Starts browser subscriptions and restores the initial selection state.
   *
   * @returns {void} Does not return a value.
   */
  public componentDidMount(): void {
    this.isComponentMounted = true;

    window.addEventListener('hashchange', this.handleLocationHashChanged);
    window.addEventListener('message', this.handleEmbeddedReportMessage);
    window.addEventListener('popstate', this.handleHistoryChanged);

    // Start from the host URL state so refresh/back keeps the same page selected.
    void this.initializeView();
  }

  /**
   * Removes subscriptions and releases controller-owned resources.
   *
   * @returns {void} Does not return a value.
   */
  public componentWillUnmount(): void {
    this.isComponentMounted = false;

    window.removeEventListener('hashchange', this.handleLocationHashChanged);
    window.removeEventListener('message', this.handleEmbeddedReportMessage);
    window.removeEventListener('popstate', this.handleHistoryChanged);

    this.reportHtmlService.dispose();
  }

  /**
   * Builds the current page view model and renders the presentational tree.
   *
   * @returns {JSX.Element | null} PublishTab view markup or `null` when no attachments exist.
   */
  public render(): JSX.Element | null {
    const viewProps = this.createViewProps();
    return viewProps ? <PublishTabView {...viewProps} /> : null;
  }

  /**
   * Creates the render-only view model consumed by the page component.
   *
   * @returns {PublishTabViewProps | null} Prepared view props or `null` when nothing can be rendered.
   */
  private createViewProps(): PublishTabViewProps | null {
    const attachmentClient = this.props.attachmentClient;
    const summaryAttachments = attachmentClient.getSummaryAttachments();
    const legacyAttachments = attachmentClient.getLegacyAttachments();
    const isManifestMode = attachmentClient.hasManifestMode();
    const hasRenderableView = this.shouldRenderView(
      isManifestMode,
      summaryAttachments.length,
      legacyAttachments.length,
    );
    if (!hasRenderableView) return null;

    return {
      appVersion: this.props.appVersion,
      isManifestMode,
      onDownloadArchive: this.handleDownloadArchive,
      onLegacyTabChange: this.handleLegacyTabChange,
      onOpenFirstReport: this.handleOpenFirstReport,
      onReportTabChange: this.handleReportTabChange,
      onSummaryTabChange: this.handleSummaryTabChange,
      ...this.buildTabViewProps(
        isManifestMode,
        this.getSelectedManifest(),
        summaryAttachments,
        legacyAttachments,
      ),
      ...this.buildViewerProps(),
    };
  }

  /**
   * Builds the tab-related part of the page view model.
   *
   * @param {boolean} isManifestMode - Indicates whether manifest mode is active.
   * @param {ReportManifest | undefined} selectedManifest - Manifest currently selected in the header.
   * @param {Attachment[]} summaryAttachments - Summary attachments available for the current build.
   * @param {Attachment[]} legacyAttachments - Legacy report attachments available for the current build.
   * @returns {Pick<PublishTabViewProps, 'legacyTabs' | 'reportTabs' | 'selectedReportTabId' | 'selectedSummaryTabId' | 'showPrimaryDownloadButton' | 'singleTitle' | 'summaryTabs'>} Tab-related view props.
   */
  private buildTabViewProps(
    isManifestMode: boolean,
    selectedManifest: ReportManifest | undefined,
    summaryAttachments: Attachment[],
    legacyAttachments: Attachment[],
  ): Pick<
    PublishTabViewProps,
    | 'legacyTabs'
    | 'reportTabs'
    | 'selectedReportTabId'
    | 'selectedSummaryTabId'
    | 'showPrimaryDownloadButton'
    | 'singleTitle'
    | 'summaryTabs'
  > {
    return {
      legacyTabs: this.buildLegacyTabs(legacyAttachments),
      reportTabs: this.buildReportTabs(selectedManifest),
      selectedReportTabId: this.state.selectedReportAttachmentName,
      selectedSummaryTabId: this.state.selectedSummaryAttachmentName,
      showPrimaryDownloadButton: !!selectedManifest?.downloadAll,
      singleTitle: this.getSingleTitle(
        isManifestMode,
        selectedManifest,
        summaryAttachments,
        legacyAttachments,
      ),
      summaryTabs: this.buildSummaryTabs(summaryAttachments),
    };
  }

  /**
   * Builds the viewer-related part of the page view model.
   *
   * @returns {Pick<PublishTabViewProps, 'viewerContentHtml' | 'viewerLoadingMessage' | 'viewerWarningMessage'>} Viewer state exposed to the presentational layer.
   */
  private buildViewerProps(): Pick<
    PublishTabViewProps,
    'viewerContentHtml' | 'viewerLoadingMessage' | 'viewerWarningMessage'
  > {
    const isManifestLoading = this.isSelectedManifestLoading();

    return {
      viewerContentHtml: isManifestLoading
        ? undefined
        : this.getSelectedViewerContent(),
      viewerLoadingMessage: isManifestLoading
        ? 'Loading tab content...'
        : undefined,
      viewerWarningMessage: this.state.viewerWarningMessage,
    };
  }

  /**
   * Returns the shared analytics context attached to every event.
   *
   * @returns {{ buildId: number; extensionVersion: string; mode: AnalyticsMode }} Shared analytics fields.
   */
  private getAnalyticsContext(): {
    buildId: number;
    extensionVersion: string;
    mode: AnalyticsMode;
  } {
    return {
      buildId: this.props.buildId,
      extensionVersion: this.props.appVersion,
      mode: this.props.attachmentClient.hasManifestMode()
        ? 'manifest'
        : 'legacy',
    };
  }

  /**
   * Returns the time elapsed since the PublishTab view was opened.
   *
   * @returns {number} Elapsed time in milliseconds.
   */
  private getTimeSinceOpenMs(): number {
    return Math.max(0, Date.now() - this.openedAtMs);
  }

  /**
   * Returns and stores the elapsed time since the previous tracked tab change.
   *
   * @returns {number} Elapsed time in milliseconds.
   */
  private consumeTimeBeforeTabChangeMs(): number {
    const now = Date.now();
    const elapsedTime = Math.max(0, now - this.lastTrackedTabChangeAtMs);
    this.lastTrackedTabChangeAtMs = now;
    return elapsedTime;
  }

  /**
   * Runs one analytics task without allowing telemetry failures to surface to the UI.
   *
   * @param {Promise<void>} analyticsTask - Tracking promise started by a handler.
   * @returns {void} Does not return a value.
   */
  private runAnalyticsTask(analyticsTask: Promise<void>): void {
    analyticsTask.catch(() => {
      return;
    });
  }

  /**
   * Indicates whether the controller has enough attachments to render the view.
   *
   * @param {boolean} isManifestMode - Indicates whether manifest mode is active.
   * @param {number} summaryAttachmentCount - Number of summary attachments available.
   * @param {number} legacyAttachmentCount - Number of legacy report attachments available.
   * @returns {boolean} `true` when the current mode has something to display.
   */
  private shouldRenderView(
    isManifestMode: boolean,
    summaryAttachmentCount: number,
    legacyAttachmentCount: number,
  ): boolean {
    return isManifestMode
      ? summaryAttachmentCount > 0
      : legacyAttachmentCount > 0;
  }

  /**
   * Builds header tabs for manifest summary attachments.
   *
   * @param {Attachment[]} summaryAttachments - Summary attachments available for the current build.
   * @returns {PublishTabHeaderTab[]} Summary tab descriptors for the header.
   */
  private buildSummaryTabs(
    summaryAttachments: Attachment[],
  ): PublishTabHeaderTab[] {
    return summaryAttachments.map((attachment) => {
      const manifest =
        this.state.manifestBySummaryAttachmentName[attachment.name];

      return {
        downloadArchiveFileName: manifest?.downloadAll?.fileName,
        id: attachment.name,
        label: manifest?.tabName || getLegacyTabTitle(attachment.name),
        showDownloadBadge:
          attachment.name === this.state.selectedSummaryAttachmentName &&
          !!manifest?.downloadAll,
      };
    });
  }

  /**
   * Builds header tabs for legacy report attachments.
   *
   * @param {Attachment[]} legacyAttachments - Legacy report attachments available for the current build.
   * @returns {PublishTabHeaderTab[]} Legacy tab descriptors for the header.
   */
  private buildLegacyTabs(
    legacyAttachments: Attachment[],
  ): PublishTabHeaderTab[] {
    return legacyAttachments.map((attachment) => ({
      id: attachment.name,
      label: getLegacyTabTitle(attachment.name),
    }));
  }

  /**
   * Builds the secondary report tabs for the selected manifest.
   *
   * @param {ReportManifest} [manifest] - Manifest currently selected in the header.
   * @returns {PublishTabHeaderTab[]} Report tab descriptors for the active manifest.
   */
  private buildReportTabs(manifest?: ReportManifest): PublishTabHeaderTab[] {
    return (manifest?.reports || []).map((entry) => ({
      id: entry.attachmentName,
      label: entry.displayName,
    }));
  }

  /**
   * Resolves the single-title fallback used when only one top-level tab exists.
   *
   * @param {boolean} isManifestMode - Indicates whether manifest mode is active.
   * @param {ReportManifest} [manifest] - Manifest currently selected in the header.
   * @param {Attachment[]} summaryAttachments - Summary attachments available for the current build.
   * @param {Attachment[]} legacyAttachments - Legacy report attachments available for the current build.
   * @returns {string} Title displayed in the compact header layout.
   */
  private getSingleTitle(
    isManifestMode: boolean,
    manifest: ReportManifest | undefined,
    summaryAttachments: Attachment[],
    legacyAttachments: Attachment[],
  ): string {
    if (isManifestMode) {
      return (
        manifest?.tabName ||
        getLegacyTabTitle(summaryAttachments[0]?.name || '')
      );
    }

    return getLegacyTabTitle(legacyAttachments[0]?.name || '');
  }

  /**
   * Returns the content currently shown by the report viewer.
   *
   * @returns {string | undefined} Selected report HTML or the current error state.
   */
  private getSelectedViewerContent(): string | undefined {
    return (
      this.state.viewerErrorHtml ||
      this.state.reportFrameHtmlByAttachmentName[
        this.state.selectedReportAttachmentName
      ]
    );
  }

  /**
   * Indicates whether the selected manifest is currently loading.
   *
   * @returns {boolean} `true` when the selected summary tab is still loading its manifest.
   */
  private isSelectedManifestLoading(): boolean {
    return !!this.state.loadingManifestByAttachmentName[
      this.state.selectedSummaryAttachmentName
    ];
  }

  /**
   * Returns the report path currently selected by the viewer.
   *
   * @returns {string | undefined} Current report path or legacy attachment name.
   */
  private getSelectedReportTrackingPath(): string | undefined {
    return this.getReportTrackingPath(this.state.selectedReportAttachmentName);
  }

  /**
   * Resolves the stable analytics path for one report attachment.
   *
   * @param {string} attachmentName - Report attachment currently being tracked.
   * @returns {string | undefined} Manifest-relative path or legacy attachment name.
   */
  private getReportTrackingPath(attachmentName: string): string | undefined {
    if (!attachmentName) {
      return undefined;
    }

    const manifestEntry = this.getSelectedManifest()
      ? findManifestEntryByAttachmentName(
          this.getSelectedManifest() as ReportManifest,
          attachmentName,
        )
      : undefined;
    return manifestEntry ? getReportPath(manifestEntry) : attachmentName;
  }

  /**
   * Hashes a sanitized tracking path before it leaves the browser.
   *
   * @param {string | undefined} rawPath - Raw internal path or attachment identifier.
   * @returns {Promise<string | undefined>} Hashed path safe to send to analytics.
   */
  private async hashTrackedPath(
    rawPath: string | undefined,
  ): Promise<string | undefined> {
    const sanitizedPath = sanitizeTrackedPath(rawPath);
    return sanitizedPath ? hashValue(sanitizedPath) : undefined;
  }

  /**
   * Returns the total number of visible top-level tabs for the current mode.
   *
   * @returns {number} Current top-level tab count.
   */
  private getTopLevelTabCount(): number {
    return this.props.attachmentClient.hasManifestMode()
      ? this.props.attachmentClient.getSummaryAttachments().length
      : this.props.attachmentClient.getLegacyAttachments().length;
  }

  /**
   * Returns the number of report pages in the currently selected report context.
   *
   * @returns {number} Current report page count.
   */
  private getCurrentPageCount(): number {
    return this.getSelectedManifest()?.reports.length || 1;
  }

  /**
   * Returns the index of the currently selected top-level tab when available.
   *
   * @returns {number | undefined} Zero-based selected top-level tab index.
   */
  private getSelectedTopLevelTabIndex(): number | undefined {
    if (!this.props.attachmentClient.hasManifestMode()) {
      return this.findTabIndex(
        this.props.attachmentClient
          .getLegacyAttachments()
          .map((item) => item.name),
        this.state.selectedReportAttachmentName,
      );
    }

    return this.findTabIndex(
      this.props.attachmentClient
        .getSummaryAttachments()
        .map((item) => item.name),
      this.state.selectedSummaryAttachmentName,
    );
  }

  /**
   * Returns the manifest size bucket for the current summary tab.
   *
   * @returns {ReturnType<typeof bucketManifestSize> | undefined} Size bucket when manifest mode is active.
   */
  private getManifestSizeBucket():
    | ReturnType<typeof bucketManifestSize>
    | undefined {
    const selectedManifest = this.getSelectedManifest();
    return selectedManifest
      ? bucketManifestSize(getManifestEntries(selectedManifest).length)
      : undefined;
  }

  /**
   * Looks up the zero-based index of one tab identifier.
   *
   * @param {string[]} tabIds - Ordered list of visible tab identifiers.
   * @param {string} selectedTabId - Tab identifier to locate.
   * @returns {number | undefined} Matching tab index when found.
   */
  private findTabIndex(
    tabIds: string[],
    selectedTabId: string,
  ): number | undefined {
    const tabIndex = tabIds.findIndex((tabId) => tabId === selectedTabId);
    return tabIndex >= 0 ? tabIndex : undefined;
  }

  /**
   * Creates the initial controller state before URL restoration runs.
   *
   * @param {AttachmentClient} attachmentClient - Attachment provider for the active build.
   * @returns {PublishTabContainerState} Initial controller state.
   */
  private createInitialState(
    attachmentClient: AttachmentClient,
  ): PublishTabContainerState {
    // Start with the first available tab and let the URL override it later.
    const summaryAttachments = attachmentClient.getSummaryAttachments();
    const legacyAttachments = attachmentClient.getLegacyAttachments();

    return {
      loadingManifestByAttachmentName: {},
      loadingReportByAttachmentName: {},
      manifestBySummaryAttachmentName: {},
      reportFrameHtmlByAttachmentName: {},
      selectedReportAttachmentName: attachmentClient.hasManifestMode()
        ? ''
        : legacyAttachments[0]?.name || '',
      selectedSummaryAttachmentName: summaryAttachments[0]?.name || '',
      viewerErrorHtml: undefined,
      viewerWarningMessage: undefined,
    };
  }

  /**
   * Tracks the first resolved PublishTab view once per container instance.
   *
   * @returns {Promise<void>} Resolves when the open event has been queued.
   */
  private async trackOpenedViewIfNeeded(): Promise<void> {
    if (this.hasTrackedOpenedEvent) {
      return;
    }

    this.hasTrackedOpenedEvent = true;
    this.lastTrackedTabChangeAtMs = Date.now();

    await trackPublishTabOpened(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      hasDownload: !!this.getSelectedManifest()?.downloadAll,
      manifestSizeBucket: this.getManifestSizeBucket(),
      pageCount: this.getCurrentPageCount(),
      tabCount: this.getTopLevelTabCount(),
      targetPathHash: this.state.viewerErrorHtml
        ? undefined
        : await this.hashTrackedPath(this.getSelectedReportTrackingPath()),
    });
  }

  /**
   * Tracks a top-level summary tab click.
   *
   * @param {string} summaryAttachmentName - Selected summary attachment name.
   * @returns {Promise<void>} Resolves when the selected event has been queued.
   */
  private async trackSummaryTabSelected(
    summaryAttachmentName: string,
  ): Promise<void> {
    const tabIndex = this.findTabIndex(
      this.props.attachmentClient
        .getSummaryAttachments()
        .map((item) => item.name),
      summaryAttachmentName,
    );
    if (tabIndex === undefined) {
      return;
    }

    await trackPublishTabSelected(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      navigationSource: 'click',
      tabCount: this.props.attachmentClient.getSummaryAttachments().length,
      tabIndex,
      tabType: 'summary',
      targetPathHash: await this.hashTrackedPath(summaryAttachmentName),
      timeBeforeTabChangeMs: this.consumeTimeBeforeTabChangeMs(),
    });
  }

  /**
   * Tracks one report-layer tab selection.
   *
   * @param {string} attachmentName - Selected report attachment name.
   * @param {AnalyticsTabType} tabType - Tab layer that changed.
   * @param {AnalyticsNavigationSource} navigationSource - Interaction source that caused the change.
   * @returns {Promise<void>} Resolves when the selected event has been queued.
   */
  private async trackReportTabSelected(
    attachmentName: string,
    tabType: AnalyticsTabType,
    navigationSource: AnalyticsNavigationSource,
  ): Promise<void> {
    const trackedTabs = this.getTrackedReportTabs(tabType);
    const tabIndex = this.findTabIndex(
      trackedTabs.map((tab) => tab.id),
      attachmentName,
    );
    if (tabIndex === undefined) {
      return;
    }

    await trackPublishTabSelected(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      navigationSource,
      tabCount: trackedTabs.length,
      tabIndex,
      tabType,
      targetPathHash: await this.hashTrackedPath(
        this.getReportTrackingPath(attachmentName),
      ),
      timeBeforeTabChangeMs: this.consumeTimeBeforeTabChangeMs(),
    });
  }

  /**
   * Returns the currently visible tab descriptors for one report-layer event.
   *
   * @param {AnalyticsTabType} tabType - Tab layer being measured.
   * @returns {PublishTabHeaderTab[]} Tab descriptors in display order.
   */
  private getTrackedReportTabs(
    tabType: AnalyticsTabType,
  ): PublishTabHeaderTab[] {
    if (tabType === 'report') {
      return this.buildReportTabs(this.getSelectedManifest());
    }

    return this.buildLegacyTabs(
      this.props.attachmentClient.getLegacyAttachments(),
    );
  }

  /**
   * Tracks one archive download click on the current top-level tab.
   *
   * @returns {Promise<void>} Resolves when the click event has been queued.
   */
  private async trackDownloadClick(): Promise<void> {
    await trackPublishTabDownloadClicked(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      downloadType: 'archive',
      hasDownload: true,
      tabIndex: this.getSelectedTopLevelTabIndex(),
      tabType: this.props.attachmentClient.hasManifestMode()
        ? 'summary'
        : 'legacy',
      timeBeforeInteractionMs: this.getTimeSinceOpenMs(),
    });
  }

  /**
   * Tracks one archive download failure with a normalized error category.
   *
   * @param {AnalyticsErrorKind} errorKind - Normalized failure category.
   * @returns {Promise<void>} Resolves when the failure event has been queued.
   */
  private async trackDownloadFailure(
    errorKind: AnalyticsErrorKind,
  ): Promise<void> {
    await trackPublishTabDownloadFailed(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      downloadType: 'archive',
      errorKind,
      hasDownload: true,
      tabIndex: this.getSelectedTopLevelTabIndex(),
      tabType: this.props.attachmentClient.hasManifestMode()
        ? 'summary'
        : 'legacy',
      timeBeforeInteractionMs: this.getTimeSinceOpenMs(),
    });
  }

  /**
   * Tracks one link click emitted by the embedded report iframe.
   *
   * @param {EmbeddedReportMessage} data - Parsed link-click message payload.
   * @returns {Promise<void>} Resolves when the link-click event has been queued.
   */
  private async trackEmbeddedLinkClick(
    data: EmbeddedReportMessage,
  ): Promise<void> {
    const details = sanitizeLinkDetails(data);

    await trackPublishTabLinkClicked(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      linkType: details.linkType,
      targetKind: details.targetKind,
      targetPathHash: await this.hashTrackedPath(details.targetPath),
      timeBeforeInteractionMs: this.getTimeSinceOpenMs(),
    });
  }

  /**
   * Tracks one navigation failure with a normalized reason and hashed target.
   *
   * @param {AnalyticsErrorKind} errorKind - Normalized navigation failure category.
   * @param {AnalyticsNavigationSource} navigationSource - Interaction source that caused the failure.
   * @param {string | undefined} rawTarget - Raw target path or attachment name that failed.
   * @returns {Promise<void>} Resolves when the failure event has been queued.
   */
  private async trackNavigationFailure(
    errorKind: AnalyticsErrorKind,
    navigationSource: AnalyticsNavigationSource,
    rawTarget?: string,
  ): Promise<void> {
    await trackPublishTabNavigationFailed(this.props.analyticsTracker, {
      ...this.getAnalyticsContext(),
      errorKind,
      navigationSource,
      targetPathHash: await this.hashTrackedPath(rawTarget),
    });
  }

  /**
   * Restores the initial selection state for the active build.
   *
   * @returns {Promise<void>} Resolves when the first view state has been restored.
   */
  private async initializeView(): Promise<void> {
    if (this.props.attachmentClient.hasManifestMode()) {
      await this.initializeManifestSelection();
      return;
    }

    // Legacy mode restores state directly from the current hash.
    if (!this.navigateToHashedReport()) {
      this.syncLocationHash(this.state.selectedReportAttachmentName, false);
    }

    if (this.state.selectedReportAttachmentName) {
      await this.ensureReportContentLoaded(
        this.state.selectedReportAttachmentName,
      );
    }

    await this.trackOpenedViewIfNeeded();
  }

  /**
   * Restores the selected summary tab from the host query string.
   *
   * @returns {Promise<void>} Resolves when the summary selection has been restored.
   */
  private async initializeManifestSelection(): Promise<void> {
    // Summary tabs can be restored from the host query string.
    const queryParams = await this.hostNavigationService.getQueryParams();
    if (!this.isComponentMounted) return;

    const requestedSummaryAttachment = queryParams[HOST_SUMMARY_QUERY_KEY];
    if (this.isSummaryAttachmentAvailable(requestedSummaryAttachment)) {
      this.setState(
        {
          selectedSummaryAttachmentName: requestedSummaryAttachment as string,
          viewerWarningMessage: undefined,
        },
        () => {
          void this.loadManifest(requestedSummaryAttachment as string);
        },
      );
      return;
    }

    this.setState(
      {
        viewerWarningMessage: requestedSummaryAttachment
          ? `Requested tab "${requestedSummaryAttachment}" was not found. Showing the default tab instead.`
          : undefined,
      },
      () => {
        if (this.state.selectedSummaryAttachmentName) {
          void this.loadManifest(this.state.selectedSummaryAttachmentName);
        }
      },
    );
  }

  /**
   * Indicates whether the requested summary attachment exists in the current build.
   *
   * @param {string | undefined} attachmentName - Summary attachment name requested by the host.
   * @returns {boolean} `true` when the summary tab exists.
   */
  private isSummaryAttachmentAvailable(
    attachmentName: string | undefined,
  ): boolean {
    return (
      !!attachmentName &&
      this.props.attachmentClient
        .getSummaryAttachments()
        .some((attachment) => attachment.name === attachmentName)
    );
  }

  /**
   * Loads a summary manifest and selects the most appropriate report page.
   *
   * @param {string} summaryAttachmentName - Summary attachment that contains the manifest JSON.
   * @returns {Promise<void>} Resolves when the manifest-driven selection has been applied.
   * @throws {Error} Throws when manifest loading fails.
   */
  private async loadManifest(summaryAttachmentName: string): Promise<void> {
    // Load the selected summary manifest, then decide which report page to open.
    this.setState((previousState) => ({
      loadingManifestByAttachmentName: {
        ...previousState.loadingManifestByAttachmentName,
        [summaryAttachmentName]: true,
      },
    }));

    const manifest = await this.props.attachmentClient.getManifest(
      summaryAttachmentName,
    );
    if (!this.isComponentMounted) {
      return;
    }

    this.setState(
      (previousState) => ({
        loadingManifestByAttachmentName: {
          ...previousState.loadingManifestByAttachmentName,
          [summaryAttachmentName]: false,
        },
        manifestBySummaryAttachmentName: {
          ...previousState.manifestBySummaryAttachmentName,
          [summaryAttachmentName]: manifest,
        },
      }),
      () => {
        void this.applyManifestSelection(summaryAttachmentName, manifest);
      },
    );
  }

  /**
   * Chooses the initial report to display after a manifest finishes loading.
   *
   * @param {string} summaryAttachmentName - Summary attachment that owns the manifest.
   * @param {ReportManifest} manifest - Loaded manifest for the selected summary tab.
   * @returns {Promise<void>} Resolves when the best matching report has been selected.
   */
  private async applyManifestSelection(
    summaryAttachmentName: string,
    manifest: ReportManifest,
  ): Promise<void> {
    if (this.navigateToHashedReport(manifest, false)) {
      return;
    }

    if (
      await this.navigateToRequestedManifestReport(
        summaryAttachmentName,
        manifest,
      )
    ) {
      return;
    }

    const preferredReport = getPreferredReportEntry(manifest);
    if (!preferredReport) {
      await this.trackOpenedViewIfNeeded();
      return;
    }

    this.selectReportAndTrackOpened(preferredReport.attachmentName);
  }

  /**
   * Applies host query-string navigation to the selected manifest tab.
   *
   * @param {string} summaryAttachmentName - Summary attachment that owns the manifest.
   * @param {ReportManifest} manifest - Loaded manifest for the selected summary tab.
   * @returns {Promise<boolean>} `true` when a query-string request selected or rejected a report.
   */
  private async navigateToRequestedManifestReport(
    summaryAttachmentName: string,
    manifest: ReportManifest,
  ): Promise<boolean> {
    const queryParams = await this.hostNavigationService.getQueryParams();
    if (!this.isComponentMounted) return true;

    const queryReportAttachment = queryParams[HOST_REPORT_QUERY_KEY];
    const querySummaryAttachment = queryParams[HOST_SUMMARY_QUERY_KEY];
    if (
      this.shouldSkipRequestedManifestReport(
        queryReportAttachment,
        querySummaryAttachment,
        summaryAttachmentName,
      )
    ) {
      return false;
    }

    const queryReportEntry = findManifestEntryByAttachmentName(
      manifest,
      queryReportAttachment,
    );
    if (!queryReportEntry?.isHtml) {
      this.showMissingManifestReport(queryReportAttachment);
      return true;
    }

    this.selectReportAndTrackOpened(queryReportEntry.attachmentName);
    return true;
  }

  /**
   * Indicates whether host query-string navigation should be ignored.
   *
   * @param {string | undefined} queryReportAttachment - Report requested by the host query string.
   * @param {string | undefined} querySummaryAttachment - Summary requested by the host query string.
   * @param {string} summaryAttachmentName - Summary currently being loaded.
   * @returns {boolean} `true` when there is no matching host-driven report selection.
   */
  private shouldSkipRequestedManifestReport(
    queryReportAttachment: string | undefined,
    querySummaryAttachment: string | undefined,
    summaryAttachmentName: string,
  ): boolean {
    return (
      !queryReportAttachment ||
      !!(
        querySummaryAttachment &&
        querySummaryAttachment !== summaryAttachmentName
      )
    );
  }

  /**
   * Selects a report and marks it as the initial opened view once the state is applied.
   *
   * @param {string} attachmentName - Report attachment selected during initial view resolution.
   * @returns {void} Does not return a value.
   */
  private selectReportAndTrackOpened(attachmentName: string): void {
    this.selectReport(attachmentName, {
      clearViewerError: true,
      onSelected: () => {
        this.runAnalyticsTask(this.trackOpenedViewIfNeeded());
      },
      pushHistory: false,
    });
  }

  /**
   * Returns the manifest associated with the currently selected summary tab.
   *
   * @returns {ReportManifest | undefined} Selected manifest when it has already been loaded.
   */
  private getSelectedManifest(): ReportManifest | undefined {
    return this.state.manifestBySummaryAttachmentName[
      this.state.selectedSummaryAttachmentName
    ];
  }

  /**
   * Loads the selected report content on demand.
   *
   * @param {string} attachmentName - Report attachment name to load.
   * @returns {Promise<void>} Resolves when the report content has been stored in state.
   */
  private async ensureReportContentLoaded(
    attachmentName: string,
  ): Promise<void> {
    // Avoid duplicate work when the same report is selected multiple times.
    if (
      !attachmentName ||
      this.state.loadingReportByAttachmentName[attachmentName] ||
      this.state.reportFrameHtmlByAttachmentName[attachmentName] !== undefined
    ) {
      return;
    }

    this.setState((previousState) => ({
      loadingReportByAttachmentName: {
        ...previousState.loadingReportByAttachmentName,
        [attachmentName]: true,
      },
    }));

    const reportFrameHtml = await this.loadReportFrameHtml(attachmentName);
    if (!this.isComponentMounted) return;

    this.setState((previousState) => ({
      loadingReportByAttachmentName: {
        ...previousState.loadingReportByAttachmentName,
        [attachmentName]: false,
      },
      reportFrameHtmlByAttachmentName: {
        ...previousState.reportFrameHtmlByAttachmentName,
        [attachmentName]: reportFrameHtml,
      },
    }));
  }

  /**
   * Loads report frame HTML and converts loading failures into viewer markup.
   *
   * @param {string} attachmentName - Report attachment name to load.
   * @returns {Promise<string>} Final iframe HTML or a formatted error document.
   */
  private async loadReportFrameHtml(attachmentName: string): Promise<string> {
    try {
      return await this.reportHtmlService.getReportFrameHtml(
        attachmentName,
        this.getSelectedManifest(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatErrorHtml(message);
    }
  }

  /**
   * Applies the current browser hash to the active report selection.
   *
   * @param {ReportManifest} [manifest] - Optional manifest used during initial manifest loading.
   * @param {boolean} [showNotFoundOnMissing=true] - Shows a not-found state when the hash target is invalid.
   * @returns {boolean} `true` when a hash target was handled.
   */
  private navigateToHashedReport(
    manifest?: ReportManifest,
    showNotFoundOnMissing: boolean = true,
  ): boolean {
    // The hash always points to the currently displayed report page.
    const attachmentName = getAttachmentNameFromHash(window.location.hash);
    if (!attachmentName) {
      return false;
    }

    if (!this.props.attachmentClient.hasManifestMode()) {
      return this.navigateToLegacyHashedReport(
        attachmentName,
        showNotFoundOnMissing,
      );
    }

    return this.navigateToManifestHashedReport(
      attachmentName,
      manifest || this.getSelectedManifest(),
      showNotFoundOnMissing,
    );
  }

  /**
   * Applies hash-based navigation in legacy mode.
   *
   * @param {string} attachmentName - Attachment name extracted from the browser hash.
   * @param {boolean} showNotFoundOnMissing - Shows an error state when the attachment is missing.
   * @returns {boolean} `true` when the hash target was handled.
   */
  private navigateToLegacyHashedReport(
    attachmentName: string,
    showNotFoundOnMissing: boolean,
  ): boolean {
    if (!this.hasLegacyAttachment(attachmentName)) {
      if (!showNotFoundOnMissing) {
        return false;
      }

      this.showMissingLegacyReport(attachmentName);
      return true;
    }

    this.selectReportWithHashSuppressed(attachmentName);
    return true;
  }

  /**
   * Applies hash-based navigation in manifest mode.
   *
   * @param {string} attachmentName - Attachment name extracted from the browser hash.
   * @param {ReportManifest | undefined} manifest - Manifest currently selected in the header.
   * @param {boolean} showNotFoundOnMissing - Shows an error state when the attachment is missing.
   * @returns {boolean} `true` when the hash target was handled.
   */
  private navigateToManifestHashedReport(
    attachmentName: string,
    manifest: ReportManifest | undefined,
    showNotFoundOnMissing: boolean,
  ): boolean {
    if (!manifest) {
      return false;
    }

    const linkedEntry = findManifestEntryByAttachmentName(
      manifest,
      attachmentName,
    );
    if (!linkedEntry?.isHtml) {
      if (!showNotFoundOnMissing) {
        return false;
      }

      this.showMissingManifestReport(attachmentName);
      return true;
    }

    this.selectReportWithHashSuppressed(attachmentName);
    return true;
  }

  /**
   * Selects a report restored from the browser hash without mutating the hash again.
   *
   * @param {string} attachmentName - Report attachment restored from history or initial URL state.
   * @returns {void} Does not return a value.
   */
  private selectReportWithHashSuppressed(attachmentName: string): void {
    this.selectReport(attachmentName, {
      clearViewerError: true,
      onSelected: () => {
        this.runAnalyticsTask(this.trackOpenedViewIfNeeded());
      },
      pushHistory: false,
      syncLocationHash: false,
    });
  }

  /**
   * Updates the selected report and optionally synchronizes the browser URL.
   *
   * @param {string} attachmentName - Report attachment name to select.
   * @param {SelectReportOptions} options - Selection behavior flags.
   * @returns {void} Does not return a value.
   */
  private selectReport(
    attachmentName: string,
    options: SelectReportOptions,
  ): void {
    if (!attachmentName) {
      return;
    }

    this.setState(
      (previousState) => ({
        selectedReportAttachmentName: attachmentName,
        viewerErrorHtml: options.clearViewerError
          ? undefined
          : previousState.viewerErrorHtml,
      }),
      () => {
        if (options.syncLocationHash !== false) {
          this.syncLocationHash(attachmentName, options.pushHistory);
        }

        options.onSelected?.();

        // Selecting a tab only changes state; loading stays lazy.
        void this.ensureReportContentLoaded(attachmentName);
      },
    );
  }

  /**
   * Synchronizes the current report selection into the browser hash and host query string.
   *
   * @param {string} attachmentName - Selected report attachment name.
   * @param {boolean} pushHistory - Indicates whether to push a new browser history entry.
   * @returns {void} Does not return a value.
   */
  private syncLocationHash(attachmentName: string, pushHistory: boolean): void {
    if (!attachmentName) {
      return;
    }

    const nextHash = createInternalReportHash(attachmentName);
    if (window.location.hash !== nextHash) {
      if (pushHistory) {
        window.history.pushState(null, document.title, nextHash);
      } else {
        window.history.replaceState(null, document.title, nextHash);
      }
    }

    // Keep the Azure DevOps host query string aligned with our internal hash.
    void this.hostNavigationService.syncReportSelection(
      attachmentName,
      this.state.selectedSummaryAttachmentName,
    );
  }

  /**
   * Navigates to the preferred landing report for the current mode.
   *
   * @param {boolean} pushHistory - Indicates whether to push a new browser history entry.
   * @returns {void} Does not return a value.
   */
  private navigateToFirstReport(pushHistory: boolean): void {
    if (!this.props.attachmentClient.hasManifestMode()) {
      const firstAttachment =
        this.props.attachmentClient.getLegacyAttachments()[0]?.name;
      if (!firstAttachment) {
        return;
      }

      this.selectReport(firstAttachment, {
        clearViewerError: true,
        pushHistory,
      });
      return;
    }

    const manifest = this.getSelectedManifest();
    const preferredReport = manifest
      ? getPreferredReportEntry(manifest)
      : undefined;
    if (!preferredReport) {
      return;
    }

    this.selectReport(preferredReport.attachmentName, {
      clearViewerError: true,
      pushHistory,
    });
  }

  /**
   * Applies the height reported by the embedded report frame.
   *
   * @param {string} attachmentName - Report attachment name associated with the iframe.
   * @param {number} frameHeight - Height reported by the embedded document.
   * @returns {void} Does not return a value.
   */
  private updateFrameHeight(attachmentName: string, frameHeight: number): void {
    if (
      !attachmentName ||
      !Number.isFinite(frameHeight) ||
      attachmentName !== this.state.selectedReportAttachmentName
    ) {
      return;
    }

    const frame = Array.from(
      document.querySelectorAll(`iframe[${INTERNAL_REPORT_FRAME_ATTRIBUTE}]`),
    ).find(
      (candidate) =>
        candidate.getAttribute(INTERNAL_REPORT_FRAME_ATTRIBUTE) ===
        attachmentName,
    ) as HTMLIFrameElement | undefined;

    if (!frame) {
      return;
    }

    // Reports control their own content height, the host only applies it.
    frame.style.height = `${Math.max(
      MIN_REPORT_FRAME_HEIGHT,
      Math.ceil(frameHeight),
    )}px`;
    frame.style.visibility = 'visible';
  }

  /**
   * Shows a not-found empty state in the report viewer.
   *
   * @param {string} title - Short title displayed in the empty state.
   * @param {string} details - Additional context about the missing page.
   * @returns {void} Does not return a value.
   */
  private showNotFound(title: string, details: string): void {
    this.setState({
      viewerErrorHtml: formatNotFoundHtml(title, details),
    });
  }

  /**
   * Handles postMessage events emitted by embedded report frames.
   *
   * @param {MessageEvent} event - Browser message event raised by the iframe.
   * @returns {void} Does not return a value.
   */
  private handleEmbeddedReportMessage = (event: MessageEvent): void => {
    const data = event.data as EmbeddedReportMessage | undefined;
    if (!data?.type) {
      return;
    }

    if (data.type === INTERNAL_REPORT_LINK_CLICK_MESSAGE) {
      this.runAnalyticsTask(this.trackEmbeddedLinkClick(data));
      return;
    }

    if (data.type === INTERNAL_REPORT_HEIGHT_MESSAGE) {
      this.handleEmbeddedHeightMessage(data);
      return;
    }

    if (data.type !== INTERNAL_REPORT_NAVIGATION_MESSAGE) {
      return;
    }

    this.handleEmbeddedNavigationMessage(data);
  };

  /**
   * Applies iframe resize messages emitted by embedded reports.
   *
   * @param {EmbeddedReportMessage} data - Parsed iframe message payload.
   * @returns {void} Does not return a value.
   */
  private handleEmbeddedHeightMessage(data: EmbeddedReportMessage): void {
    if (!data.attachmentName || typeof data.height !== 'number') {
      return;
    }

    this.updateFrameHeight(data.attachmentName, data.height);
  }

  /**
   * Applies iframe navigation messages emitted by embedded reports.
   *
   * @param {EmbeddedReportMessage} data - Parsed iframe message payload.
   * @returns {void} Does not return a value.
   */
  private handleEmbeddedNavigationMessage(data: EmbeddedReportMessage): void {
    if (!data.attachmentName && !data.missingTarget) {
      return;
    }

    if (data.missingTarget) {
      this.handleMissingEmbeddedTarget(data.missingTarget);
      return;
    }

    const attachmentName = data.attachmentName;
    if (!attachmentName) {
      return;
    }

    if (!this.handleEmbeddedReportNavigation(attachmentName)) {
      return;
    }

    this.handleEmbeddedAttachmentNavigation(attachmentName);
  }

  /**
   * Applies a missing-link message emitted by the embedded report.
   *
   * @param {string} missingTarget - Raw internal target that could not be resolved.
   * @returns {void} Does not return a value.
   */
  private handleMissingEmbeddedTarget(missingTarget: string): void {
    this.runAnalyticsTask(
      this.trackNavigationFailure(
        'missing_link',
        'internal_link',
        missingTarget,
      ),
    );
    this.showNotFound(
      'Page not found',
      `The requested link "${missingTarget}" was not found in the published report.`,
    );
  }

  /**
   * Applies a valid embedded navigation request emitted by the report iframe.
   *
   * @param {string} attachmentName - Report attachment requested by the embedded report.
   * @returns {void} Does not return a value.
   */
  private handleEmbeddedAttachmentNavigation(attachmentName: string): void {
    this.runAnalyticsTask(
      this.trackReportTabSelected(
        attachmentName,
        this.props.attachmentClient.hasManifestMode() ? 'report' : 'legacy',
        'internal_link',
      ),
    );
    this.selectReport(attachmentName, {
      clearViewerError: true,
      pushHistory: true,
    });
  }

  /**
   * Validates embedded report navigation against the current mode.
   *
   * @param {string} attachmentName - Report attachment requested by the embedded frame.
   * @returns {boolean} `true` when the requested report exists in the current mode.
   */
  private handleEmbeddedReportNavigation(attachmentName: string): boolean {
    const manifest = this.getSelectedManifest();
    if (!manifest) {
      if (this.hasLegacyAttachment(attachmentName)) {
        return true;
      }

      this.showMissingLegacyReport(attachmentName, 'internal_link');
      return false;
    }

    const linkedEntry = findManifestEntryByAttachmentName(
      manifest,
      attachmentName,
    );
    if (linkedEntry?.isHtml) {
      return true;
    }

    this.showMissingManifestReport(attachmentName, 'internal_link');
    return false;
  }

  /**
   * Indicates whether a legacy report attachment exists for the current build.
   *
   * @param {string} attachmentName - Legacy report attachment name to validate.
   * @returns {boolean} `true` when the attachment exists.
   */
  private hasLegacyAttachment(attachmentName: string): boolean {
    return this.props.attachmentClient
      .getLegacyAttachments()
      .some((attachment) => attachment.name === attachmentName);
  }

  /**
   * Shows a not-found state for a missing manifest-driven report page.
   *
   * @param {string} attachmentName - Report attachment that could not be resolved.
   * @returns {void} Does not return a value.
   */
  private showMissingManifestReport(
    attachmentName: string,
    navigationSource: AnalyticsNavigationSource = 'restore',
  ): void {
    this.runAnalyticsTask(
      this.trackNavigationFailure(
        'missing_report',
        navigationSource,
        attachmentName,
      ),
    );
    this.showNotFound(
      'Page not found',
      `The requested report page "${attachmentName}" does not exist in this tab.`,
    );
    this.runAnalyticsTask(this.trackOpenedViewIfNeeded());
  }

  /**
   * Shows a not-found state for a missing legacy report page.
   *
   * @param {string} attachmentName - Report attachment that could not be resolved.
   * @returns {void} Does not return a value.
   */
  private showMissingLegacyReport(
    attachmentName: string,
    navigationSource: AnalyticsNavigationSource = 'restore',
  ): void {
    this.runAnalyticsTask(
      this.trackNavigationFailure(
        'missing_report',
        navigationSource,
        attachmentName,
      ),
    );
    this.showNotFound(
      'Page not found',
      `The requested report page "${attachmentName}" was not found.`,
    );
    this.runAnalyticsTask(this.trackOpenedViewIfNeeded());
  }

  /**
   * Downloads the archive associated with the selected summary tab.
   *
   * @returns {Promise<void>} Resolves when the download has been triggered.
   */
  private handleDownloadArchive = async (): Promise<void> => {
    const downloadAll = this.getSelectedManifest()?.downloadAll;
    if (!downloadAll) {
      return;
    }

    this.runAnalyticsTask(this.trackDownloadClick());

    try {
      await this.props.attachmentClient.downloadReportArchive(
        downloadAll.attachmentName,
        downloadAll.fileName,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.runAnalyticsTask(
        this.trackDownloadFailure(normalizeErrorKind(error)),
      );
      window.alert(`Unable to download tab content archive: ${message}`);
    }
  };

  /**
   * Handles summary tab selection changes.
   *
   * @param {string} summaryAttachmentName - Newly selected summary attachment name.
   * @returns {void} Does not return a value.
   */
  private handleSummaryTabChange = (summaryAttachmentName: string): void => {
    const isReselectedTab =
      this.state.selectedSummaryAttachmentName === summaryAttachmentName;

    this.runAnalyticsTask(this.trackSummaryTabSelected(summaryAttachmentName));
    this.setState(
      {
        selectedSummaryAttachmentName: summaryAttachmentName,
        viewerErrorHtml: undefined,
        viewerWarningMessage: undefined,
      },
      () => {
        const loadManifestPromise = this.loadManifest(summaryAttachmentName);
        if (isReselectedTab) {
          // Reselecting a summary tab acts like "go back to the first page".
          void loadManifestPromise
            .then(() => {
              this.navigateToFirstReport(true);
            })
            .catch(() => {
              return;
            });
        }
      },
    );
  };

  /**
   * Handles report tab selection changes in manifest mode.
   *
   * @param {string} reportAttachmentName - Newly selected report attachment name.
   * @returns {void} Does not return a value.
   */
  private handleReportTabChange = (reportAttachmentName: string): void => {
    this.runAnalyticsTask(
      this.trackReportTabSelected(reportAttachmentName, 'report', 'click'),
    );
    this.selectReport(reportAttachmentName, {
      clearViewerError: true,
      pushHistory: true,
    });
  };

  /**
   * Handles report tab selection changes in legacy mode.
   *
   * @param {string} reportAttachmentName - Newly selected report attachment name.
   * @returns {void} Does not return a value.
   */
  private handleLegacyTabChange = (reportAttachmentName: string): void => {
    this.runAnalyticsTask(
      this.trackReportTabSelected(reportAttachmentName, 'legacy', 'click'),
    );
    this.selectReport(reportAttachmentName, {
      clearViewerError: true,
      pushHistory: true,
    });
  };

  /**
   * Reapplies hash-based navigation when the browser hash changes.
   *
   * @returns {void} Does not return a value.
   */
  private handleLocationHashChanged = (): void => {
    this.navigateToHashedReport();
  };

  /**
   * Reapplies hash-based navigation when browser history changes.
   *
   * @returns {void} Does not return a value.
   */
  private handleHistoryChanged = (): void => {
    this.navigateToHashedReport();
  };

  /**
   * Navigates back to the preferred landing report for the current mode.
   *
   * @returns {void} Does not return a value.
   */
  private handleOpenFirstReport = (): void => {
    this.navigateToFirstReport(true);
  };
}
