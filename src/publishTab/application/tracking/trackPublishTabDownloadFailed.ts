import {
  trackingEvents,
  TrackingPort,
  PublishTabDownloadFailedEvent,
} from '../../domain/tracking';

/**
 * Sends a PublishTab download-failure event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {PublishTabDownloadFailedEvent} payload - Strict payload for the download failure.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabDownloadFailed(
  tracker: TrackingPort,
  payload: PublishTabDownloadFailedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.publishTabDownloadFailed,
    payload,
  });
}
