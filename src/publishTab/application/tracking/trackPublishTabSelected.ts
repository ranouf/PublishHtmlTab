import {
  trackingEvents,
  TrackingPort,
  PublishTabSelectedEvent,
} from '../../domain/tracking';

/**
 * Sends a PublishTab tab-selection event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {PublishTabSelectedEvent} payload - Strict payload for the selected event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabSelected(
  tracker: TrackingPort,
  payload: PublishTabSelectedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.publishTabSelected,
    payload,
  });
}
