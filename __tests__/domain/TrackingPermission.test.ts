import { evaluateTrackingPermission } from '../../src/publishTab/domain/tracking';

describe('evaluateTrackingPermission', () => {
  it('blocks tracking when the organization setting disables it', () => {
    expect(
      evaluateTrackingPermission({
        doNotTrackEnabled: false,
        localOverride: 'inherit',
        measurementConfigured: true,
        organizationTrackingEnabled: false,
      }),
    ).toEqual({
      allowed: false,
      reason: 'organization_disabled',
    });
  });

  it('blocks tracking when the local override disables it', () => {
    expect(
      evaluateTrackingPermission({
        doNotTrackEnabled: false,
        localOverride: 'disabled',
        measurementConfigured: true,
        organizationTrackingEnabled: true,
      }),
    ).toEqual({
      allowed: false,
      reason: 'local_override_disabled',
    });
  });

  it('blocks tracking when Do Not Track is enabled', () => {
    expect(
      evaluateTrackingPermission({
        doNotTrackEnabled: true,
        localOverride: 'enabled',
        measurementConfigured: true,
        organizationTrackingEnabled: true,
      }),
    ).toEqual({
      allowed: false,
      reason: 'do_not_track',
    });
  });

  it('allows tracking only when all constraints permit it', () => {
    expect(
      evaluateTrackingPermission({
        doNotTrackEnabled: false,
        localOverride: 'inherit',
        measurementConfigured: true,
        organizationTrackingEnabled: true,
      }),
    ).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });
});
