import {
  analyticsEvents,
  AnalyticsTracker,
  PublishTabLinkClickedEvent,
} from '../../domain/analytics';

/**
 * Sends a PublishTab embedded-link click event through the analytics port.
 *
 * @param {AnalyticsTracker} tracker - Analytics tracker adapter used by the feature.
 * @param {PublishTabLinkClickedEvent} payload - Strict payload for the clicked link.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabLinkClicked(
  tracker: AnalyticsTracker,
  payload: PublishTabLinkClickedEvent,
): Promise<void> {
  return tracker.track({
    name: analyticsEvents.publishTabLinkClicked,
    payload,
  });
}
