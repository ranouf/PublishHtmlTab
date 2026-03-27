import * as React from 'react';
import { render, screen } from '@testing-library/react';

import type { AnimatedTabBarProps, PublishTabHeaderProps, PublishTabViewProps, ReportViewerProps } from '../../src/publishTab/models';
import { PublishTabView } from '../../src/publishTab/ui/components/PublishTabView';

jest.mock('../../src/publishTab/ui/components/PublishTabHeader', () => ({
  PublishTabHeader: (props: PublishTabHeaderProps) => (
    <div data-testid="publish-tab-header">{props.singleTitle}</div>
  ),
}));

jest.mock('../../src/publishTab/ui/components/AnimatedTabBar', () => ({
  AnimatedTabBar: (props: AnimatedTabBarProps) => (
    <div data-testid="report-tab-bar">{props.ariaLabel}</div>
  ),
}));

jest.mock('../../src/publishTab/ui/components/ReportViewer', () => ({
  ReportViewer: (props: ReportViewerProps) => (
    <div data-testid="report-viewer">{props.contentHtml || props.loadingMessage}</div>
  ),
}));

describe('PublishTabView', () => {
  const baseProps: PublishTabViewProps = {
    appVersion: '1.2.3',
    isManifestMode: true,
    legacyTabs: [{ id: 'legacy', label: 'Legacy' }],
    onDownloadArchive: jest.fn(),
    onLegacyTabChange: jest.fn(),
    onOpenFirstReport: jest.fn(),
    onReportTabChange: jest.fn(),
    onSummaryTabChange: jest.fn(),
    reportTabs: [
      { id: 'report-1', label: 'Overview' },
      { id: 'report-2', label: 'Details' },
    ],
    selectedReportTabId: 'report-1',
    selectedSummaryTabId: 'summary-1',
    showPrimaryDownloadButton: true,
    singleTitle: 'Coverage',
    summaryTabs: [{ id: 'summary-1', label: 'Coverage' }],
    viewerContentHtml: '<div>Ready</div>',
    viewerLoadingMessage: 'Loading...',
    viewerWarningMessage: 'Something needs attention',
  };

  it('renders the header, warning banner, report tab bar, and viewer', () => {
    render(<PublishTabView {...baseProps} />);

    expect(screen.getByTestId('publish-tab-header')).toHaveTextContent('Coverage');
    expect(screen.getByText('Something needs attention')).toBeInTheDocument();
    expect(screen.getByTestId('report-tab-bar')).toHaveTextContent('Report pages');
    expect(screen.getByTestId('report-viewer')).toHaveTextContent('Ready');
  });

  it('hides the secondary report tabs when there is only one report page', () => {
    render(
      <PublishTabView
        {...baseProps}
        reportTabs={[{ id: 'report-1', label: 'Overview' }]}
      />,
    );

    expect(screen.queryByTestId('report-tab-bar')).not.toBeInTheDocument();
  });

  it('hides the secondary report tabs outside manifest mode', () => {
    render(<PublishTabView {...baseProps} isManifestMode={false} />);

    expect(screen.queryByTestId('report-tab-bar')).not.toBeInTheDocument();
  });
});
