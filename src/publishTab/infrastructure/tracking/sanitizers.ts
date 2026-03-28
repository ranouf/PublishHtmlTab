import {
  TrackingErrorKind,
  TrackingLinkType,
  TrackingManifestSizeBucket,
  TrackingTargetKind,
} from '../../domain/tracking';
import { EmbeddedReportMessage } from '../../models';
import { isExternalUrl, normalizeReportPath } from '../../utils/reportPaths';

/**
 * Describes the sanitized link metadata extracted from an embedded report click.
 */
export interface SanitizedLinkDetails {
  linkType: TrackingLinkType;
  targetKind: TrackingTargetKind;
  targetPath?: string;
}

/**
 * Removes query strings and normalizes a tracked path to a stable relative form.
 *
 * @param {string | undefined} rawPath - Untrusted path or URL fragment collected from the UI.
 * @returns {string | undefined} Normalized path safe to hash, or `undefined` when empty.
 */
export function sanitizeTrackedPath(
  rawPath: string | undefined,
): string | undefined {
  if (!rawPath) {
    return undefined;
  }

  const trimmedPath = rawPath.trim();
  if (!trimmedPath) {
    return undefined;
  }

  if (trimmedPath.startsWith('#')) {
    return trimmedPath.slice(1) || undefined;
  }

  const [pathPart] = trimmedPath.split(/[?#]/, 1);
  const normalizedPath = normalizeReportPath(pathPart).replace(/^\/+/, '');
  return normalizedPath || undefined;
}

/**
 * Classifies a link click emitted by the embedded report script.
 *
 * @param {Pick<EmbeddedReportMessage, 'attachmentName' | 'href' | 'missingTarget'>} message - Raw link-click message emitted by the iframe.
 * @returns {SanitizedLinkDetails} Sanitized tracking fields for the clicked link.
 */
export function sanitizeLinkDetails(
  message: Pick<
    EmbeddedReportMessage,
    'attachmentName' | 'href' | 'missingTarget'
  >,
): SanitizedLinkDetails {
  if (message.attachmentName) {
    return buildSanitizedLinkDetails(
      'internal',
      'report',
      message.attachmentName,
    );
  }

  if (message.missingTarget) {
    return buildSanitizedLinkDetails(
      'internal',
      'report',
      message.missingTarget,
    );
  }

  return sanitizeHrefLink(message.href);
}

/**
 * Buckets a manifest entry count into a low-cardinality tracking value.
 *
 * @param {number} entryCount - Number of files exposed by the selected manifest.
 * @returns {TrackingManifestSizeBucket} Bucket describing the manifest size.
 */
export function bucketManifestSize(
  entryCount: number,
): TrackingManifestSizeBucket {
  if (entryCount <= 1) return '1';
  if (entryCount <= 5) return '2-5';
  if (entryCount <= 10) return '6-10';
  if (entryCount <= 25) return '11-25';
  if (entryCount <= 50) return '26-50';
  return '51+';
}

/**
 * Maps an unknown error into a small tracking-safe failure category.
 *
 * @param {unknown} error - Raw thrown value.
 * @returns {TrackingErrorKind} Low-cardinality error category safe to send.
 */
export function normalizeErrorKind(error: unknown): TrackingErrorKind {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (containsAny(message, ['401', '403', 'forbidden', 'unauthorized'])) {
    return 'unauthorized';
  }

  if (containsAny(message, ['network', 'failed to fetch'])) {
    return 'network';
  }

  if (containsAny(message, ['404', 'not found'])) {
    return 'not_found';
  }

  if (message.includes('download')) {
    return 'download_failed';
  }

  return 'unknown';
}

/**
 * Indicates whether the provided message contains any of the supplied fragments.
 *
 * @param {string} message - Normalized error message.
 * @param {string[]} fragments - Candidate fragments to search for.
 * @returns {boolean} `true` when at least one fragment is present.
 */
function containsAny(message: string, fragments: string[]): boolean {
  return fragments.some((fragment) => message.includes(fragment));
}

/**
 * Builds one sanitized link descriptor from explicit values.
 *
 * @param {TrackingLinkType} linkType - High-level link category.
 * @param {TrackingTargetKind} targetKind - Normalized target category.
 * @param {string | undefined} targetPath - Raw target path that may need sanitizing.
 * @returns {SanitizedLinkDetails} Sanitized link metadata.
 */
function buildSanitizedLinkDetails(
  linkType: TrackingLinkType,
  targetKind: TrackingTargetKind,
  targetPath?: string,
): SanitizedLinkDetails {
  return {
    linkType,
    targetKind,
    targetPath: sanitizeTrackedPath(targetPath),
  };
}

/**
 * Classifies a raw `href` value emitted by the embedded report iframe.
 *
 * @param {string | undefined} href - Raw `href` attribute value from the clicked anchor.
 * @returns {SanitizedLinkDetails} Sanitized tracking fields for the clicked `href`.
 */
function sanitizeHrefLink(href: string | undefined): SanitizedLinkDetails {
  if (!href) {
    return buildSanitizedLinkDetails('internal', 'unknown');
  }

  if (href.startsWith('#')) {
    return buildSanitizedLinkDetails('internal', 'anchor', href);
  }

  if (isExternalUrl(href)) {
    return buildSanitizedLinkDetails('external', 'unknown');
  }

  return buildSanitizedLinkDetails('internal', 'asset', href);
}
