import {
  trackingEvents,
  TrackingDisabledEvent,
  TrackingPort,
} from '../../domain/tracking';

/**
 * Sends the tracking-disabled event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {TrackingDisabledEvent} payload - Strict payload for the tracking-disabled event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackTrackingDisabled(
  tracker: TrackingPort,
  payload: TrackingDisabledEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.trackingDisabled,
    payload,
  });
}
