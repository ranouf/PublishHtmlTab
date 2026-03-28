import * as React from 'react';

import { SettingsPageViewProps } from '../../models/SettingsPageViewProps';

/**
 * Renders the organization-level settings page for PublishHtmlTab.
 *
 * @param {SettingsPageViewProps} props - View state and interaction callbacks.
 * @returns {JSX.Element} Settings page markup.
 */
export function SettingsPageView(props: SettingsPageViewProps): JSX.Element {
  return (
    <main className="publish-html-settings-shell">
      <section className="publish-html-settings-card">
        <h1 className="publish-html-settings-title">
          Publish HTML Tab settings
        </h1>
        <p className="publish-html-settings-subtitle">
          Control whether this extension sends anonymous usage tracking for your
          Azure DevOps organization.
        </p>

        <h2 className="publish-html-settings-section-title">Tracking</h2>
        <p className="publish-html-settings-section-copy">
          Tracking helps improve the extension by measuring feature usage such
          as tab selection, link clicks, and download interactions. No report
          content or personally identifiable information is intentionally sent.
        </p>

        {renderTrackingToggle(props)}
        {renderStateMessage(props.statusMessage, false)}
        {renderStateMessage(props.errorMessage, true)}

        <p className="publish-html-settings-note">
          This setting is stored with the Azure DevOps Extension Data Service at
          the organization scope and applies across the extension.
        </p>
      </section>
    </main>
  );
}

/**
 * Renders the tracking toggle row.
 *
 * @param {SettingsPageViewProps} props - View state and interaction callbacks.
 * @returns {JSX.Element} Toggle markup.
 */
function renderTrackingToggle(props: SettingsPageViewProps): JSX.Element {
  return (
    <div className="publish-html-settings-toggle-row">
      <input
        aria-label="Enable anonymous tracking"
        checked={props.trackingEnabled}
        className="publish-html-settings-toggle"
        disabled={props.isLoading || props.isSaving}
        id="publish-html-settings-tracking"
        onChange={(event) => {
          props.onTrackingEnabledChange(event.target.checked);
        }}
        type="checkbox"
      />
      <div>
        <label
          className="publish-html-settings-toggle-label"
          htmlFor="publish-html-settings-tracking"
        >
          Enable anonymous tracking
        </label>
        <p className="publish-html-settings-toggle-help">
          Enabled by default unless your organization explicitly turns it off
          here. Browser Do Not Track and the optional local override can still
          block tracking at runtime.
        </p>
      </div>
    </div>
  );
}

/**
 * Renders one optional settings state message.
 *
 * @param {string | undefined} message - Optional message to display.
 * @param {boolean} isError - Indicates whether the message is an error.
 * @returns {JSX.Element | null} Message element or `null` when nothing should be shown.
 */
function renderStateMessage(
  message: string | undefined,
  isError: boolean,
): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`publish-html-settings-state${isError ? ' publish-html-settings-state--error' : ''}`}
    >
      {message}
    </p>
  );
}
