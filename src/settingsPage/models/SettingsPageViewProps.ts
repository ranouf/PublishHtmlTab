/**
 * Defines the presentation-only props used by the settings page view.
 */
export interface SettingsPageViewProps {
  trackingEnabled: boolean;
  errorMessage?: string;
  isLoading: boolean;
  isSaving: boolean;
  onTrackingEnabledChange: (trackingEnabled: boolean) => void;
  statusMessage?: string;
}
