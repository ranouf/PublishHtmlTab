import { ExtensionSettings, SettingsRepository } from '../../domain/settings';

/**
 * Loads the extension settings through the configured persistence port.
 *
 * @param {SettingsRepository} repository - Repository responsible for settings persistence.
 * @returns {Promise<ExtensionSettings>} Current persisted settings.
 */
export function getSettings(
  repository: SettingsRepository,
): Promise<ExtensionSettings> {
  return repository.getSettings();
}
