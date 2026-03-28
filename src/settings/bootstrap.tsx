import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { createSettingsRepository } from '../publishTab/infrastructure/settings/createSettingsRepository';
import { SettingsPageContainer } from '../settingsPage/controllers/SettingsPageContainer';

/**
 * Boots the Settings page contributed to Azure DevOps organization settings.
 *
 * @returns {void} Does not return a value.
 */
export function initializeSettingsPage(): void {
  SDK.init();

  SDK.ready()
    .then(() => {
      const containerElement = document.getElementById(
        'publish-html-tab-settings-container',
      );
      if (!containerElement) {
        return;
      }

      ReactDOM.render(
        <SettingsPageContainer repository={createSettingsRepository()} />,
        containerElement,
      );

      SDK.notifyLoadSucceeded();
    })
    .catch((error) => {
      SDK.notifyLoadFailed(
        error instanceof Error ? error.message : String(error),
      );
    });
}
