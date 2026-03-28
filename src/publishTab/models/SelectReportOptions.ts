/**
 * Controls how a report selection should update the UI and navigation state.
 */
export interface SelectReportOptions {
  clearViewerError?: boolean;
  onSelected?: () => void;
  pushHistory: boolean;
  syncLocationHash?: boolean;
}
