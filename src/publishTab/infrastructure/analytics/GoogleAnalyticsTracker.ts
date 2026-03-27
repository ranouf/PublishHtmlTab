import {
  AnalyticsEvent,
  AnalyticsTracker,
  analyticsEvents,
} from '../../domain/analytics';
import { AnalyticsConfig } from './analyticsConfig';

type GoogleAnalyticsCommand = (...args: unknown[]) => void;
type GoogleAnalyticsParams = Record<string, boolean | number | string>;
type GoogleAnalyticsEventMapper = (
  event: AnalyticsEvent,
) => GoogleAnalyticsParams;

interface GoogleAnalyticsWindow extends Window {
  dataLayer?: unknown[];
  doNotTrack?: string;
  gtag?: GoogleAnalyticsCommand;
}

const GOOGLE_ANALYTICS_SCRIPT_ID = 'publish-html-tab-ga-script';
const EVENT_MAPPERS: Record<
  AnalyticsEvent['name'],
  GoogleAnalyticsEventMapper
> = {
  [analyticsEvents.publishTabDownloadClicked]: (event) =>
    mapDownloadClickedEvent(
      event as AnalyticsEvent<typeof analyticsEvents.publishTabDownloadClicked>,
    ),
  [analyticsEvents.publishTabDownloadFailed]: (event) =>
    mapDownloadFailedEvent(
      event as AnalyticsEvent<typeof analyticsEvents.publishTabDownloadFailed>,
    ),
  [analyticsEvents.publishTabLinkClicked]: (event) =>
    mapLinkClickedEvent(
      event as AnalyticsEvent<typeof analyticsEvents.publishTabLinkClicked>,
    ),
  [analyticsEvents.publishTabNavigationFailed]: (event) =>
    mapNavigationFailedEvent(
      event as AnalyticsEvent<
        typeof analyticsEvents.publishTabNavigationFailed
      >,
    ),
  [analyticsEvents.publishTabOpened]: (event) =>
    mapOpenedEvent(
      event as AnalyticsEvent<typeof analyticsEvents.publishTabOpened>,
    ),
  [analyticsEvents.publishTabSelected]: (event) =>
    mapSelectedEvent(
      event as AnalyticsEvent<typeof analyticsEvents.publishTabSelected>,
    ),
};

/**
 * Sends PublishTab events to Google Analytics while keeping the host page opaque.
 */
export class GoogleAnalyticsTracker implements AnalyticsTracker {
  private isInitialized = false;
  private readonly documentRef: Document;
  private readonly windowRef: GoogleAnalyticsWindow;

  /**
   * Creates a Google Analytics tracker adapter.
   *
   * @param {AnalyticsConfig} config - Runtime analytics configuration.
   * @param {Document} [documentRef=document] - Document used to inject the GA script.
   * @param {GoogleAnalyticsWindow} [windowRef=window] - Window used to access `gtag`.
   */
  constructor(
    private readonly config: AnalyticsConfig,
    documentRef: Document = document,
    windowRef: GoogleAnalyticsWindow = window as GoogleAnalyticsWindow,
  ) {
    this.documentRef = documentRef;
    this.windowRef = windowRef;
  }

  /**
   * Sends one typed PublishTab event to Google Analytics.
   *
   * @param {AnalyticsEvent} event - Strict analytics event collected by the feature.
   * @returns {Promise<void>} Resolves when the event has been queued or ignored.
   */
  public async track(event: AnalyticsEvent): Promise<void> {
    if (!this.canTrack()) {
      return;
    }

    try {
      this.initializeIfNeeded();
      this.windowRef.gtag?.(
        'event',
        event.name,
        mapGoogleAnalyticsEvent(event),
      );
    } catch {
      return;
    }
  }

  /**
   * Indicates whether Google Analytics should currently receive events.
   *
   * @returns {boolean} `true` when tracking is enabled and the user did not opt out.
   */
  private canTrack(): boolean {
    return this.config.enabled && !isDoNotTrackEnabled(this.windowRef);
  }

