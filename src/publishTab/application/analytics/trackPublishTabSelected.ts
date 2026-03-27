import {
  analyticsEvents,
  AnalyticsTracker,
  PublishTabSelectedEvent,
} from '../../domain/analytics';

/**
 * Sends a PublishTab tab-selection event through the analytics port.
 *
 * @param {AnalyticsTracker} tracker - Analytics tracker adapter used by the feature.
 * @param {PublishTabSelectedEvent} payload - Strict payload for the selected event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabSelected(
  tracker: AnalyticsTracker,
  payload: PublishTabSelectedEvent,
): Promise<void> {
  return tracker.track({
    name: analyticsEvents.publishTabSelected,
    payload,
  });
}
