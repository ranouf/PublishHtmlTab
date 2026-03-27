import { INTERNAL_REPORT_FRAME_ATTRIBUTE } from '../constants';

/**
 * Escapes unsafe HTML characters so text can be embedded safely into markup.
 *
 * @param {string} value - Raw text that may contain HTML-sensitive characters.
 * @returns {string} The escaped text safe to inject inside HTML.
 * @example
 * escapeHtml('<report>');
 */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] || character,
  );
}

/**
 * Builds a simple HTML error panel for report loading failures.
 *
 * @param {string} message - Error message shown to the user.
 * @returns {string} HTML markup for the error state.
 */
export function formatErrorHtml(message: string): string {
  return `<div class="wide"><p>${escapeHtml(message)}</p></div>`;
}

/**
 * Builds the "not found" state shown when a linked page cannot be resolved.
 *
 * @param {string} title - Short title displayed in the empty state.
 * @param {string} details - Additional context about the missing report.
 * @returns {string} HTML markup for the not-found state.
 */
export function formatNotFoundHtml(title: string, details: string): string {
  return `<div class="report-not-found-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(details)}</p></div>`;
}

/**
 * Wraps report HTML in the iframe markup used by the extension viewer.
 *
 * @param {string} html - Final HTML content to render in `srcdoc`.
 * @param {string} attachmentName - Attachment identifier used for iframe tracking.
 * @returns {string} HTML markup for the wrapped report frame.
 */
export function wrapHtmlInReportFrame(
  html: string,
  attachmentName: string,
): string {
  // Reports are always rendered through a sandboxed iframe-like srcdoc wrapper.
  return (
    '<iframe class="publish-html-tab-report-frame" style="visibility:hidden;" scrolling="no" ' +
    `${INTERNAL_REPORT_FRAME_ATTRIBUTE}="${escapeHtml(attachmentName)}" srcdoc="${escapeHtml(html)}"></iframe>`
  );
}
