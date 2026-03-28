import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  HOST_REPORT_QUERY_KEY,
  HOST_SUMMARY_QUERY_KEY,
  INTERNAL_REPORT_FRAME_ATTRIBUTE,
  INTERNAL_REPORT_HEIGHT_MESSAGE,
  INTERNAL_REPORT_LINK_CLICK_MESSAGE,
  INTERNAL_REPORT_NAVIGATION_MESSAGE,
} from '../../src/publishTab/constants';
import type { TrackingPort } from '../../src/publishTab/domain/tracking';
import type { ReportManifest } from '../../src/publishTab/models';
import { PublishTabContainer } from '../../src/publishTab/controllers/PublishTabContainer';
import type { AttachmentClient } from '../../src/publishTab/services/attachments/AttachmentClient';

const getQueryParamsMock = jest.fn();
const syncReportSelectionMock = jest.fn();
const getReportFrameHtmlMock = jest.fn();
const disposeMock = jest.fn();
const trackingPort = {
  track: jest.fn<Promise<void>, [unknown]>(),
};

jest.mock('../../src/publishTab/services/navigation/HostNavigationService', () => ({
  HostNavigationService: jest.fn().mockImplementation(() => ({
    getQueryParams: getQueryParamsMock,
    syncReportSelection: syncReportSelectionMock,
  })),
}));

jest.mock('../../src/publishTab/services/reports/ReportHtmlService', () => ({
  ReportHtmlService: jest.fn().mockImplementation(() => ({
    dispose: disposeMock,
    getReportFrameHtml: getReportFrameHtmlMock,
  })),
}));

jest.mock('../../src/publishTab/ui/components/PublishTabView', () => ({
  PublishTabView: (props: {
    legacyTabs: Array<{ id: string }>;
    onLegacyTabChange: (tabId: string) => void;
    onReportTabChange: (tabId: string) => void;
    viewerContentHtml?: string;
    viewerWarningMessage?: string;
    reportTabs: Array<{ id: string }>;
    selectedReportTabId: string;
    selectedSummaryTabId: string;
    summaryTabs: Array<{ id: string }>;
    onDownloadArchive: () => void;
    onSummaryTabChange: (tabId: string) => void;
  }) => (
    <div>
      <div data-testid="selected-summary">{props.selectedSummaryTabId}</div>
      <div data-testid="selected-report">{props.selectedReportTabId}</div>
      <div data-testid="warning">{props.viewerWarningMessage || ''}</div>
      <div
        data-testid="viewer-html"
        dangerouslySetInnerHTML={{ __html: props.viewerContentHtml || '' }}
      />
      <button onClick={props.onDownloadArchive} type="button">
        Trigger download
      </button>
      {props.summaryTabs[1] ? (
        <button
          onClick={() => {
            props.onSummaryTabChange(props.summaryTabs[1].id);
          }}
          type="button"
        >
          Trigger summary tab
        </button>
      ) : null}
      {props.reportTabs[1] ? (
        <button
          onClick={() => {
            props.onReportTabChange(props.reportTabs[1].id);
          }}
          type="button"
        >
          Trigger report tab
        </button>
      ) : null}
      {props.legacyTabs[1] ? (
        <button
          onClick={() => {
            props.onLegacyTabChange(props.legacyTabs[1].id);
          }}
          type="button"
        >
          Trigger legacy tab
        </button>
      ) : null}
    </div>
  ),
}));

