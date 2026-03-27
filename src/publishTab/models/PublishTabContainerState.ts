import { ReportManifest } from './ReportManifest';

/**
 * Stores the mutable UI state managed by the PublishTab container.
 */
export interface PublishTabContainerState {
  loadingManifestByAttachmentName: Record<string, boolean>;
  loadingReportByAttachmentName: Record<string, boolean>;
  manifestBySummaryAttachmentName: Record<string, ReportManifest | undefined>;
  reportFrameHtmlByAttachmentName: Record<string, string | undefined>;
  selectedReportAttachmentName: string;
  selectedSummaryAttachmentName: string;
  viewerErrorHtml?: string;
  viewerWarningMessage?: string;
}
