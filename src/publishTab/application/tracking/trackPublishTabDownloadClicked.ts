import {
  trackingEvents,
  TrackingPort,
  PublishTabDownloadClickedEvent,
} from '../../domain/tracking';

/**
 * Sends a PublishTab download-click event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {PublishTabDownloadClickedEvent} payload - Strict payload for the download click.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabDownloadClicked(
  tracker: TrackingPort,
  payload: PublishTabDownloadClickedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.publishTabDownloadClicked,
    payload,
  });
}
