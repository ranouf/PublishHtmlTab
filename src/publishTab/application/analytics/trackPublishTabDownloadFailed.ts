import {
  analyticsEvents,
  AnalyticsTracker,
  PublishTabDownloadFailedEvent,
} from '../../domain/analytics';

/**
 * Sends a PublishTab download-failure event through the analytics port.
 *
 * @param {AnalyticsTracker} tracker - Analytics tracker adapter used by the feature.
 * @param {PublishTabDownloadFailedEvent} payload - Strict payload for the download failure.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabDownloadFailed(
  tracker: AnalyticsTracker,
  payload: PublishTabDownloadFailedEvent,
): Promise<void> {
  return tracker.track({
    name: analyticsEvents.publishTabDownloadFailed,
    payload,
  });
}
