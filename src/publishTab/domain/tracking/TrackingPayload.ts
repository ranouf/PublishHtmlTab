/**
 * Enumerates the rendering modes supported by PublishTab.
 */
export type TrackingMode = 'legacy' | 'manifest';

/**
 * Enumerates the tab layers that can emit a selection event.
 */
export type TrackingTabType = 'legacy' | 'report' | 'summary';

/**
 * Enumerates the navigation sources that can change the selected report.
 */
export type TrackingNavigationSource = 'click' | 'internal_link' | 'restore';

/**
 * Enumerates the supported link categories emitted from embedded reports.
 */
export type TrackingLinkType = 'external' | 'internal';

/**
 * Enumerates the supported link targets emitted from embedded reports.
 */
export type TrackingTargetKind = 'anchor' | 'asset' | 'report' | 'unknown';

/**
 * Enumerates the supported download categories tracked by PublishTab.
 */
export type TrackingDownloadType = 'archive';

/**
 * Enumerates the normalized failure reasons sent to tracking.
 */
export type TrackingErrorKind =
  | 'download_failed'
  | 'missing_link'
  | 'missing_report'
  | 'network'
  | 'unauthorized'
  | 'unknown';

/**
 * Buckets manifest sizes to avoid sending raw file counts for large reports.
 */
export type TrackingManifestSizeBucket =
  | '1'
  | '2-5'
  | '6-10'
  | '11-25'
  | '26-50'
  | '51+';

/**
 * Defines the shared metadata attached to every PublishTab tracking event.
 */
export interface BaseTrackingPayload {
  buildId: number;
  extensionVersion: string;
  mode: TrackingMode;
}

/**
 * Describes the event sent when PublishTab opens and resolves its initial view.
 */
export interface PublishTabOpenedEvent extends BaseTrackingPayload {
  hasDownload: boolean;
  manifestSizeBucket?: TrackingManifestSizeBucket;
  pageCount: number;
  tabCount: number;
  targetPathHash?: string;
}

/**
 * Describes the event sent when a user-visible tab selection changes.
 */
export interface PublishTabSelectedEvent extends BaseTrackingPayload {
  navigationSource: TrackingNavigationSource;
  tabCount: number;
  tabIndex: number;
  tabType: TrackingTabType;
  targetPathHash?: string;
  timeBeforeTabChangeMs: number;
}

/**
 * Describes the event sent when the archive download button is clicked.
 */
export interface PublishTabDownloadClickedEvent extends BaseTrackingPayload {
  downloadType: TrackingDownloadType;
  hasDownload: boolean;
  tabIndex?: number;
  tabType: 'legacy' | 'summary';
  timeBeforeInteractionMs: number;
}

/**
 * Describes the event sent when an archive download fails.
 */
export interface PublishTabDownloadFailedEvent extends PublishTabDownloadClickedEvent {
  errorKind: TrackingErrorKind;
}

/**
 * Describes the event sent when a link inside an embedded report is clicked.
 */
export interface PublishTabLinkClickedEvent extends BaseTrackingPayload {
  linkType: TrackingLinkType;
  targetKind: TrackingTargetKind;
  targetPathHash?: string;
  timeBeforeInteractionMs: number;
}

/**
 * Describes the event sent when PublishTab cannot complete a navigation request.
 */
export interface PublishTabNavigationFailedEvent extends BaseTrackingPayload {
  errorKind: TrackingErrorKind;
  navigationSource: TrackingNavigationSource;
  targetPathHash?: string;
}
