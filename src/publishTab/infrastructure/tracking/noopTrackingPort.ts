import { TrackingPort } from '../../domain/tracking';

/**
 * Discards tracking events when tracking is disabled or unavailable.
 */
export class NoopTrackingPort implements TrackingPort {
  /**
   * Ignores the provided event.
   *
   * @param {TrackingEvent} _event - Tracking event intentionally ignored.
   * @returns {Promise<void>} Immediately resolved promise.
   */
  public async track(): Promise<void> {
    return Promise.resolve();
  }
}
