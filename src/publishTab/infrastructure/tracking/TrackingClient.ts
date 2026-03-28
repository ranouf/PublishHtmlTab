import {
  TrackingEvent,
  TrackingPermissionDecision,
  TrackingPort,
  trackingEvents,
} from '../../domain/tracking';
import { getTrackingPermissionDecision } from './trackingPermission';
import { TrackingConfig } from './trackingConfig';

type TrackingParams = Record<string, boolean | number | string>;
type TrackingEventMapper = (event: TrackingEvent) => TrackingParams;

interface AmplitudeEvent {
  app_version: string;
  device_id: string;
  event_properties: TrackingParams;
  event_type: TrackingEvent['name'];
  insert_id: string;
  platform: string;
  time: number;
}

interface TrackingNavigator {
  doNotTrack?: string;
  sendBeacon?: (url: string | URL, data?: BodyInit | null) => boolean;
}

interface TrackingWindow {
  localStorage?: Storage;
  navigator: TrackingNavigator;
  fetch?: typeof fetch;
}

const AMPLITUDE_HTTP_API_URL = 'https://api2.amplitude.com/2/httpapi';
const DEVICE_ID_STORAGE_KEY = 'publish-html-tab.tracking.device-id';
const EXTENSION_PLATFORM = 'Azure DevOps Extension';
const EVENT_MAPPERS: Record<TrackingEvent['name'], TrackingEventMapper> = {
  [trackingEvents.publishTabDownloadClicked]: (event) =>
    mapDownloadClickedEvent(
      event as TrackingEvent<typeof trackingEvents.publishTabDownloadClicked>,
    ),
  [trackingEvents.publishTabDownloadFailed]: (event) =>
    mapDownloadFailedEvent(
      event as TrackingEvent<typeof trackingEvents.publishTabDownloadFailed>,
    ),
  [trackingEvents.publishTabLinkClicked]: (event) =>
    mapLinkClickedEvent(
      event as TrackingEvent<typeof trackingEvents.publishTabLinkClicked>,
    ),
  [trackingEvents.publishTabNavigationFailed]: (event) =>
    mapNavigationFailedEvent(
      event as TrackingEvent<typeof trackingEvents.publishTabNavigationFailed>,
    ),
  [trackingEvents.publishTabOpened]: (event) =>
    mapOpenedEvent(
      event as TrackingEvent<typeof trackingEvents.publishTabOpened>,
    ),
  [trackingEvents.publishTabSelected]: (event) =>
    mapSelectedEvent(
      event as TrackingEvent<typeof trackingEvents.publishTabSelected>,
    ),
  [trackingEvents.trackingDisabled]: (event) =>
    mapSettingsPreferenceEvent(
      event as TrackingEvent<typeof trackingEvents.trackingDisabled>,
    ),
  [trackingEvents.trackingEnabled]: (event) =>
    mapSettingsPreferenceEvent(
      event as TrackingEvent<typeof trackingEvents.trackingEnabled>,
    ),
  [trackingEvents.trackingErrorOccurred]: (event) =>
    mapTrackingErrorOccurredEvent(
      event as TrackingEvent<typeof trackingEvents.trackingErrorOccurred>,
    ),
  [trackingEvents.trackingSettingsOpened]: (event) =>
    mapSettingsOpenedEvent(
      event as TrackingEvent<typeof trackingEvents.trackingSettingsOpened>,
    ),
};

/**
 * Sends PublishTab events to Amplitude while keeping the host page opaque.
 */
export class TrackingClient implements TrackingPort {
  private deviceId?: string;
  private isInitialized = false;
  private readonly organizationTrackingEnabled: boolean;
  private readonly windowRef: TrackingWindow;

  /**
   * Creates an Amplitude tracking adapter.
   *
   * @param {TrackingConfig} config - Runtime tracking configuration.
   * @param {boolean} organizationTrackingEnabled - Organization-level setting controlling tracking.
   * @param {TrackingWindow} [windowRef=window] - Window used to access browser networking and storage APIs.
   */
  constructor(
    private readonly config: TrackingConfig,
    organizationTrackingEnabled: boolean,
    windowRef: TrackingWindow = window as unknown as TrackingWindow,
  ) {
    this.organizationTrackingEnabled = organizationTrackingEnabled;
    this.windowRef = windowRef;
  }

  /**
   * Sends one typed PublishTab event to Amplitude.
   *
   * @param {TrackingEvent} event - Strict tracking event collected by the feature.
   * @returns {Promise<void>} Resolves when the event has been queued or ignored.
   */
  public async track(event: TrackingEvent): Promise<void> {
    const permission = this.getPermissionDecision();
    if (!permission.allowed) {
      return;
    }

    try {
      this.initializeIfNeeded();
      if (!this.isInitialized) {
        return;
      }

      const amplitudeEvent = createAmplitudeEvent(
        event,
        this.config,
        this.deviceId,
      );
      const requestBody = createAmplitudeRequestBody(
        this.config.apiKey,
        amplitudeEvent,
      );

      this.sendAmplitudeRequest(requestBody);
    } catch {
      return;
    }
  }

