/**
 * Represents a postMessage payload sent by the embedded report frame.
 */
export interface EmbeddedReportMessage {
  type?: string;
  attachmentName?: string;
  height?: number;
  missingTarget?: string;
}
