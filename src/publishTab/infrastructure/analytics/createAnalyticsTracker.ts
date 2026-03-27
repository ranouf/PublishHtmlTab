import { AnalyticsTracker } from '../../domain/analytics';
import { createAnalyticsConfig } from './analyticsConfig';
import { GoogleAnalyticsTracker } from './GoogleAnalyticsTracker';
import { NoopAnalyticsTracker } from './noopAnalyticsTracker';

/**
 * Creates the PublishTab analytics adapter for the current runtime.
 *
 * @returns {AnalyticsTracker} Google Analytics adapter or a safe no-op implementation.
 */
export function createAnalyticsTracker(): AnalyticsTracker {
  const config = createAnalyticsConfig();
  return config.enabled
    ? new GoogleAnalyticsTracker(config)
    : new NoopAnalyticsTracker();
}
