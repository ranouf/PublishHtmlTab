import {
  analyticsEvents,
  AnalyticsTracker,
  PublishTabNavigationFailedEvent,
} from '../../domain/analytics';

/**
 * Sends a PublishTab navigation-failure event through the analytics port.
 *
 * @param {AnalyticsTracker} tracker - Analytics tracker adapter used by the feature.
 * @param {PublishTabNavigationFailedEvent} payload - Strict payload for the navigation failure.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabNavigationFailed(
  tracker: AnalyticsTracker,
  payload: PublishTabNavigationFailedEvent,
): Promise<void> {
  return tracker.track({
    name: analyticsEvents.publishTabNavigationFailed,
    payload,
  });
}
