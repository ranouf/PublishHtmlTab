import { INTERNAL_REPORT_HASH_KEY } from '../constants';

const INTERNAL_REPORT_BASE_URL = 'https://publish-html-tab.local/';

/**
 * Checks whether a URL should be left untouched by the report rewriter.
 *
 * @param {string} url - URL found inside the report markup.
 * @returns {boolean} `true` when the URL already points outside the report package.
 */
export function isExternalUrl(url: string): boolean {
  return (
    url.startsWith('#') ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) ||
    url.startsWith('//')
  );
}

/**
 * Normalizes a report-relative path to a stable forward-slash form.
 *
 * @param {string} filePath - Raw path value from a manifest or HTML file.
 * @returns {string} The normalized relative path.
 */
export function normalizeReportPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Resolves a relative asset URL against the current report directory.
 *
 * @param {string} reportDirectory - Directory of the current report page.
 * @param {string} relativeUrl - Relative URL found in HTML or CSS.
 * @returns {string} The normalized relative path inside the published report package.
 */
export function resolveRelativeReportPath(
  reportDirectory: string,
  relativeUrl: string,
): string {
  // Resolve report assets against a fake origin so URL() can normalize "../" safely.
  const [pathPart] = relativeUrl.split(/[?#]/, 1);
  const baseUrl = new URL(reportDirectory || '.', INTERNAL_REPORT_BASE_URL);
  const resolvedUrl = new URL(pathPart, baseUrl);
  return normalizeReportPath(resolvedUrl.pathname.replace(/^\/+/, ''));
}

/**
 * Builds the hash used to represent the active report page in the browser URL.
 *
 * @param {string} attachmentName - Attachment identifier of the target report.
 * @returns {string} Hash fragment for the selected report page.
 * @example
 * createInternalReportHash('index.html');
 */
export function createInternalReportHash(attachmentName: string): string {
  const params = new URLSearchParams();
  params.set(INTERNAL_REPORT_HASH_KEY, attachmentName);
  return `#${params.toString()}`;
}

/**
 * Extracts the active report attachment name from the browser hash.
 *
 * @param {string} locationHash - Current `window.location.hash` value.
 * @returns {string | undefined} The selected attachment name when present.
 */
export function getAttachmentNameFromHash(
  locationHash: string,
): string | undefined {
  if (!locationHash || locationHash === '#') {
    return undefined;
  }

  const params = new URLSearchParams(locationHash.replace(/^#/, ''));
  return params.get(INTERNAL_REPORT_HASH_KEY) || undefined;
}
