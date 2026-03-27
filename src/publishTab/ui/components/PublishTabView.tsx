import * as React from 'react';

import { PublishTabViewProps } from '../../models';
import { AnimatedTabBar } from './AnimatedTabBar';
import { PublishTabHeader } from './PublishTabHeader';
import { ReportViewer } from './ReportViewer';

/**
 * Renders the full PublishTab page from already-prepared view models.
 *
 * @param {PublishTabViewProps} props - Render data and event handlers for the page.
 * @returns {JSX.Element} Complete PublishTab page markup.
 */
export function PublishTabView(props: PublishTabViewProps): JSX.Element {
  return (
    <div className="flex-column publish-html-tab-shell">
      <PublishTabHeader
        appVersion={props.appVersion}
        isManifestMode={props.isManifestMode}
        legacyTabs={props.legacyTabs}
        onDownloadArchive={props.onDownloadArchive}
        onLegacyTabChange={props.onLegacyTabChange}
        onOpenFirstReport={props.onOpenFirstReport}
        onSummaryTabChange={props.onSummaryTabChange}
        selectedLegacyTabId={props.selectedReportTabId}
        selectedSummaryTabId={props.selectedSummaryTabId}
        showPrimaryDownloadButton={props.showPrimaryDownloadButton}
        singleTitle={props.singleTitle}
        summaryTabs={props.summaryTabs}
      />
      {renderWarningBanner(props.viewerWarningMessage)}
      {renderReportTabs(props)}
      <ReportViewer
        contentHtml={props.viewerContentHtml}
        loadingMessage={props.viewerLoadingMessage}
      />
    </div>
  );
}

/**
 * Renders the warning banner shown above the report viewer.
 *
 * @param {string | undefined} viewerWarningMessage - Warning message currently associated with the viewer.
 * @returns {JSX.Element | null} Warning banner markup when a warning exists.
 */
function renderWarningBanner(
  viewerWarningMessage: string | undefined,
): JSX.Element | null {
  if (!viewerWarningMessage) {
    return null;
  }

  return <div className="report-warning-banner">{viewerWarningMessage}</div>;
}

/**
 * Renders the secondary report tab bar used in manifest mode.
 *
 * @param {PublishTabViewProps} props - Render data and event handlers for the page.
 * @returns {JSX.Element | null} Report tab bar markup when multiple report pages exist.
 */
function renderReportTabs(props: PublishTabViewProps): JSX.Element | null {
  if (!props.isManifestMode || props.reportTabs.length <= 1) {
    return null;
  }

  return (
    <AnimatedTabBar
      ariaLabel="Report pages"
      onSelectedTabChanged={props.onReportTabChange}
      selectedTabId={props.selectedReportTabId}
      tabs={props.reportTabs}
    />
  );
}
