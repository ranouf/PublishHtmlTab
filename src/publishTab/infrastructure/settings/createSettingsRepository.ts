import { SettingsRepository } from '../../domain/settings';
import { AzureDevOpsSettingsRepository } from './AzureDevOpsSettingsRepository';

/**
 * Creates the default settings repository used by the extension runtime.
 *
 * @returns {SettingsRepository} Azure DevOps-backed settings repository.
 */
export function createSettingsRepository(): SettingsRepository {
  return new AzureDevOpsSettingsRepository();
}
