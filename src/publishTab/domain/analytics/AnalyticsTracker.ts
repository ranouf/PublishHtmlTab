import { AnalyticsEvent } from './AnalyticsEvent';

/**
 * Defines the analytics port used by PublishTab application code.
 */
export interface AnalyticsTracker {
  /**
   * Sends one analytics event to the configured telemetry backend.
   *
   * @param {AnalyticsEvent} event - Typed analytics event to send.
   * @returns {Promise<void>} Resolves when the event has been processed.
   */
  track(event: AnalyticsEvent): Promise<void>;
}
