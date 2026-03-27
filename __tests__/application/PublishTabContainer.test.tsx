import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  HOST_REPORT_QUERY_KEY,
  HOST_SUMMARY_QUERY_KEY,
  INTERNAL_REPORT_FRAME_ATTRIBUTE,
  INTERNAL_REPORT_HEIGHT_MESSAGE,
  INTERNAL_REPORT_NAVIGATION_MESSAGE,
} from '../../src/publishTab/constants';
import type { ReportManifest } from '../../src/publishTab/models';
import { PublishTabContainer } from '../../src/publishTab/controllers/PublishTabContainer';
import type { AttachmentClient } from '../../src/publishTab/services/attachments/AttachmentClient';

const getQueryParamsMock = jest.fn();
const syncReportSelectionMock = jest.fn();
const getReportFrameHtmlMock = jest.fn();
const disposeMock = jest.fn();

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
    viewerContentHtml?: string;
    viewerWarningMessage?: string;
    selectedReportTabId: string;
    selectedSummaryTabId: string;
    onDownloadArchive: () => void;
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
    </div>
  ),
}));

describe('PublishTabContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', 'http://localhost/');
    document.body.innerHTML = '';
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
        'summary-a': createManifest('Coverage', 'report-1'),
      },
      summaryAttachmentNames: ['summary-a'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
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
  });

  it('shows a not-found page when the host requests a manifest report that does not exist', async () => {
    getQueryParamsMock.mockResolvedValue({
      [HOST_REPORT_QUERY_KEY]: 'missing-report',
      [HOST_SUMMARY_QUERY_KEY]: 'summary-a',
    });
    const attachmentClient = createAttachmentClient({
      hasManifestMode: true,
      manifestsBySummary: {
        'summary-a': createManifest('Coverage', 'report-1'),
      },
      summaryAttachmentNames: ['summary-a'],
    });

    render(
      <PublishTabContainer
        appVersion="1.2.3"
        attachmentClient={attachmentClient as unknown as AttachmentClient}
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
          ...createManifest('Coverage', 'report-1'),
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
});

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

function createManifest(tabName: string, reportAttachmentName: string): ReportManifest {
  return {
    reports: [
      {
        attachmentName: reportAttachmentName,
        displayName: 'Overview',
        fileName: reportAttachmentName,
        isHtml: true,
        relativePath: reportAttachmentName,
      },
    ],
    schemaVersion: 1,
    tabName,
  };
}
