import * as React from 'react';

import { MARKETPLACE_URL } from '../../constants';
import { PublishTabHeaderProps } from '../../models';
import { DownloadIcon } from '../icons/DownloadIcon';
import { AnimatedTabBar } from './AnimatedTabBar';

/**
 * Renders the PublishTab header, including summary tabs, legacy tabs, and actions.
 *
 * @param {PublishTabHeaderProps} props - Header data and interaction callbacks.
 * @returns {JSX.Element} Header markup for the current mode.
 */
export function PublishTabHeader(props: PublishTabHeaderProps): JSX.Element {
  // Header rendering stays declarative: tabs in, callbacks out.
  const versionLink = renderVersionLink(props.appVersion);

  return <div className="report-tab-header">{props.isManifestMode
    ? renderManifestHeader(props, versionLink)
    : renderLegacyHeader(props, versionLink)}</div>;
}

/**
 * Renders the legacy header layout used when only one report layer exists.
 *
 * @param {PublishTabHeaderProps} props - Header data and interaction callbacks.
 * @param {JSX.Element} versionLink - Marketplace version link displayed on the right.
 * @returns {JSX.Element} Legacy header markup.
 */
function renderLegacyHeader(
  props: PublishTabHeaderProps,
  versionLink: JSX.Element,
): JSX.Element {
  // Legacy mode only has one tab layer, so the header stays simple.
  if (props.legacyTabs.length > 1) {
    return (
      <AnimatedTabBar
        ariaLabel="Legacy report tabs"
        endAccessory={versionLink}
        onSelectedTabChanged={props.onLegacyTabChange}
        selectedTabId={props.selectedLegacyTabId}
        tabs={props.legacyTabs}
      />
    );
  }

  return renderSingleTitle(props.singleTitle, undefined, props, versionLink);
}

/**
 * Renders the manifest-aware header layout with summary tab support.
 *
 * @param {PublishTabHeaderProps} props - Header data and interaction callbacks.
 * @param {JSX.Element} versionLink - Marketplace version link displayed on the right.
 * @returns {JSX.Element} Manifest header markup.
 */
function renderManifestHeader(
  props: PublishTabHeaderProps,
  versionLink: JSX.Element,
): JSX.Element {
  if (props.summaryTabs.length <= 1) {
    const downloadArchiveFileName = props.showPrimaryDownloadButton
      ? props.summaryTabs[0]?.downloadArchiveFileName
      : undefined;

    return renderSingleTitle(
      props.singleTitle,
      downloadArchiveFileName,
      props,
      versionLink,
    );
  }

  return renderManifestMultiTabHeader(props, versionLink);
}

/**
 * Renders the multi-tab manifest header when several summary tabs are available.
 *
 * @param {PublishTabHeaderProps} props - Header data and interaction callbacks.
 * @param {JSX.Element} versionLink - Marketplace version link displayed on the right.
 * @returns {JSX.Element} Multi-tab manifest header markup.
 */
function renderManifestMultiTabHeader(
  props: PublishTabHeaderProps,
  versionLink: JSX.Element,
): JSX.Element {
  return (
    <div className="report-tab-multi-title-group">
      <AnimatedTabBar
        ariaLabel="Summary tabs"
        endAccessory={versionLink}
        onSelectedTabChanged={props.onSummaryTabChange}
        selectedTabId={props.selectedSummaryTabId}
        tabs={props.summaryTabs}
        renderTrailingAction={(tab) =>
          tab.showDownloadBadge
            ? renderDownloadButton(
                true,
                tab.downloadArchiveFileName,
                props.onDownloadArchive,
              )
            : undefined
        }
      />
    </div>
  );
}

/**
 * Renders the single-title variant used when only one tab is available.
 *
 * @param {string} title - Title displayed in the header.
 * @param {string | undefined} downloadArchiveFileName - Archive file name shown in the tooltip.
 * @param {PublishTabHeaderProps} props - Header data and interaction callbacks.
 * @param {JSX.Element} versionLink - Marketplace version link displayed on the right.
 * @returns {JSX.Element} Single-title header markup.
 */
function renderSingleTitle(
  title: string,
  downloadArchiveFileName: string | undefined,
  props: PublishTabHeaderProps,
  versionLink: JSX.Element,
): JSX.Element {
  return (
    <div className="report-tab-title-layout">
      <div className="report-tab-title-group">
        <button
          className="report-tab-title-button"
          onClick={props.onOpenFirstReport}
          title="Return to the first page"
          type="button"
        >
          <span className="report-tab-title">{title}</span>
        </button>
        {downloadArchiveFileName
          ? renderDownloadButton(
              false,
              downloadArchiveFileName,
              props.onDownloadArchive,
            )
          : null}
      </div>
      <div className="publish-tab-strip__end">{versionLink}</div>
    </div>
  );
}

/**
 * Renders the marketplace version link displayed at the right edge of the header.
 *
 * @param {string} appVersion - Extension version currently displayed to the user.
 * @returns {JSX.Element} Marketplace version link markup.
 */
function renderVersionLink(appVersion: string): JSX.Element {
  return (
    <a
      className="report-tab-version"
      href={MARKETPLACE_URL}
      rel="noopener noreferrer"
      target="_blank"
      title="Open Publish HTML Tab on Visual Studio Marketplace"
    >
      v{appVersion}
    </a>
  );
}

/**
 * Renders the archive download button used in the header.
 *
 * @param {boolean} stopTabSelection - Prevents the parent tab from being selected on click.
 * @param {string | undefined} downloadArchiveFileName - Archive file name displayed in the tooltip.
 * @param {() => void} onDownloadArchive - Callback executed when the user downloads the archive.
 * @returns {JSX.Element} Download button markup.
 */
function renderDownloadButton(
  stopTabSelection: boolean,
  downloadArchiveFileName: string | undefined,
  onDownloadArchive: () => void,
): JSX.Element {
  const tooltip = downloadArchiveFileName
    ? `Download the full tab content archive (${downloadArchiveFileName})`
    : 'Download the full tab content archive';
  const className = `report-tab-action-button publish-tab-strip__action${
    stopTabSelection ? ' report-tab-action-button--in-tab' : ''
  }`;
  const handleMouseDown = stopTabSelection ? preventTabSelection : undefined;

  return (
    <button
      aria-label="Download full tab content archive"
      className={className}
      onClick={(event) => {
        if (stopTabSelection) {
          preventTabSelection(event);
        }
        onDownloadArchive();
      }}
      onMouseDown={handleMouseDown}
      title={tooltip}
      type="button"
    >
      <DownloadIcon />
    </button>
  );
}

/**
 * Prevents a nested action button from triggering the parent tab selection.
 *
 * @param {React.MouseEvent<HTMLButtonElement>} event - Mouse event raised by the nested button.
 * @returns {void} Does not return a value.
 */
function preventTabSelection(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
  event.stopPropagation();
}