  /**
   * Evaluates the current tracking permission decision.
   *
   * @returns {TrackingPermissionDecision} Current permission decision.
   */
  private getPermissionDecision(): TrackingPermissionDecision {
    return getTrackingPermissionDecision(
      this.organizationTrackingEnabled,
      this.config.enabled,
      this.windowRef as unknown as Window,
    );
  }

  /**
   * Lazily initializes the local tracking identifiers required by Amplitude.
   *
   * @returns {void} Does not return a value.
   */
  private initializeIfNeeded(): void {
    if (this.isInitialized || !this.config.apiKey) {
      return;
    }

    this.deviceId = getOrCreateDeviceId(this.windowRef.localStorage);
    this.isInitialized = true;
  }

  /**
   * Sends one Amplitude HTTP V2 request.
   *
   * @param {string} requestBody - Serialized Measurement Protocol body.
   * @returns {void} Does not return a value.
   */
  private sendAmplitudeRequest(requestBody: string): void {
    if (!this.config.apiKey) {
      return;
    }

    const fetchPromise = this.windowRef.fetch?.(AMPLITUDE_HTTP_API_URL, {
      body: requestBody,
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      keepalive: true,
      method: 'POST',
    });

    if (fetchPromise) {
      fetchPromise.catch(() => {
        this.sendAmplitudeBeacon(requestBody);
      });
      return;
    }

    this.sendAmplitudeBeacon(requestBody);
  }

  /**
   * Sends one Amplitude request with `sendBeacon` when available.
   *
   * @param {string} requestBody - Serialized Amplitude body.
   * @returns {void} Does not return a value.
   */
  private sendAmplitudeBeacon(requestBody: string): void {
    const requestBlob = new Blob([requestBody], {
      type: 'application/json',
    });

    this.windowRef.navigator.sendBeacon?.(AMPLITUDE_HTTP_API_URL, requestBlob);
  }
}

/**
 * Maps one typed PublishTab event to the whitelist of tracking event properties.
 *
 * @param {TrackingEvent} event - Strict PublishTab tracking event.
 * @returns {TrackingParams} Flat tracking event properties safe to send.
 */
export function mapTrackingEvent(event: TrackingEvent): TrackingParams {
  return getEventMapper(event.name)(event);
}

/**
 * Maps the shared tracking context to common event properties.
 *
 * @param {TrackingEvent} event - Strict PublishTab tracking event.
 * @returns {TrackingParams} Common tracking event properties.
 */
function mapCommonParams(
  event: TrackingEvent<
    | typeof trackingEvents.publishTabDownloadClicked
    | typeof trackingEvents.publishTabDownloadFailed
    | typeof trackingEvents.publishTabLinkClicked
    | typeof trackingEvents.publishTabNavigationFailed
    | typeof trackingEvents.publishTabOpened
    | typeof trackingEvents.publishTabSelected
  >,
): TrackingParams {
  return {
    build_id: event.payload.buildId,
    extension_version: event.payload.extensionVersion,
    mode: event.payload.mode,
  };
}

/**
 * Maps the shared settings tracking context to common event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.trackingDisabled | typeof trackingEvents.trackingEnabled | typeof trackingEvents.trackingErrorOccurred | typeof trackingEvents.trackingSettingsOpened>} event - Strict settings tracking event.
 * @returns {TrackingParams} Common settings tracking event properties.
 */
function mapSettingsCommonParams(
  event: TrackingEvent<
    | typeof trackingEvents.trackingDisabled
    | typeof trackingEvents.trackingEnabled
    | typeof trackingEvents.trackingErrorOccurred
    | typeof trackingEvents.trackingSettingsOpened
  >,
): TrackingParams {
  return {
    extension_version: event.payload.extensionVersion,
    scope: event.payload.scope,
    source: event.payload.source,
  };
}

/**
 * Returns the mapper associated with one PublishTab tracking event.
 *
 * @param {TrackingEvent['name']} eventName - Event name that needs an event payload.
 * @returns {TrackingEventMapper} Mapper responsible for the event payload.
 */
function getEventMapper(eventName: TrackingEvent['name']): TrackingEventMapper {
  return EVENT_MAPPERS[eventName];
}

