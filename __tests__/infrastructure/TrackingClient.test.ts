import {
  trackingEvents,
  type TrackingEvent,
} from '../../src/publishTab/domain/tracking';
import type { TrackingConfig } from '../../src/publishTab/infrastructure/tracking/trackingConfig';
import {
  TrackingClient,
  mapTrackingEvent,
} from '../../src/publishTab/infrastructure/tracking/TrackingClient';

describe('TrackingClient', () => {
  const trackingConfig: TrackingConfig = {
    apiKey: '567223ab6a82bb3623777936d0a74af1',
    enabled: true,
    pageLocation:
      'https://marketplace.visualstudio.com/items?itemName=ranouf.publish-html-tab',
    pagePath: '/publish-html-tab',
    pageTitle: 'PublishHtmlTab',
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps typed PublishTab events to a strict tracking whitelist', () => {
    const event: TrackingEvent = {
      name: trackingEvents.publishTabLinkClicked,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        linkType: 'internal',
        mode: 'manifest',
        targetKind: 'report',
        targetPathHash: 'abc123',
        timeBeforeInteractionMs: 120,
      },
    };

    expect(mapTrackingEvent(event)).toEqual({
      build_id: 42,
      extension_version: '1.2.3',
      link_type: 'internal',
      mode: 'manifest',
      target_kind: 'report',
      target_path_hash: 'abc123',
      time_before_interaction_ms: 120,
    });
  });

  it('maps selected, download, and navigation events with their dedicated payload fields', () => {
    expect(
      mapTrackingEvent({
        name: trackingEvents.publishTabSelected,
        payload: {
          buildId: 42,
          extensionVersion: '1.2.3',
          mode: 'manifest',
          navigationSource: 'click',
          tabCount: 4,
          tabIndex: 1,
          tabType: 'report',
          timeBeforeTabChangeMs: 320,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        navigation_source: 'click',
        tab_count: 4,
        tab_index: 1,
        tab_type: 'report',
        time_before_tab_change_ms: 320,
      }),
    );

    expect(
      mapTrackingEvent({
        name: trackingEvents.publishTabDownloadFailed,
        payload: {
          buildId: 42,
          downloadType: 'archive',
          errorKind: 'download_failed',
          extensionVersion: '1.2.3',
          hasDownload: true,
          mode: 'manifest',
          tabType: 'summary',
          timeBeforeInteractionMs: 120,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        download_type: 'archive',
        error_kind: 'download_failed',
        has_download: true,
        tab_type: 'summary',
        time_before_interaction_ms: 120,
      }),
    );

    expect(
      mapTrackingEvent({
        name: trackingEvents.publishTabNavigationFailed,
        payload: {
          buildId: 42,
          errorKind: 'missing_report',
          extensionVersion: '1.2.3',
          mode: 'legacy',
          navigationSource: 'internal_link',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        error_kind: 'missing_report',
        navigation_source: 'internal_link',
      }),
    );

    expect(
      mapTrackingEvent({
        name: trackingEvents.trackingErrorOccurred,
        payload: {
          errorKind: 'not_found',
          extensionVersion: '1.2.3',
          operation: 'load_settings',
          scope: 'organization',
          source: 'settings_page',
          surface: 'settings_page',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        error_kind: 'not_found',
        operation: 'load_settings',
        scope: 'organization',
        source: 'settings_page',
        surface: 'settings_page',
      }),
    );
  });

  it('sends events through the Amplitude HTTP V2 API', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true });
    const sendBeacon = jest.fn();
    const localStorage = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };
    const windowRef = {
      fetch,
      localStorage,
      navigator: {
        doNotTrack: '0',
        sendBeacon,
      },
    } as unknown as Window;

    const tracker = new TrackingClient(
      trackingConfig,
      true,
      windowRef,
    );

    await tracker.track({
      name: trackingEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 4,
        tabCount: 2,
      },
    });
    await tracker.track({
      name: trackingEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 4,
        tabCount: 2,
      },
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      'https://api2.amplitude.com/2/httpapi',
      expect.objectContaining({
        body: expect.any(String),
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        keepalive: true,
        method: 'POST',
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        api_key: '567223ab6a82bb3623777936d0a74af1',
        events: [
          {
            app_version: '1.2.3',
            device_id: expect.any(String),
            event_properties: expect.objectContaining({
              build_id: 42,
              page_location:
                'https://marketplace.visualstudio.com/items?itemName=ranouf.publish-html-tab',
              page_path: '/publish-html-tab',
              page_title: 'PublishHtmlTab',
            }),
            event_type: 'publish_tab_opened',
            insert_id: expect.any(String),
            platform: 'Azure DevOps Extension',
            time: expect.any(Number),
          },
        ],
      }),
    );
  });

  it('does not send tracking when the browser enables Do Not Track', async () => {
    const fetch = jest.fn();
    const tracker = new TrackingClient(
      trackingConfig,
      true,
      {
        fetch,
        navigator: { doNotTrack: '1' },
      } as unknown as Window,
    );

    await tracker.track({
      name: trackingEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 2,
        tabCount: 1,
      },
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not send tracking when the organization setting disables it', async () => {
    const fetch = jest.fn();
    const sendBeacon = jest.fn();
    const tracker = new TrackingClient(
      trackingConfig,
      false,
      {
        fetch,
        navigator: { doNotTrack: '0', sendBeacon },
      } as unknown as Window,
    );

    await tracker.track({
      name: trackingEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 2,
        tabCount: 1,
      },
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('does not send tracking when the local override disables it', async () => {
    const fetch = jest.fn();
    const sendBeacon = jest.fn();
    const tracker = new TrackingClient(
      trackingConfig,
      true,
      {
        fetch,
        localStorage: {
          getItem: jest.fn().mockReturnValue('disabled'),
        },
        navigator: { doNotTrack: '0', sendBeacon },
      } as unknown as Window,
    );

    await tracker.track({
      name: trackingEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 2,
        tabCount: 1,
      },
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
