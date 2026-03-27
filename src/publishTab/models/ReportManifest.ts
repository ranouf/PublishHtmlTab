import { ReportManifestEntry } from './ReportManifestEntry';

/**
 * Describes the published report manifest stored as a summary attachment.
 */
export interface ReportManifest {
  schemaVersion: number;
  tabName: string;
  files?: ReportManifestEntry[];
  reports: ReportManifestEntry[];
  downloadAll?: {
    attachmentName: string;
    fileName: string;
  };
}
