import { TrackingPort } from '../../domain/tracking';
import { createTrackingConfig } from './trackingConfig';
import { TrackingClient } from './TrackingClient';
import { NoopTrackingPort } from './noopTrackingPort';

/**
 * Creates the PublishTab tracking adapter for the current runtime.
 *
 * @param {boolean} organizationTrackingEnabled - Organization-level setting controlling tracking.
 * @returns {TrackingPort} Tracking adapter or a safe no-op implementation.
 */
export function createTrackingPort(
  organizationTrackingEnabled: boolean,
): TrackingPort {
  const config = createTrackingConfig();
  return config.enabled
    ? new TrackingClient(config, organizationTrackingEnabled)
    : new NoopTrackingPort();
}
