import {
  trackingEvents,
  TrackingPort,
  PublishTabNavigationFailedEvent,
} from '../../domain/tracking';

/**
 * Sends a PublishTab navigation-failure event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {PublishTabNavigationFailedEvent} payload - Strict payload for the navigation failure.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabNavigationFailed(
  tracker: TrackingPort,
  payload: PublishTabNavigationFailedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.publishTabNavigationFailed,
    payload,
  });
}
