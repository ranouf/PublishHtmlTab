import { MARKETPLACE_URL } from '../../constants';

/**
 * Defines the runtime configuration used by the Google Analytics adapter.
 */
export interface AnalyticsConfig {
  enabled: boolean;
  measurementId?: string;
  pageLocation: string;
  pagePath: string;
  pageTitle: string;
}

const GOOGLE_ANALYTICS_MEASUREMENT_ID = 'G-MTELT5BK5W';

/**
 * Builds the PublishTab analytics configuration from safe static defaults.
 *
 * @returns {AnalyticsConfig} Google Analytics configuration for the current bundle.
 */
export function createAnalyticsConfig(): AnalyticsConfig {
  const measurementId = GOOGLE_ANALYTICS_MEASUREMENT_ID.trim();

  return {
    enabled: !!measurementId,
    measurementId: measurementId || undefined,
    pageLocation: MARKETPLACE_URL,
    pagePath: '/publish-html-tab',
    pageTitle: 'PublishHtmlTab',
  };
}
