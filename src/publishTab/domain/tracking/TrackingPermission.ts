/**
 * Enumerates the optional local tracking override values.
 */
export type TrackingLocalOverride = 'disabled' | 'enabled' | 'inherit';

/**
 * Enumerates the normalized reasons explaining whether tracking may run.
 */
export type TrackingPermissionReason =
  | 'allowed'
  | 'do_not_track'
  | 'local_override_disabled'
  | 'measurement_missing'
  | 'organization_disabled';

/**
 * Describes the inputs used to evaluate whether tracking is allowed to run.
 */
export interface TrackingPermissionInput {
  doNotTrackEnabled: boolean;
  localOverride: TrackingLocalOverride;
  measurementConfigured: boolean;
  organizationTrackingEnabled: boolean;
}

/**
 * Describes the result of one tracking permission evaluation.
 */
export interface TrackingPermissionDecision {
  allowed: boolean;
  reason: TrackingPermissionReason;
}

/**
 * Evaluates whether tracking is allowed to run for the current session.
 *
 * @param {TrackingPermissionInput} input - Normalized settings and browser inputs.
 * @returns {TrackingPermissionDecision} Final allow/deny decision and its reason.
 */
export function evaluateTrackingPermission(
  input: TrackingPermissionInput,
): TrackingPermissionDecision {
  if (!input.measurementConfigured) {
    return { allowed: false, reason: 'measurement_missing' };
  }

  if (!input.organizationTrackingEnabled) {
    return { allowed: false, reason: 'organization_disabled' };
  }

  if (input.localOverride === 'disabled') {
    return { allowed: false, reason: 'local_override_disabled' };
  }

  if (input.doNotTrackEnabled) {
    return { allowed: false, reason: 'do_not_track' };
  }

  return { allowed: true, reason: 'allowed' };
}
