import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { AnimatedTabBarProps, PublishTabHeaderProps } from '../../src/publishTab/models';
import { PublishTabHeader } from '../../src/publishTab/ui/components/PublishTabHeader';

jest.mock('../../src/publishTab/ui/components/AnimatedTabBar', () => ({
  AnimatedTabBar: (props: AnimatedTabBarProps) => (
    <div data-testid="animated-tab-bar">
      <span>{props.ariaLabel}</span>
      {props.tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            props.onSelectedTabChanged(tab.id);
          }}
          type="button"
        >
          {tab.label}
        </button>
      ))}
      {props.renderTrailingAction?.(props.tabs[0])}
      {props.endAccessory}
    </div>
  ),
}));

describe('PublishTabHeader', () => {
  const baseProps: PublishTabHeaderProps = {
    appVersion: '1.2.3',
    isManifestMode: true,
    legacyTabs: [{ id: 'legacy', label: 'Legacy' }],
    onDownloadArchive: jest.fn(),
    onLegacyTabChange: jest.fn(),
    onOpenFirstReport: jest.fn(),
    onSummaryTabChange: jest.fn(),
    selectedLegacyTabId: 'legacy',
    selectedSummaryTabId: 'summary-1',
    showPrimaryDownloadButton: true,
    singleTitle: 'Coverage',
    summaryTabs: [
      {
        downloadArchiveFileName: 'coverage.zip',
        id: 'summary-1',
        label: 'Coverage',
        showDownloadBadge: true,
      },
      { id: 'summary-2', label: 'Details' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders manifest tabs with a version link and download action', () => {
    render(<PublishTabHeader {...baseProps} />);

    expect(screen.getByTestId('animated-tab-bar')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'v1.2.3' }),
    ).toHaveAttribute(
      'href',
      'https://marketplace.visualstudio.com/items?itemName=ranouf.publish-html-tab',
    );
    expect(
      screen.getByRole('button', { name: 'Download full tab content archive' }),
    ).toBeInTheDocument();
  });

  it('renders the single-title layout and dispatches title and download actions', () => {
    render(
      <PublishTabHeader
        {...baseProps}
        summaryTabs={[
          {
            downloadArchiveFileName: 'coverage.zip',
            id: 'summary-1',
            label: 'Coverage',
            showDownloadBadge: true,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Coverage' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Download full tab content archive' }),
    );

    expect(baseProps.onOpenFirstReport).toHaveBeenCalledTimes(1);
    expect(baseProps.onDownloadArchive).toHaveBeenCalledTimes(1);
  });

  it('uses legacy tabs when manifest mode is disabled', () => {
    render(
      <PublishTabHeader
        {...baseProps}
        isManifestMode={false}
        legacyTabs={[
          { id: 'legacy-1', label: 'Overview' },
          { id: 'legacy-2', label: 'Details' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(baseProps.onLegacyTabChange).toHaveBeenCalledWith('legacy-2');
  });
});
