import { PublishTabHeaderTab } from './PublishTabHeaderTab';

/**
 * Defines the full render contract for the PublishTab page view.
 */
export interface PublishTabViewProps {
  appVersion: string;
  isManifestMode: boolean;
  legacyTabs: PublishTabHeaderTab[];
  reportTabs: PublishTabHeaderTab[];
  selectedReportTabId: string;
  selectedSummaryTabId: string;
  showPrimaryDownloadButton: boolean;
  singleTitle: string;
  summaryTabs: PublishTabHeaderTab[];
  viewerContentHtml?: string;
  viewerLoadingMessage?: string;
  viewerWarningMessage?: string;
  onDownloadArchive: () => void;
  onLegacyTabChange: (tabId: string) => void;
  onOpenFirstReport: () => void;
  onReportTabChange: (tabId: string) => void;
  onSummaryTabChange: (tabId: string) => void;
}
