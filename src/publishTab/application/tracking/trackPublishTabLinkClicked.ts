import {
  trackingEvents,
  TrackingPort,
  PublishTabLinkClickedEvent,
} from '../../domain/tracking';

/**
 * Sends a PublishTab embedded-link click event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {PublishTabLinkClickedEvent} payload - Strict payload for the clicked link.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabLinkClicked(
  tracker: TrackingPort,
  payload: PublishTabLinkClickedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.publishTabLinkClicked,
    payload,
  });
}
