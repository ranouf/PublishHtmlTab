/**
 * Represents the organization-level extension settings stored in Azure DevOps.
 */
export interface ExtensionSettings {
  trackingEnabled: boolean;
}

/**
 * Defines the safe default settings used when no persisted value exists yet.
 */
export const defaultExtensionSettings: ExtensionSettings = {
  trackingEnabled: true,
};
