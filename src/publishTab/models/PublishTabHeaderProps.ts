import { PublishTabHeaderTab } from './PublishTabHeaderTab';

/**
 * Describes all data and callbacks required by the header component.
 */
export interface PublishTabHeaderProps {
  appVersion: string;
  isManifestMode: boolean;
  legacyTabs: PublishTabHeaderTab[];
  selectedLegacyTabId: string;
  selectedSummaryTabId: string;
  showPrimaryDownloadButton: boolean;
  singleTitle: string;
  summaryTabs: PublishTabHeaderTab[];
  onDownloadArchive: () => void;
  onLegacyTabChange: (tabId: string) => void;
  onOpenFirstReport: () => void;
  onSummaryTabChange: (tabId: string) => void;
}
