import {
  TrackingLocalOverride,
  TrackingPermissionDecision,
  evaluateTrackingPermission,
} from '../../domain/tracking';

const TRACKING_OVERRIDE_KEY = 'publish-html-tab.tracking.override';

interface TrackingPermissionWindow extends Window {
  doNotTrack?: string;
}

/**
 * Builds the runtime tracking permission decision from settings and browser preferences.
 *
 * @param {boolean} organizationTrackingEnabled - Organization-level setting persisted in Azure DevOps.
 * @param {boolean} measurementConfigured - Indicates whether a measurement id is configured.
 * @param {TrackingPermissionWindow} [windowRef=window] - Window exposing DNT and storage APIs.
 * @returns {TrackingPermissionDecision} Normalized allow/deny decision for tracking.
 */
export function getTrackingPermissionDecision(
  organizationTrackingEnabled: boolean,
  measurementConfigured: boolean,
  windowRef: TrackingPermissionWindow = window,
): TrackingPermissionDecision {
  return evaluateTrackingPermission({
    doNotTrackEnabled: isDoNotTrackEnabled(windowRef),
    localOverride: readTrackingLocalOverride(windowRef.localStorage),
    measurementConfigured,
    organizationTrackingEnabled,
  });
}

/**
 * Reads the optional local tracking override used for manual diagnostics.
 *
 * @param {Storage} [storage] - Storage that may contain a local tracking override.
 * @returns {TrackingLocalOverride} Normalized local override value.
 */
export function readTrackingLocalOverride(
  storage?: Storage,
): TrackingLocalOverride {
  const override = storage
    ?.getItem(TRACKING_OVERRIDE_KEY)
    ?.trim()
    .toLowerCase();

  if (override === 'enabled') {
    return 'enabled';
  }

  if (override === 'disabled') {
    return 'disabled';
  }

  return 'inherit';
}

/**
 * Checks whether the browser indicates that tracking should be disabled.
 *
 * @param {TrackingPermissionWindow} windowRef - Window that exposes Do Not Track flags.
 * @returns {boolean} `true` when Do Not Track is enabled.
 */
export function isDoNotTrackEnabled(
  windowRef: TrackingPermissionWindow,
): boolean {
  const doNotTrackValue =
    windowRef.navigator.doNotTrack || windowRef.doNotTrack || '';

  return doNotTrackValue === '1' || doNotTrackValue.toLowerCase() === 'yes';
}
