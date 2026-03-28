import {
  trackingEvents,
  TrackingPort,
  PublishTabOpenedEvent,
} from '../../domain/tracking';

/**
 * Sends the initial PublishTab opened event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {PublishTabOpenedEvent} payload - Strict payload for the opened event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabOpened(
  tracker: TrackingPort,
  payload: PublishTabOpenedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.publishTabOpened,
    payload,
  });
}
