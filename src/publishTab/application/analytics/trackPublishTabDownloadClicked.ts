import {
  analyticsEvents,
  AnalyticsTracker,
  PublishTabDownloadClickedEvent,
} from '../../domain/analytics';

/**
 * Sends a PublishTab download-click event through the analytics port.
 *
 * @param {AnalyticsTracker} tracker - Analytics tracker adapter used by the feature.
 * @param {PublishTabDownloadClickedEvent} payload - Strict payload for the download click.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabDownloadClicked(
  tracker: AnalyticsTracker,
  payload: PublishTabDownloadClickedEvent,
): Promise<void> {
  return tracker.track({
    name: analyticsEvents.publishTabDownloadClicked,
    payload,
  });
}
