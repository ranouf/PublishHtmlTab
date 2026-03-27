import { AnalyticsTracker } from '../../domain/analytics';

/**
 * Discards analytics events when tracking is disabled or unavailable.
 */
export class NoopAnalyticsTracker implements AnalyticsTracker {
  /**
   * Ignores the provided event.
   *
   * @param {AnalyticsEvent} _event - Analytics event intentionally ignored.
   * @returns {Promise<void>} Immediately resolved promise.
   */
  public async track(): Promise<void> {
    return Promise.resolve();
  }
}
