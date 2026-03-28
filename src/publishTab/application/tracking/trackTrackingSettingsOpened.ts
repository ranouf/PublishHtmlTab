import {
  trackingEvents,
  TrackingPort,
  TrackingSettingsOpenedEvent,
} from '../../domain/tracking';

/**
 * Sends the settings-opened event through the tracking port.
 *
 * @param {TrackingPort} tracker - Tracking adapter used by the feature.
 * @param {TrackingSettingsOpenedEvent} payload - Strict payload for the settings-opened event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackTrackingSettingsOpened(
  tracker: TrackingPort,
  payload: TrackingSettingsOpenedEvent,
): Promise<void> {
  return tracker.track({
    name: trackingEvents.trackingSettingsOpened,
    payload,
  });
}
