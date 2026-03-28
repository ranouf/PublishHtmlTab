import {
  trackingEvents,
  TrackingErrorOccurredEvent,
  TrackingPort,
} from '../../domain/tracking';

/**
 * Sends a sanitized tracking error event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {TrackingErrorOccurredEvent} payload - Strict payload for the sanitized tracking error event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackTrackingErrorOccurred(
  tracker: TrackingPort,
  payload: TrackingErrorOccurredEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.trackingErrorOccurred,
    payload,
  });
}
