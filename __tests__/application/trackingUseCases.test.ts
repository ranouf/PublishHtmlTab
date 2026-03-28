import {
  trackPublishTabDownloadClicked,
} from '../../src/publishTab/application/tracking/trackPublishTabDownloadClicked';
import {
  trackPublishTabDownloadFailed,
} from '../../src/publishTab/application/tracking/trackPublishTabDownloadFailed';
import {
  trackPublishTabLinkClicked,
} from '../../src/publishTab/application/tracking/trackPublishTabLinkClicked';
import {
  trackPublishTabNavigationFailed,
} from '../../src/publishTab/application/tracking/trackPublishTabNavigationFailed';
import {
  trackPublishTabOpened,
} from '../../src/publishTab/application/tracking/trackPublishTabOpened';
import {
  trackPublishTabSelected,
} from '../../src/publishTab/application/tracking/trackPublishTabSelected';
import type { TrackingPort } from '../../src/publishTab/domain/tracking';

describe('tracking use cases', () => {
  const tracker: TrackingPort = {
    track: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards the opened event to the tracking port', async () => {
    await trackPublishTabOpened(tracker, {
      buildId: 42,
      extensionVersion: '1.2.3',
      hasDownload: true,
      mode: 'manifest',
      pageCount: 3,
      tabCount: 2,
      targetPathHash: 'abc123',
    });

    expect(tracker.track).toHaveBeenCalledWith({
      name: 'publish_tab_opened',
      payload: expect.objectContaining({ pageCount: 3 }),
    });
  });

  it('forwards the selected event to the tracking port', async () => {
    await trackPublishTabSelected(tracker, {
      buildId: 42,
      extensionVersion: '1.2.3',
      mode: 'legacy',
      navigationSource: 'click',
      tabCount: 4,
      tabIndex: 1,
      tabType: 'legacy',
      timeBeforeTabChangeMs: 250,
    });

    expect(tracker.track).toHaveBeenCalledWith({
      name: 'publish_tab_selected',
      payload: expect.objectContaining({ tabType: 'legacy' }),
    });
  });

  it('forwards download, link, and navigation events with their dedicated names', async () => {
    await trackPublishTabDownloadClicked(tracker, {
      buildId: 42,
      downloadType: 'archive',
      extensionVersion: '1.2.3',
      hasDownload: true,
      mode: 'manifest',
      tabType: 'summary',
      timeBeforeInteractionMs: 300,
    });
    await trackPublishTabDownloadFailed(tracker, {
      buildId: 42,
      downloadType: 'archive',
      errorKind: 'download_failed',
      extensionVersion: '1.2.3',
      hasDownload: true,
      mode: 'manifest',
      tabType: 'summary',
      timeBeforeInteractionMs: 300,
    });
    await trackPublishTabLinkClicked(tracker, {
      buildId: 42,
      extensionVersion: '1.2.3',
      linkType: 'internal',
      mode: 'manifest',
      targetKind: 'report',
      timeBeforeInteractionMs: 120,
    });
    await trackPublishTabNavigationFailed(tracker, {
      buildId: 42,
      errorKind: 'missing_report',
      extensionVersion: '1.2.3',
      mode: 'manifest',
      navigationSource: 'internal_link',
    });

    expect((tracker.track as jest.Mock).mock.calls.map(([event]) => event.name)).toEqual([
      'publish_tab_download_clicked',
      'publish_tab_download_failed',
      'publish_tab_link_clicked',
      'publish_tab_navigation_failed',
    ]);
  });
});
