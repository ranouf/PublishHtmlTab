import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { Build } from 'azure-devops-extension-api/Build';

import { PublishTabContainer } from './controllers/PublishTabContainer';
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
    .then(() => {
      const configuration = SDK.getConfiguration();
      configuration.onBuildChanged((build: Build) => {
        void renderBuildReports(build, appVersion).catch((error) => {
          throw normalizeError(error);
        });
      });
    })
    .catch((error) => {
      throw normalizeError(error);
    });
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