describe('PublishTabContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', 'http://localhost/');
    document.body.innerHTML = '';
    trackingPort.track.mockResolvedValue(undefined);
    getQueryParamsMock.mockResolvedValue({});
    syncReportSelectionMock.mockResolvedValue(undefined);
    getReportFrameHtmlMock.mockResolvedValue('<iframe>report</iframe>');
  });

  it('falls back to the default summary tab and shows a warning when the requested summary is missing', async () => {
    getQueryParamsMock.mockResolvedValue({
      [HOST_SUMMARY_QUERY_KEY]: 'missing-summary',
    });
    const attachmentClient = createAttachmentClient({
      hasManifestMode: true,
      manifestsBySummary: {
        'summary-a': createManifest('Coverage', ['report-1']),
      },
      summaryAttachmentNames: ['summary-a'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-summary')).toHaveTextContent(
        'summary-a',
      );
    });

    expect(screen.getByTestId('warning')).toHaveTextContent(
      'Requested tab "missing-summary" was not found. Showing the default tab instead.',
    );
    expect(screen.getByTestId('selected-report')).toHaveTextContent('report-1');
    expect(getReportFrameHtmlMock).toHaveBeenCalledWith(
      'report-1',
      expect.objectContaining({ tabName: 'Coverage' }),
    );
    await waitFor(() => {
      expect(trackingPort.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'publish_tab_opened' }),
      );
    });
  });

  it('shows a not-found page when the host requests a manifest report that does not exist', async () => {
    getQueryParamsMock.mockResolvedValue({
      [HOST_REPORT_QUERY_KEY]: 'missing-report',
      [HOST_SUMMARY_QUERY_KEY]: 'summary-a',
    });
    const attachmentClient = createAttachmentClient({
      hasManifestMode: true,
      manifestsBySummary: {
        'summary-a': createManifest('Coverage', ['report-1']),
      },
      summaryAttachmentNames: ['summary-a'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('viewer-html')).toHaveTextContent(
        'The requested report page "missing-report" does not exist in this tab.',
      );
    });

    expect(getReportFrameHtmlMock).not.toHaveBeenCalled();
  });

  it('shows a not-found page when a legacy hash targets a missing report', async () => {
    window.history.replaceState(
      null,
      '',
      'http://localhost/#report=missing-report',
    );
    const attachmentClient = createAttachmentClient({
      hasManifestMode: false,
      legacyAttachmentNames: ['legacy-report'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('viewer-html')).toHaveTextContent(
        'The requested report page "missing-report" was not found.',
      );
    });
  });

  it('shows a not-found page when an embedded report requests a missing target', async () => {
    const attachmentClient = createAttachmentClient({
      hasManifestMode: false,
      legacyAttachmentNames: ['legacy-report'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(getReportFrameHtmlMock).toHaveBeenCalledWith(
        'legacy-report',
        undefined,
      );
    });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          missingTarget: 'missing/details.html',
          type: INTERNAL_REPORT_NAVIGATION_MESSAGE,
        },
      }),
    );

    expect(screen.getByTestId('viewer-html')).toHaveTextContent(
      'The requested link "missing/details.html" was not found in the published report.',
    );
  });

  it('applies iframe height updates emitted by the selected embedded report', async () => {
    const attachmentClient = createAttachmentClient({
      hasManifestMode: false,
      legacyAttachmentNames: ['legacy-report'],
    });
    const iframe = document.createElement('iframe');

    iframe.setAttribute(INTERNAL_REPORT_FRAME_ATTRIBUTE, 'legacy-report');
    document.body.appendChild(iframe);

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(getReportFrameHtmlMock).toHaveBeenCalledWith(
        'legacy-report',
        undefined,
      );
    });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          attachmentName: 'legacy-report',
          height: 480,
          type: INTERNAL_REPORT_HEIGHT_MESSAGE,
        },
      }),
    );

    expect(iframe.style.height).toBe('480px');
    expect(iframe.style.visibility).toBe('visible');
  });

  it('alerts the user when the archive download fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const attachmentClient = createAttachmentClient({
      downloadError: new Error('Download failed'),
      hasManifestMode: true,
      manifestsBySummary: {
        'summary-a': {
          ...createManifest('Coverage', ['report-1']),
          downloadAll: {
            attachmentName: 'archive.zip',
            fileName: 'coverage.zip',
          },
        },
      },
      summaryAttachmentNames: ['summary-a'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-report')).toHaveTextContent('report-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger download' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Unable to download tab content archive: Download failed',
      );
    });

    alertSpy.mockRestore();
  });

  it('tracks embedded link clicks and internal-link driven tab changes without sending raw targets', async () => {
    const attachmentClient = createAttachmentClient({
      hasManifestMode: false,
      legacyAttachmentNames: ['legacy-report-1', 'legacy-report-2'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(getReportFrameHtmlMock).toHaveBeenCalledWith(
        'legacy-report-1',
        undefined,
      );
    });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          attachmentName: 'legacy-report-2',
          href: 'legacy-report-2',
          type: INTERNAL_REPORT_LINK_CLICK_MESSAGE,
        },
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          attachmentName: 'legacy-report-2',
          type: INTERNAL_REPORT_NAVIGATION_MESSAGE,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-report')).toHaveTextContent(
        'legacy-report-2',
      );
    });

    expect(findTrackedEvent('publish_tab_link_clicked')).toMatchObject({
      payload: expect.objectContaining({
        linkType: 'internal',
        targetKind: 'report',
      }),
    });
    expect(findTrackedEvent('publish_tab_link_clicked')).not.toMatchObject({
      payload: expect.objectContaining({
        href: expect.anything(),
        targetPath: expect.anything(),
      }),
    });
    expect(findTrackedEvent('publish_tab_selected')).toMatchObject({
      payload: expect.objectContaining({
        navigationSource: 'internal_link',
        tabType: 'legacy',
      }),
    });
  });

  it('tracks missing embedded targets as both a click and a navigation failure', async () => {
    const attachmentClient = createAttachmentClient({
      hasManifestMode: false,
      legacyAttachmentNames: ['legacy-report'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(getReportFrameHtmlMock).toHaveBeenCalledWith(
        'legacy-report',
        undefined,
      );
    });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          href: 'missing/details.html',
          missingTarget: 'missing/details.html',
          type: INTERNAL_REPORT_LINK_CLICK_MESSAGE,
        },
      }),
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          missingTarget: 'missing/details.html',
          type: INTERNAL_REPORT_NAVIGATION_MESSAGE,
        },
      }),
    );

    await waitFor(() => {
      expect(findTrackedEvent('publish_tab_navigation_failed')).toMatchObject({
        payload: expect.objectContaining({
          errorKind: 'missing_link',
          navigationSource: 'internal_link',
        }),
      });
    });
  });

  it('tracks a manifest report-tab click with the report tab type', async () => {
    const attachmentClient = createAttachmentClient({
      hasManifestMode: true,
      manifestsBySummary: {
        'summary-a': createManifest('Coverage', ['report-1', 'report-2']),
      },
      summaryAttachmentNames: ['summary-a'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
        trackingPort={trackingPort as unknown as TrackingPort}
        buildId={42}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Trigger report tab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Trigger report tab'));

    await waitFor(() => {
      expect(findTrackedEvent('publish_tab_selected')).toMatchObject({
        payload: expect.objectContaining({
          navigationSource: 'click',
          tabType: 'report',
        }),
      });
    });
  });
});

function findTrackedEvent(name: string): { name: string; payload: unknown } {
  const trackedCall = trackingPort.track.mock.calls.find(
    ([event]) => (event as { name?: string }).name === name,
  );

  if (!trackedCall) {
    throw new Error(`Tracking event ${name} was not tracked`);
  }

  return trackedCall[0] as { name: string; payload: unknown };
}

function createAttachmentClient(options?: {
  downloadError?: Error;
  hasManifestMode?: boolean;
  legacyAttachmentNames?: string[];
  manifestsBySummary?: Record<string, ReportManifest>;
  summaryAttachmentNames?: string[];
}): {
  downloadReportArchive: jest.Mock<Promise<void>, [string, string]>;
  getLegacyAttachments: jest.Mock<Array<{ name: string }>, []>;
  getManifest: jest.Mock<Promise<ReportManifest>, [string]>;
  getSummaryAttachments: jest.Mock<Array<{ name: string }>, []>;
  hasManifestMode: jest.Mock<boolean, []>;
} {
  const summaryAttachmentNames = options?.summaryAttachmentNames || [];
  const legacyAttachmentNames = options?.legacyAttachmentNames || [];
  const manifestsBySummary = options?.manifestsBySummary || {};

  return {
    downloadReportArchive: jest.fn(async (_attachmentName: string, _fileName: string) => {
      if (options?.downloadError) {
        throw options.downloadError;
      }
    }),
    getLegacyAttachments: jest.fn(() =>
      legacyAttachmentNames.map((name) => ({ name })),
    ),
    getManifest: jest.fn(async (summaryAttachmentName: string) => {
      const manifest = manifestsBySummary[summaryAttachmentName];
      if (!manifest) {
        throw new Error(`Missing manifest for ${summaryAttachmentName}`);
      }

      return manifest;
    }),
    getSummaryAttachments: jest.fn(() =>
      summaryAttachmentNames.map((name) => ({ name })),
    ),
    hasManifestMode: jest.fn(() => !!options?.hasManifestMode),
  };
}

function createManifest(
  tabName: string,
  reportAttachmentNames: string[],
): ReportManifest {
  return {
    reports: reportAttachmentNames.map((reportAttachmentName, index) => ({
      attachmentName: reportAttachmentName,
      displayName: index === 0 ? 'Overview' : `Page ${index + 1}`,
      fileName: reportAttachmentName,
      isHtml: true,
      relativePath: reportAttachmentName,
    })),
    schemaVersion: 1,
    tabName,
  };
}
