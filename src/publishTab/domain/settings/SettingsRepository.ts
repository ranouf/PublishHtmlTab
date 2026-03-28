import { ExtensionSettings } from './ExtensionSettings';

/**
 * Defines the persistence port used to read and update extension settings.
 */
export interface SettingsRepository {
  /**
   * Loads the organization-level settings for the extension.
   *
   * @returns {Promise<ExtensionSettings>} Persisted settings or safe defaults.
   */
  getSettings(): Promise<ExtensionSettings>;

  /**
   * Persists the organization-level settings for the extension.
   *
   * @param {ExtensionSettings} settings - Settings to persist.
   * @returns {Promise<ExtensionSettings>} Saved settings.
   */
  updateSettings(settings: ExtensionSettings): Promise<ExtensionSettings>;
}
