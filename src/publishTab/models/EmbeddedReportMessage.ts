/**
 * Represents a postMessage payload sent by the embedded report frame.
 */
export interface EmbeddedReportMessage {
  attachmentName?: string;
  height?: number;
  href?: string;
  missingTarget?: string;
  type?: string;
}
