jest.mock('../../src/publishTab/infrastructure/tracking/trackingConfig', () => ({
  createTrackingConfig: jest.fn(),
}));

import { TrackingClient } from '../../src/publishTab/infrastructure/tracking/TrackingClient';
import { NoopTrackingPort } from '../../src/publishTab/infrastructure/tracking/noopTrackingPort';
import { createTrackingPort } from '../../src/publishTab/infrastructure/tracking/createTrackingPort';
import { createTrackingConfig } from '../../src/publishTab/infrastructure/tracking/trackingConfig';

describe('createTrackingPort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a TrackingClient when tracking is enabled', () => {
    (createTrackingConfig as jest.Mock).mockReturnValue({
      apiKey: 'test-key',
      enabled: true,
      pageLocation: 'https://example.test',
      pagePath: '/publish-html-tab',
      pageTitle: 'PublishHtmlTab',
    });

    const tracker = createTrackingPort(true);

    expect(tracker).toBeInstanceOf(TrackingClient);
  });

  it('creates a NoopTrackingPort when tracking is disabled', async () => {
    (createTrackingConfig as jest.Mock).mockReturnValue({
      apiKey: undefined,
      enabled: false,
      pageLocation: 'https://example.test',
      pagePath: '/publish-html-tab',
      pageTitle: 'PublishHtmlTab',
    });

    const tracker = createTrackingPort(true);

    expect(tracker).toBeInstanceOf(NoopTrackingPort);
    await expect(
      tracker.track({
        name: 'tracking_settings_opened',
        payload: {
          extensionVersion: '1.2.3',
          scope: 'organization',
          source: 'settings_page',
        },
      }),
    ).resolves.toBeUndefined();
  });
});
