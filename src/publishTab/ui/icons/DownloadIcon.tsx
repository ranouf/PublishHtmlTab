import * as React from 'react';

const DOWNLOAD_ICON_PATHS = [
  'M12 15V3',
  'm7 10 5 5 5-5',
  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
];

/**
 * Renders the download glyph used by archive actions.
 *
 * @returns {JSX.Element} SVG icon element.
 */
export function DownloadIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="report-tab-icon"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      {DOWNLOAD_ICON_PATHS.map((pathDefinition) => (
        <path
          d={pathDefinition}
          key={pathDefinition}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