  /**
   * Lazily initializes the global `gtag` queue and script tag.
   *
   * @returns {void} Does not return a value.
   */
  private initializeIfNeeded(): void {
    if (this.isInitialized || !this.config.measurementId) {
      return;
    }

    initializeGlobalTag(this.windowRef);
    injectGoogleAnalyticsScript(this.documentRef, this.config.measurementId);
    this.windowRef.gtag?.('js', new Date());
    this.windowRef.gtag?.(
      'config',
      this.config.measurementId,
      createGoogleAnalyticsConfig(this.config),
    );
    this.isInitialized = true;
  }
}

/**
 * Maps one typed PublishTab event to the whitelist of GA event parameters.
 *
 * @param {AnalyticsEvent} event - Strict PublishTab analytics event.
 * @returns {GoogleAnalyticsParams} Flat GA event parameters safe to send.
 */
export function mapGoogleAnalyticsEvent(
  event: AnalyticsEvent,
): GoogleAnalyticsParams {
  return getEventMapper(event.name)(event);
}

/**
 * Maps the shared analytics context to Google Analytics parameter names.
 *
 * @param {AnalyticsEvent} event - Strict PublishTab analytics event.
 * @returns {GoogleAnalyticsParams} Common GA event parameters.
 */
function mapCommonParams(event: AnalyticsEvent): GoogleAnalyticsParams {
  return {
    build_id: event.payload.buildId,
    extension_version: event.payload.extensionVersion,
    mode: event.payload.mode,
  };
}

/**
 * Returns the mapper associated with one PublishTab analytics event.
 *
 * @param {AnalyticsEvent['name']} eventName - Event name that needs a GA payload.
 * @returns {GoogleAnalyticsEventMapper} Mapper responsible for the event payload.
 */
function getEventMapper(
  eventName: AnalyticsEvent['name'],
): GoogleAnalyticsEventMapper {
  return EVENT_MAPPERS[eventName];
}

/**
 * Maps the opened event to Google Analytics parameters.
 *
 * @param {AnalyticsEvent<typeof analyticsEvents.publishTabOpened>} event - Typed opened event.
 * @returns {GoogleAnalyticsParams} Whitelisted GA parameters.
 */
function mapOpenedEvent(
  event: AnalyticsEvent<typeof analyticsEvents.publishTabOpened>,
): GoogleAnalyticsParams {
  return {
    ...mapCommonParams(event),
    has_download: event.payload.hasDownload,
    manifest_size_bucket: event.payload.manifestSizeBucket,
    page_count: event.payload.pageCount,
    tab_count: event.payload.tabCount,
    target_path_hash: event.payload.targetPathHash,
  };
}

/**
 * Maps the selected event to Google Analytics parameters.
 *
 * @param {AnalyticsEvent<typeof analyticsEvents.publishTabSelected>} event - Typed selected event.
 * @returns {GoogleAnalyticsParams} Whitelisted GA parameters.
 */
function mapSelectedEvent(
  event: AnalyticsEvent<typeof analyticsEvents.publishTabSelected>,
): GoogleAnalyticsParams {
  return {
    ...mapCommonParams(event),
    navigation_source: event.payload.navigationSource,
    tab_count: event.payload.tabCount,
    tab_index: event.payload.tabIndex,
    tab_type: event.payload.tabType,
    target_path_hash: event.payload.targetPathHash,
    time_before_tab_change_ms: event.payload.timeBeforeTabChangeMs,
  };
}

/**
 * Maps the download-clicked event to Google Analytics parameters.
 *
 * @param {AnalyticsEvent<typeof analyticsEvents.publishTabDownloadClicked>} event - Typed download-clicked event.
 * @returns {GoogleAnalyticsParams} Whitelisted GA parameters.
 */
function mapDownloadClickedEvent(
  event: AnalyticsEvent<typeof analyticsEvents.publishTabDownloadClicked>,
): GoogleAnalyticsParams {
  return {
    ...mapCommonParams(event),
    download_type: event.payload.downloadType,
    has_download: event.payload.hasDownload,
    tab_index: event.payload.tabIndex,
    tab_type: event.payload.tabType,
    time_before_interaction_ms: event.payload.timeBeforeInteractionMs,
  };
}

/**
 * Maps the download-failed event to Google Analytics parameters.
 *
 * @param {AnalyticsEvent<typeof analyticsEvents.publishTabDownloadFailed>} event - Typed download-failed event.
 * @returns {GoogleAnalyticsParams} Whitelisted GA parameters.
 */
