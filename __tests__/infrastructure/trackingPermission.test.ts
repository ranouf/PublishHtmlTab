import {
  getTrackingPermissionDecision,
  isDoNotTrackEnabled,
  readTrackingLocalOverride,
} from '../../src/publishTab/infrastructure/tracking/trackingPermission';

describe('trackingPermission', () => {
  it('reads the local override from storage when present', () => {
    const storage = {
      getItem: jest.fn().mockReturnValue('disabled'),
    } as unknown as Storage;

    expect(readTrackingLocalOverride(storage)).toBe('disabled');
  });

  it('falls back to inherit when the local override is missing', () => {
    const storage = {
      getItem: jest.fn().mockReturnValue(null),
    } as unknown as Storage;

    expect(readTrackingLocalOverride(storage)).toBe('inherit');
  });

  it('detects the browser Do Not Track setting', () => {
    expect(
      isDoNotTrackEnabled({
        doNotTrack: '1',
        navigator: { doNotTrack: '1' },
      } as unknown as Window),
    ).toBe(true);
  });

  it('combines organization settings and browser preferences into one decision', () => {
    expect(
      getTrackingPermissionDecision(
        true,
        true,
        {
          localStorage: {
            getItem: jest.fn().mockReturnValue('disabled'),
          },
          navigator: { doNotTrack: '0' },
        } as unknown as Window,
      ),
    ).toEqual({
      allowed: false,
      reason: 'local_override_disabled',
    });
  });
});
