/**
 * Enumerates the rendering modes supported by PublishTab.
 */
export type AnalyticsMode = 'legacy' | 'manifest';

/**
 * Enumerates the tab layers that can emit a selection event.
 */
export type AnalyticsTabType = 'legacy' | 'report' | 'summary';

/**
 * Enumerates the navigation sources that can change the selected report.
 */
export type AnalyticsNavigationSource = 'click' | 'internal_link' | 'restore';

/**
 * Enumerates the supported link categories emitted from embedded reports.
 */
export type AnalyticsLinkType = 'external' | 'internal';

/**
 * Enumerates the supported link targets emitted from embedded reports.
 */
export type AnalyticsTargetKind = 'anchor' | 'asset' | 'report' | 'unknown';

/**
 * Enumerates the supported download categories tracked by PublishTab.
 */
export type AnalyticsDownloadType = 'archive';

/**
 * Enumerates the normalized failure reasons sent to analytics.
 */
export type AnalyticsErrorKind =
  | 'download_failed'
  | 'missing_link'
  | 'missing_report'
  | 'network'
  | 'unauthorized'
  | 'unknown';

/**
 * Buckets manifest sizes to avoid sending raw file counts for large reports.
 */
export type AnalyticsManifestSizeBucket =
  | '1'
  | '2-5'
  | '6-10'
  | '11-25'
  | '26-50'
  | '51+';

/**
 * Defines the shared metadata attached to every PublishTab analytics event.
 */
export interface BaseAnalyticsPayload {
  buildId: number;
  extensionVersion: string;
  mode: AnalyticsMode;
}

/**
 * Describes the event sent when PublishTab opens and resolves its initial view.
 */
export interface PublishTabOpenedEvent extends BaseAnalyticsPayload {
  hasDownload: boolean;
  manifestSizeBucket?: AnalyticsManifestSizeBucket;
  pageCount: number;
  tabCount: number;
  targetPathHash?: string;
}

/**
 * Describes the event sent when a user-visible tab selection changes.
 */
export interface PublishTabSelectedEvent extends BaseAnalyticsPayload {
  navigationSource: AnalyticsNavigationSource;
  tabCount: number;
  tabIndex: number;
  tabType: AnalyticsTabType;
  targetPathHash?: string;
  timeBeforeTabChangeMs: number;
}

/**
 * Describes the event sent when the archive download button is clicked.
 */
export interface PublishTabDownloadClickedEvent extends BaseAnalyticsPayload {
  downloadType: AnalyticsDownloadType;
  hasDownload: boolean;
  tabIndex?: number;
  tabType: 'legacy' | 'summary';
  timeBeforeInteractionMs: number;
}

/**
 * Describes the event sent when an archive download fails.
 */
export interface PublishTabDownloadFailedEvent extends PublishTabDownloadClickedEvent {
  errorKind: AnalyticsErrorKind;
}

/**
 * Describes the event sent when a link inside an embedded report is clicked.
 */
export interface PublishTabLinkClickedEvent extends BaseAnalyticsPayload {
  linkType: AnalyticsLinkType;
  targetKind: AnalyticsTargetKind;
  targetPathHash?: string;
  timeBeforeInteractionMs: number;
}

/**
 * Describes the event sent when PublishTab cannot complete a navigation request.
 */
export interface PublishTabNavigationFailedEvent extends BaseAnalyticsPayload {
  errorKind: AnalyticsErrorKind;
  navigationSource: AnalyticsNavigationSource;
  targetPathHash?: string;
}
