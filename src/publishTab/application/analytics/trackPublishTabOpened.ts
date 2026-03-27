import {
  analyticsEvents,
  AnalyticsTracker,
  PublishTabOpenedEvent,
} from '../../domain/analytics';

/**
 * Sends the initial PublishTab opened event through the analytics port.
 *
 * @param {AnalyticsTracker} tracker - Analytics tracker adapter used by the feature.
 * @param {PublishTabOpenedEvent} payload - Strict payload for the opened event.
 * @returns {Promise<void>} Resolves when tracking completes.
 */
export function trackPublishTabOpened(
  tracker: AnalyticsTracker,
  payload: PublishTabOpenedEvent,
): Promise<void> {
  return tracker.track({
    name: analyticsEvents.publishTabOpened,
    payload,
  });
}