/**
 * Maps the opened event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.publishTabOpened>} event - Typed opened event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapOpenedEvent(
  event: TrackingEvent<typeof trackingEvents.publishTabOpened>,
): TrackingParams {
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
 * Maps the selected event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.publishTabSelected>} event - Typed selected event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapSelectedEvent(
  event: TrackingEvent<typeof trackingEvents.publishTabSelected>,
): TrackingParams {
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
 * Maps the download-clicked event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.publishTabDownloadClicked>} event - Typed download-clicked event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapDownloadClickedEvent(
  event: TrackingEvent<typeof trackingEvents.publishTabDownloadClicked>,
): TrackingParams {
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
 * Maps the download-failed event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.publishTabDownloadFailed>} event - Typed download-failed event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapDownloadFailedEvent(
  event: TrackingEvent<typeof trackingEvents.publishTabDownloadFailed>,
): TrackingParams {
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
 * Maps the embedded-link event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.publishTabLinkClicked>} event - Typed link-clicked event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapLinkClickedEvent(
  event: TrackingEvent<typeof trackingEvents.publishTabLinkClicked>,
): TrackingParams {
  return {
    ...mapCommonParams(event),
    link_type: event.payload.linkType,
    target_kind: event.payload.targetKind,
    target_path_hash: event.payload.targetPathHash,
    time_before_interaction_ms: event.payload.timeBeforeInteractionMs,
  };
}

/**
 * Maps the navigation-failed event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.publishTabNavigationFailed>} event - Typed navigation-failed event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapNavigationFailedEvent(
  event: TrackingEvent<typeof trackingEvents.publishTabNavigationFailed>,
): TrackingParams {
  return {
    ...mapCommonParams(event),
    error_kind: event.payload.errorKind,
    navigation_source: event.payload.navigationSource,
    target_path_hash: event.payload.targetPathHash,
  };
}

/**
 * Maps the settings-opened event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.trackingSettingsOpened>} event - Typed settings-opened event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapSettingsOpenedEvent(
  event: TrackingEvent<typeof trackingEvents.trackingSettingsOpened>,
): TrackingParams {
  return mapSettingsCommonParams(event);
}

/**
 * Maps the tracking-enabled and tracking-disabled events to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.trackingEnabled | typeof trackingEvents.trackingDisabled>} event - Typed settings preference event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapSettingsPreferenceEvent(
  event: TrackingEvent<
    | typeof trackingEvents.trackingEnabled
    | typeof trackingEvents.trackingDisabled
  >,
): TrackingParams {
  return mapSettingsCommonParams(event);
}

/**
 * Maps the sanitized tracking error event to event properties.
 *
 * @param {TrackingEvent<typeof trackingEvents.trackingErrorOccurred>} event - Typed sanitized tracking error event.
 * @returns {TrackingParams} Whitelisted event properties.
 */
function mapTrackingErrorOccurredEvent(
  event: TrackingEvent<typeof trackingEvents.trackingErrorOccurred>,
): TrackingParams {
  return {
    ...mapSettingsCommonParams(event),
    error_kind: event.payload.errorKind,
    operation: event.payload.operation,
    surface: event.payload.surface,
  };
}

/**
 * Builds one Amplitude event from a typed PublishTab event.
 *
 * @param {TrackingEvent} event - Typed event to map.
 * @param {TrackingConfig} config - Runtime tracking configuration.
 * @param {string | undefined} deviceId - Stable anonymous device id.
 * @returns {AmplitudeEvent} Serialized Amplitude event.
 */
function createAmplitudeEvent(
  event: TrackingEvent,
  config: TrackingConfig,
  deviceId: string | undefined,
): AmplitudeEvent {
  const eventProperties = {
    ...mapTrackingEvent(event),
    page_location: config.pageLocation,
    page_path: config.pagePath,
    page_title: config.pageTitle,
  };

  return {
    app_version: event.payload.extensionVersion,
    device_id: deviceId || getOrCreateDeviceId(),
    event_properties: eventProperties,
    event_type: event.name,
    insert_id: createInsertId(event.name),
    platform: EXTENSION_PLATFORM,
    time: Date.now(),
  };
}

/**
 * Serializes one Amplitude HTTP V2 payload for a single event.
 *
 * @param {string | undefined} apiKey - Amplitude API key.
 * @param {AmplitudeEvent} event - Serialized Amplitude event.
 * @returns {string} Serialized request body.
 */
function createAmplitudeRequestBody(
  apiKey: string | undefined,
  event: AmplitudeEvent,
): string {
  return JSON.stringify({
    api_key: apiKey,
    events: [event],
  });
}

/**
 * Creates a unique insert id used by Amplitude for deduplication.
 *
 * @param {TrackingEvent['name']} eventName - Event name being sent.
 * @returns {string} Insert id unique enough for client-side deduplication.
 */
function createInsertId(eventName: TrackingEvent['name']): string {
  return `${eventName}-${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
}

/**
 * Returns a stable Amplitude device id persisted in local storage when possible.
 *
 * @param {Storage} [storage] - Storage used to persist the device id.
 * @returns {string} Stable device id.
 */
function getOrCreateDeviceId(storage?: Storage): string {
  const existingDeviceId = storage?.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const generatedDeviceId = `${Date.now()}.${Math.floor(
    Math.random() * 1_000_000_000,
  )}`;
  storage?.setItem(DEVICE_ID_STORAGE_KEY, generatedDeviceId);
  return generatedDeviceId;
}
