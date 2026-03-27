import {
  analyticsEvents,
  type AnalyticsEvent,
} from '../../src/publishTab/domain/analytics';
import { createAnalyticsConfig } from '../../src/publishTab/infrastructure/analytics/analyticsConfig';
import {
  GoogleAnalyticsTracker,
  mapGoogleAnalyticsEvent,
} from '../../src/publishTab/infrastructure/analytics/GoogleAnalyticsTracker';

describe('GoogleAnalyticsTracker', () => {
  it('maps typed PublishTab events to a strict GA whitelist', () => {
    const event: AnalyticsEvent = {
      name: analyticsEvents.publishTabLinkClicked,
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

    expect(mapGoogleAnalyticsEvent(event)).toEqual({
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
      mapGoogleAnalyticsEvent({
        name: analyticsEvents.publishTabSelected,
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
      mapGoogleAnalyticsEvent({
        name: analyticsEvents.publishTabDownloadFailed,
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
      mapGoogleAnalyticsEvent({
        name: analyticsEvents.publishTabNavigationFailed,
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
  });

  it('initializes gtag once and queues events without leaking the host page URL', async () => {
    const config = createAnalyticsConfig();
    const gtag = jest.fn();
    const documentRef = document.implementation.createHTMLDocument('Analytics');
    const windowRef = {
      dataLayer: [],
      document: documentRef,
      gtag,
      navigator: { doNotTrack: '0' },
    } as unknown as Window;

    const tracker = new GoogleAnalyticsTracker(config, documentRef, windowRef);

    await tracker.track({
      name: analyticsEvents.publishTabOpened,
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
      name: analyticsEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 4,
        tabCount: 2,
      },
    });

    expect(
      documentRef.querySelectorAll('#publish-html-tab-ga-script'),
    ).toHaveLength(1);
    expect(gtag).toHaveBeenCalledWith('config', 'G-MTELT5BK5W', {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      anonymize_ip: true,
      page_location:
        'https://marketplace.visualstudio.com/items?itemName=ranouf.publish-html-tab',
      page_path: '/publish-html-tab',
      page_referrer: '',
      page_title: 'PublishHtmlTab',
      send_page_view: false,
    });
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'publish_tab_opened',
      expect.objectContaining({ build_id: 42 }),
    );
  });

  it('does not send analytics when the browser enables Do Not Track', async () => {
    const tracker = new GoogleAnalyticsTracker(createAnalyticsConfig(), document, {
      dataLayer: [],
      navigator: { doNotTrack: '1' },
    } as unknown as Window);

    await tracker.track({
      name: analyticsEvents.publishTabOpened,
      payload: {
        buildId: 42,
        extensionVersion: '1.2.3',
        hasDownload: true,
        mode: 'manifest',
        pageCount: 2,
        tabCount: 1,
      },
    });

    expect(document.querySelector('#publish-html-tab-ga-script')).toBeNull();
  });
});
