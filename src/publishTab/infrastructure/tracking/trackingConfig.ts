import { MARKETPLACE_URL } from '../../constants';

/**
 * Defines the runtime configuration used by the tracking adapter.
 */
export interface TrackingConfig {
  apiKey?: string;
  enabled: boolean;
  pageLocation: string;
  pagePath: string;
  pageTitle: string;
}

const AMPLITUDE_API_KEY = '567223ab6a82bb3623777936d0a74af1';

/**
 * Builds the PublishTab tracking configuration from static defaults.
 *
 * @returns {TrackingConfig} Tracking configuration for the current bundle.
 */
export function createTrackingConfig(): TrackingConfig {
  const apiKey = AMPLITUDE_API_KEY.trim();

  return {
    apiKey: apiKey || undefined,
    enabled: !!apiKey,
    pageLocation: MARKETPLACE_URL,
    pagePath: '/publish-html-tab',
    pageTitle: 'PublishHtmlTab',
  };
}
