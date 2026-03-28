import * as SDK from 'azure-devops-extension-sdk';

import {
  CommonServiceIds,
  IExtensionDataManager,
  IExtensionDataService,
} from 'azure-devops-extension-api/Common/CommonServices';

import {
  defaultExtensionSettings,
  ExtensionSettings,
  SettingsRepository,
} from '../../domain/settings';

const TRACKING_ENABLED_KEY = 'publish-html-tab.tracking-enabled';

/**
 * Loads and persists extension settings through the Azure DevOps Extension Data Service.
 */
export class AzureDevOpsSettingsRepository implements SettingsRepository {
  private dataManagerPromise?: Promise<IExtensionDataManager>;

  /**
   * Loads the current organization-level settings.
   *
   * @returns {Promise<ExtensionSettings>} Persisted settings or safe defaults.
   */
  public async getSettings(): Promise<ExtensionSettings> {
    const manager = await this.getDataManager();
    const trackingEnabled = await this.getPersistedTrackingEnabled(manager);

    return {
      trackingEnabled:
        trackingEnabled === undefined
          ? defaultExtensionSettings.trackingEnabled
          : trackingEnabled !== false,
    };
  }

  /**
   * Persists the provided organization-level settings.
   *
   * @param {ExtensionSettings} settings - Settings to persist.
   * @returns {Promise<ExtensionSettings>} Saved settings.
   */
  public async updateSettings(
    settings: ExtensionSettings,
  ): Promise<ExtensionSettings> {
    const manager = await this.getDataManager();
    const trackingEnabled = settings.trackingEnabled !== false;

    await manager.setValue<boolean>(TRACKING_ENABLED_KEY, trackingEnabled);

    return {
      trackingEnabled,
    };
  }

  /**
   * Resolves the Azure DevOps extension data manager once per page load.
   *
   * @returns {Promise<IExtensionDataManager>} Extension data manager bound to this extension.
   */
  private getDataManager(): Promise<IExtensionDataManager> {
    if (!this.dataManagerPromise) {
      this.dataManagerPromise = createExtensionDataManager();
    }

    return this.dataManagerPromise;
  }

  /**
   * Loads the persisted tracking flag while treating an uninitialized settings collection as a safe default.
   *
   * @param {IExtensionDataManager} manager - Azure DevOps data manager bound to this extension.
   * @returns {Promise<boolean | undefined>} Persisted tracking flag when it exists.
   * @throws {unknown} Re-throws unexpected storage failures.
   */
  private async getPersistedTrackingEnabled(
    manager: IExtensionDataManager,
  ): Promise<boolean | undefined> {
    try {
      return await manager.getValue<boolean>(TRACKING_ENABLED_KEY);
    } catch (error) {
      if (isMissingSettingsCollectionError(error)) {
        return undefined;
      }

      throw error;
    }
  }
}

/**
 * Creates the Azure DevOps extension data manager for this extension.
 *
 * @returns {Promise<IExtensionDataManager>} Data manager used for organization-scoped settings.
 */
async function createExtensionDataManager(): Promise<IExtensionDataManager> {
  const [accessToken, extensionDataService] = await Promise.all([
    SDK.getAccessToken(),
    SDK.getService<IExtensionDataService>(
      CommonServiceIds.ExtensionDataService,
    ),
  ]);

  return extensionDataService.getExtensionDataManager(
    SDK.getExtensionContext().id,
    accessToken,
  );
}

/**
 * Indicates whether Azure DevOps is reporting that the settings collection has not been created yet.
 *
 * @param {unknown} error - Raw storage error raised by the extension data service.
 * @returns {boolean} `true` when the settings collection does not exist yet.
 */
function isMissingSettingsCollectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorCandidate = error as {
    message?: string;
    typeKey?: string;
  };

  return (
    errorCandidate.typeKey === 'DocumentCollectionDoesNotExistException' ||
    errorCandidate.message?.includes('The collection does not exist') === true
  );
}
