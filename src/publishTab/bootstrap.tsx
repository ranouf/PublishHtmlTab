import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { Build } from 'azure-devops-extension-api/Build';

import { getSettings } from './application/settings/getSettings';
import { PublishTabContainer } from './controllers/PublishTabContainer';
import { createTrackingPort } from './infrastructure/tracking/createTrackingPort';
import { createSettingsRepository } from './infrastructure/settings/createSettingsRepository';
import { BuildAttachmentClient } from './services/attachments/BuildAttachmentClient';

let renderSequence = 0;

/**
 * Boots the PublishTab feature and subscribes it to Azure DevOps build changes.
 *
 * @param {string} appVersion - Extension version displayed in the UI header.
 * @returns {void} Does not return a value.
 * @throws {Error} Throws when Azure DevOps SDK initialization fails.
 */
export function initializePublishTab(appVersion: string): void {
  // Boot once, then let Azure DevOps push build context updates to the tab.
  SDK.init();

  SDK.ready()
    .then(async () => {
      const resolvedAppVersion = getResolvedAppVersion(appVersion);
      const trackingPort = createTrackingPort(
        await loadOrganizationTrackingEnabled(),
      );
      const configuration = SDK.getConfiguration();
      configuration.onBuildChanged((build: Build) => {
        void renderBuildReports(build, resolvedAppVersion, trackingPort).catch(
          (error) => {
            throw normalizeError(error);
          },
        );
      });
    })
    .catch((error) => {
      throw normalizeError(error);
    });
}

/**
 * Loads the organization-level tracking setting without blocking the extension on failures.
 *
 * @returns {Promise<boolean>} `true` when tracking should remain enabled by default.
 */
async function loadOrganizationTrackingEnabled(): Promise<boolean> {
  try {
    const repository = createSettingsRepository();
    const settings = await getSettings(repository);

    return settings.trackingEnabled;
  } catch {
    return true;
  }
}

/**
 * Loads build attachments and mounts a fresh PublishTab container instance.
 *
 * @param {Build} build - Azure DevOps build currently displayed by the host.
 * @param {string} appVersion - Extension version displayed in the UI header.
 * @returns {Promise<void>} Resolves when the container has been rendered.
 * @throws {Error} Throws when attachment loading fails.
 */
async function renderBuildReports(
  build: Build,
  appVersion: string,
  trackingPort: ReturnType<typeof createTrackingPort>,
): Promise<void> {
  // Each build gets a fresh client and a remounted feature tree.
  const attachmentClient = new BuildAttachmentClient(build);
  await attachmentClient.load();

  const containerElement = document.getElementById(
    'html-report-extention-container',
  );
  if (!containerElement) {
    return;
  }

  const renderKey = `publish-tab-${renderSequence}`;
  renderSequence += 1;

  ReactDOM.render(
    <PublishTabContainer
      appVersion={appVersion}
      attachmentClient={attachmentClient}
      trackingPort={trackingPort}
      buildId={build.id}
      key={renderKey}
    />,
    containerElement,
  );
}

/**
 * Normalizes any thrown value into a real `Error` instance.
 *
 * @param {unknown} error - Raw error-like value.
 * @returns {Error} Error instance safe to rethrow.
 * @example
 * normalizeError('Something failed');
 */
function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Resolves the extension version shown in the UI from the Azure DevOps host context.
 *
 * @param {string} fallbackVersion - Build-time version embedded in the bundle.
 * @returns {string} Host extension version when available, otherwise the build-time fallback.
 */
function getResolvedAppVersion(fallbackVersion: string): string {
  const hostVersion = SDK.getExtensionContext()?.version;
  return hostVersion || fallbackVersion;
}
