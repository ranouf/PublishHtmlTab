import * as React from 'react';

import { getSettings } from '../../publishTab/application/settings/getSettings';
import { updateSettings } from '../../publishTab/application/settings/updateSettings';
import { SettingsRepository } from '../../publishTab/domain/settings';
import { SettingsPageView } from '../ui/components/SettingsPageView';

interface SettingsPageContainerProps {
  repository: SettingsRepository;
}

interface SettingsPageContainerState {
  trackingEnabled: boolean;
  errorMessage?: string;
  isLoading: boolean;
  isSaving: boolean;
  statusMessage?: string;
}

/**
 * Loads and persists the PublishHtmlTab organization settings.
 */
export class SettingsPageContainer extends React.Component<
  SettingsPageContainerProps,
  SettingsPageContainerState
> {
  private isMountedFlag = false;

  /**
   * Creates the stateful settings page controller.
   *
   * @param {SettingsPageContainerProps} props - Container dependencies.
   */
  constructor(props: SettingsPageContainerProps) {
    super(props);

    this.state = {
      trackingEnabled: true,
      isLoading: true,
      isSaving: false,
    };
  }

  /**
   * Loads persisted settings when the page first mounts.
   *
   * @returns {void} Does not return a value.
   */
  public componentDidMount(): void {
    this.isMountedFlag = true;
    void this.loadSettings();
  }

  /**
   * Stops state updates after the page unmounts.
   *
   * @returns {void} Does not return a value.
   */
  public componentWillUnmount(): void {
    this.isMountedFlag = false;
  }

  /**
   * Renders the presentation-only settings page.
   *
   * @returns {JSX.Element} Settings page view.
   */
  public render(): JSX.Element {
    return (
      <SettingsPageView
        trackingEnabled={this.state.trackingEnabled}
        errorMessage={this.state.errorMessage}
        isLoading={this.state.isLoading}
        isSaving={this.state.isSaving}
        onTrackingEnabledChange={this.handleTrackingEnabledChange}
        statusMessage={this.state.statusMessage}
      />
    );
  }

  /**
   * Loads the persisted organization settings.
   *
   * @returns {Promise<void>} Resolves when settings have been loaded into state.
   */
  private async loadSettings(): Promise<void> {
    try {
      const settings = await getSettings(this.props.repository);
      if (!this.isMountedFlag) {
        return;
      }

      this.setState({
        trackingEnabled: settings.trackingEnabled,
        errorMessage: undefined,
        isLoading: false,
        statusMessage: undefined,
      });
    } catch {
      if (!this.isMountedFlag) {
        return;
      }

      this.setState({
        errorMessage:
          'Unable to load settings right now. Please refresh and try again.',
        isLoading: false,
        statusMessage: undefined,
      });
    }
  }

  /**
   * Persists the tracking toggle immediately after a user change.
   *
   * @param {boolean} trackingEnabled - New tracking enabled state selected by the user.
   * @returns {void} Does not return a value.
   */
  private handleTrackingEnabledChange = (trackingEnabled: boolean): void => {
    const previousValue = this.state.trackingEnabled;

    this.beginSaving(trackingEnabled);

    void updateSettings(this.props.repository, { trackingEnabled })
      .then((savedSettings) => {
        if (!this.isMountedFlag) {
          return;
        }

        this.completeSaving(savedSettings.trackingEnabled);
      })
      .catch(() => {
        if (!this.isMountedFlag) {
          return;
        }

        this.failSaving(previousValue);
      });
  };

  /**
   * Updates the UI to reflect a settings save in progress.
   *
   * @param {boolean} trackingEnabled - Pending tracking enabled state.
   * @returns {void} Does not return a value.
   */
  private beginSaving(trackingEnabled: boolean): void {
    this.setState({
      trackingEnabled,
      errorMessage: undefined,
      isSaving: true,
      statusMessage: undefined,
    });
  }

  /**
   * Updates the UI after settings have been saved successfully.
   *
   * @param {boolean} trackingEnabled - Saved tracking enabled state.
   * @returns {void} Does not return a value.
   */
  private completeSaving(trackingEnabled: boolean): void {
    this.setState({
      trackingEnabled,
      isSaving: false,
      statusMessage: 'Settings saved.',
    });
  }

  /**
   * Restores the previous value after a failed save operation.
   *
   * @param {boolean} trackingEnabled - Previously persisted tracking enabled state.
   * @returns {void} Does not return a value.
   */
  private failSaving(trackingEnabled: boolean): void {
    this.setState({
      trackingEnabled,
      errorMessage:
        'Unable to save settings right now. Your last change was not persisted.',
      isSaving: false,
      statusMessage: undefined,
    });
  }
}
