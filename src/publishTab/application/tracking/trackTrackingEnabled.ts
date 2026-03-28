import {
  trackingEvents,
  TrackingEnabledEvent,
  TrackingPort,
} from '../../domain/tracking';

/**
 * Sends the tracking-enabled event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {TrackingEnabledEvent} payload - Strict payload for the tracking-enabled event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackTrackingEnabled(
  tracker: TrackingPort,
  payload: TrackingEnabledEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.trackingEnabled,
    payload,
  });
}
