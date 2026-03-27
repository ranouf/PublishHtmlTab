import {
  AnalyticsErrorKind,
  AnalyticsLinkType,
  AnalyticsManifestSizeBucket,
  AnalyticsTargetKind,
} from '../../domain/analytics';
import { EmbeddedReportMessage } from '../../models';
import { isExternalUrl, normalizeReportPath } from '../../utils/reportPaths';

/**
 * Describes the sanitized link metadata extracted from an embedded report click.
 */
export interface SanitizedLinkDetails {
  linkType: AnalyticsLinkType;
  targetKind: AnalyticsTargetKind;
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
 * @returns {SanitizedLinkDetails} Sanitized analytics fields for the clicked link.
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
 * Buckets a manifest entry count into a low-cardinality analytics value.
 *
 * @param {number} entryCount - Number of files exposed by the selected manifest.
 * @returns {AnalyticsManifestSizeBucket} Bucket describing the manifest size.
 */
export function bucketManifestSize(
  entryCount: number,
): AnalyticsManifestSizeBucket {
  if (entryCount <= 1) return '1';
  if (entryCount <= 5) return '2-5';
  if (entryCount <= 10) return '6-10';
  if (entryCount <= 25) return '11-25';
  if (entryCount <= 50) return '26-50';
  return '51+';
}

/**
 * Maps an unknown error into a small analytics-safe failure category.
 *
 * @param {unknown} error - Raw thrown value.
 * @returns {AnalyticsErrorKind} Low-cardinality error category safe to send.
 */
export function normalizeErrorKind(error: unknown): AnalyticsErrorKind {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('unauthorized')
  ) {
    return 'unauthorized';
  }

  if (message.includes('network') || message.includes('failed to fetch')) {
    return 'network';
  }

  if (message.includes('download')) {
    return 'download_failed';
  }

  return 'unknown';
}

/**
 * Builds one sanitized link descriptor from explicit values.
 *
 * @param {AnalyticsLinkType} linkType - High-level link category.
 * @param {AnalyticsTargetKind} targetKind - Normalized target category.
 * @param {string | undefined} targetPath - Raw target path that may need sanitizing.
 * @returns {SanitizedLinkDetails} Sanitized link metadata.
 */
function buildSanitizedLinkDetails(
  linkType: AnalyticsLinkType,
  targetKind: AnalyticsTargetKind,
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
 * @returns {SanitizedLinkDetails} Sanitized analytics fields for the clicked `href`.
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
