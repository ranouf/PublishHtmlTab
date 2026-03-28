import { ExtensionSettings, SettingsRepository } from '../../domain/settings';

/**
 * Persists a new set of extension settings through the configured repository.
 *
 * @param {SettingsRepository} repository - Repository responsible for settings persistence.
 * @param {ExtensionSettings} settings - Settings to save.
 * @returns {Promise<ExtensionSettings>} Saved settings.
 */
export function updateSettings(
  repository: SettingsRepository,
  settings: ExtensionSettings,
): Promise<ExtensionSettings> {
  return repository.updateSettings(settings);
}