function mapDownloadFailedEvent(
  event: AnalyticsEvent<typeof analyticsEvents.publishTabDownloadFailed>,
): GoogleAnalyticsParams {
  return {
    ...mapCommonParams(event),
    download_type: event.payload.downloadType,
    error_kind: event.payload.errorKind,
    has_download: event.payload.hasDownload,
    tab_index: event.payload.tabIndex,
    tab_type: event.payload.tabType,
    time_before_interaction_ms: event.payload.timeBeforeInteractionMs,
  };
}

/**
 * Maps the embedded-link event to Google Analytics parameters.
 *
 * @param {AnalyticsEvent<typeof analyticsEvents.publishTabLinkClicked>} event - Typed link-clicked event.
 * @returns {GoogleAnalyticsParams} Whitelisted GA parameters.
 */
function mapLinkClickedEvent(
  event: AnalyticsEvent<typeof analyticsEvents.publishTabLinkClicked>,
): GoogleAnalyticsParams {
  return {
    ...mapCommonParams(event),
    link_type: event.payload.linkType,
    target_kind: event.payload.targetKind,
    target_path_hash: event.payload.targetPathHash,
    time_before_interaction_ms: event.payload.timeBeforeInteractionMs,
  };
}

/**
 * Maps the navigation-failed event to Google Analytics parameters.
 *
 * @param {AnalyticsEvent<typeof analyticsEvents.publishTabNavigationFailed>} event - Typed navigation-failed event.
 * @returns {GoogleAnalyticsParams} Whitelisted GA parameters.
 */
function mapNavigationFailedEvent(
  event: AnalyticsEvent<typeof analyticsEvents.publishTabNavigationFailed>,
): GoogleAnalyticsParams {
  return {
    ...mapCommonParams(event),
    error_kind: event.payload.errorKind,
    navigation_source: event.payload.navigationSource,
    target_path_hash: event.payload.targetPathHash,
  };
}

/**
 * Initializes the in-page `gtag` queue used before the remote script finishes loading.
 *
 * @param {GoogleAnalyticsWindow} windowRef - Window that will host the GA globals.
 * @returns {void} Does not return a value.
 */
function initializeGlobalTag(windowRef: GoogleAnalyticsWindow): void {
  windowRef.dataLayer = windowRef.dataLayer || [];
  windowRef.gtag =
    windowRef.gtag ||
    ((...args: unknown[]) => {
      windowRef.dataLayer?.push(args);
    });
}

/**
 * Injects the Google Analytics script tag once per document.
 *
 * @param {Document} documentRef - Document that hosts the extension UI.
 * @param {string} measurementId - Google Analytics measurement ID.
 * @returns {void} Does not return a value.
 */
function injectGoogleAnalyticsScript(
  documentRef: Document,
  measurementId: string,
): void {
  if (documentRef.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) {
    return;
  }

  const scriptElement = documentRef.createElement('script');
  scriptElement.async = true;
  scriptElement.id = GOOGLE_ANALYTICS_SCRIPT_ID;
  scriptElement.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  documentRef.head.appendChild(scriptElement);
}

/**
 * Builds the static Google Analytics configuration used by PublishTab.
 *
 * @param {AnalyticsConfig} config - Runtime analytics configuration.
 * @returns {GoogleAnalyticsParams} GA config object passed to `gtag('config', ...)`.
 */
function createGoogleAnalyticsConfig(
  config: AnalyticsConfig,
): GoogleAnalyticsParams {
  return {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    anonymize_ip: true,
    page_location: config.pageLocation,
    page_path: config.pagePath,
    page_referrer: '',
    page_title: config.pageTitle,
    send_page_view: false,
  };
}

/**
 * Checks whether the browser indicates that tracking should be disabled.
 *
 * @param {GoogleAnalyticsWindow} windowRef - Window that exposes DNT flags.
 * @returns {boolean} `true` when Do Not Track is enabled.
 */
function isDoNotTrackEnabled(windowRef: GoogleAnalyticsWindow): boolean {
  const doNotTrackValue =
    windowRef.navigator.doNotTrack || windowRef.doNotTrack || '';
  return doNotTrackValue === '1' || doNotTrackValue.toLowerCase() === 'yes';
}
