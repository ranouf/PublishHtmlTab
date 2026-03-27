import { ReportManifest, ReportManifestEntry } from '../models';
import { normalizeReportPath } from './reportPaths';

/**
 * Returns the complete list of manifest entries regardless of manifest version.
 *
 * @param {ReportManifest} manifest - Manifest currently being rendered.
 * @returns {ReportManifestEntry[]} Flat list of file entries available in the manifest.
 */
export function getManifestEntries(
  manifest: ReportManifest,
): ReportManifestEntry[] {
  // Some manifests declare a full file list, older ones only expose reports.
  return manifest.files || manifest.reports;
}

/**
 * Finds a manifest entry by attachment name.
 *
 * @param {ReportManifest} manifest - Manifest to search in.
 * @param {string} attachmentName - Attachment identifier to resolve.
 * @returns {ReportManifestEntry | undefined} Matching entry when it exists.
 */
export function findManifestEntryByAttachmentName(
  manifest: ReportManifest,
  attachmentName: string,
): ReportManifestEntry | undefined {
  return getManifestEntries(manifest).find(
    (entry) => entry.attachmentName === attachmentName,
  );
}

/**
 * Resolves the logical path used for a report entry.
 *
 * @param {ReportManifestEntry} entry - Manifest entry to inspect.
 * @returns {string} Relative path used to address the entry.
 */
export function getReportPath(entry: ReportManifestEntry): string {
  return entry.relativePath || entry.displayName || entry.fileName;
}

/**
 * Returns the directory that contains a given report entry.
 *
 * @param {ReportManifestEntry} entry - Manifest entry to inspect.
 * @returns {string} Directory path with a trailing slash when applicable.
 */
export function getReportDirectory(entry: ReportManifestEntry): string {
  const reportPath = normalizeReportPath(getReportPath(entry));
  return reportPath.includes('/')
    ? reportPath.substring(0, reportPath.lastIndexOf('/') + 1)
    : '';
}

/**
 * Checks whether a report entry should be treated as the default landing page.
 *
 * @param {ReportManifestEntry} entry - Manifest entry to evaluate.
 * @returns {boolean} `true` when the entry looks like an index page.
 */
export function isIndexReport(entry: ReportManifestEntry): boolean {
  const normalizedPath = getReportPath(entry).toLowerCase();
  return (
    normalizedPath.endsWith('/index.html') ||
    normalizedPath.endsWith('/index.htm') ||
    normalizedPath === 'index.html' ||
    normalizedPath === 'index.htm'
  );
}

/**
 * Picks the best default report page for a manifest.
 *
 * @param {ReportManifest} manifest - Manifest currently being rendered.
 * @returns {ReportManifestEntry | undefined} Preferred landing page or `undefined`.
 */
export function getPreferredReportEntry(
  manifest: ReportManifest,
): ReportManifestEntry | undefined {
  if (manifest.reports.length === 0) {
    return undefined;
  }

  const indexReports = manifest.reports
    .filter((entry) => isIndexReport(entry))
    .sort(
      (left, right) => getReportPath(left).length - getReportPath(right).length,
    );

  return indexReports[0] || manifest.reports[0];
}

/**
 * Converts a legacy attachment name into a human-friendly tab title.
 *
 * @param {string} attachmentName - Raw attachment name from Azure DevOps.
 * @returns {string} Title shown in the UI.
 * @example
 * getLegacyTabTitle('summary.html');
 */
export function getLegacyTabTitle(attachmentName: string): string {
  return attachmentName.split('.')[0];
}
