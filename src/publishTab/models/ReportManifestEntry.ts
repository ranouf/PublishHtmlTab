/**
 * Describes a single file or page referenced by a report manifest.
 */
export interface ReportManifestEntry {
  attachmentName: string;
  displayName: string;
  fileName: string;
  relativePath?: string;
  isHtml?: boolean;
}
