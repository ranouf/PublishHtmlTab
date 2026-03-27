import * as React from 'react';

import { ReportViewerProps } from '../../models';

/**
 * Displays either a loading state or the currently selected report HTML.
 *
 * @param {ReportViewerProps} props - Visual state for the report viewer.
 * @param {string} [props.contentHtml] - HTML string to render when content is ready.
 * @param {string} [props.loadingMessage] - Optional loading label shown while content is missing.
 * @returns {JSX.Element} Viewer markup for the selected report.
 */
export function ReportViewer(props: ReportViewerProps): JSX.Element {
  if (!props.contentHtml) {
    // This component stays presentation-only: no content means show the loader.
    return (
      <div className="report-loading-state">
        <div
          aria-hidden="true"
          className="report-loading-spinner"
        />
        <div className="report-loading-text">
          {props.loadingMessage || 'Loading report content...'}
        </div>
      </div>
    );
  }

  return (
    <span
      dangerouslySetInnerHTML={{
        __html: props.contentHtml,
      }}
    />
  );
}
