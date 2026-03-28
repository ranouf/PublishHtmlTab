import { TrackingEvent } from './TrackingEvent';

/**
 * Defines the tracking port used by PublishTab application code.
 */
export interface TrackingPort {
  /**
   * Sends one tracking event to the configured telemetry backend.
   *
   * @param {TrackingEvent} event - Typed tracking event to send.
   * @returns {Promise<void>} Resolves when the event has been processed.
   */
  track(event: TrackingEvent): Promise<void>;
}
