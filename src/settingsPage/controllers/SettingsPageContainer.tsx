import * as React from 'react';

import { getSettings } from '../../publishTab/application/settings/getSettings';
import { trackTrackingDisabled } from '../../publishTab/application/tracking/trackTrackingDisabled';
import { trackTrackingEnabled } from '../../publishTab/application/tracking/trackTrackingEnabled';
import { trackTrackingErrorOccurred } from '../../publishTab/application/tracking/trackTrackingErrorOccurred';
import { trackTrackingSettingsOpened } from '../../publishTab/application/tracking/trackTrackingSettingsOpened';
import { updateSettings } from '../../publishTab/application/settings/updateSettings';
import { SettingsRepository } from '../../publishTab/domain/settings';
import {
  BaseSettingsTrackingPayload,
  TrackingPort,
} from '../../publishTab/domain/tracking';
import { normalizeErrorKind } from '../../publishTab/infrastructure/tracking/sanitizers';
import { SettingsPageView } from '../ui/components/SettingsPageView';

interface SettingsPageContainerProps {
  appVersion: string;
  repository: SettingsRepository;
  trackingPort: TrackingPort;
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
    this.runTrackingTask(
      trackTrackingSettingsOpened(
        this.props.trackingPort,
        this.getSettingsTrackingPayload(),
      ),
    );
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
      this.applyLoadedSettings(settings.trackingEnabled);
    } catch (error) {
      this.handleLoadError(error);
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
    this.trackTrackingDisabledBeforeSaveIfNeeded(trackingEnabled);

    void updateSettings(this.props.repository, { trackingEnabled })
      .then((savedSettings) => {
        this.handleSaveSuccess(savedSettings.trackingEnabled);
      })
      .catch((error) => {
        this.handleSaveError(previousValue, error);
      });
  };

  /**
   * Applies settings loaded successfully from persistence.
   *
   * @param {boolean} trackingEnabled - Persisted tracking state.
   * @returns {void} Does not return a value.
   */
  private applyLoadedSettings(trackingEnabled: boolean): void {
    if (!this.isMountedFlag) {
      return;
    }

    this.setState({
      trackingEnabled,
      errorMessage: undefined,
      isLoading: false,
      statusMessage: undefined,
    });
  }

  /**
   * Handles a settings-load failure with a sanitized tracking event and user-facing error.
   *
   * @param {unknown} error - Raw storage error.
   * @returns {void} Does not return a value.
   */
  private handleLoadError(error: unknown): void {
    if (!this.isMountedFlag) {
      return;
    }

    this.trackSettingsError('load_settings', error);
    this.setState({
      errorMessage:
        'Unable to load settings right now. Please refresh and try again.',
      isLoading: false,
      statusMessage: undefined,
    });
  }

  /**
   * Handles a successful settings save by emitting the matching tracking event and updating state.
   *
   * @param {boolean} trackingEnabled - Persisted tracking state.
   * @returns {void} Does not return a value.
   */
  private handleSaveSuccess(trackingEnabled: boolean): void {
    if (!this.isMountedFlag) {
      return;
    }

    this.trackTrackingEnabledAfterSaveIfNeeded(trackingEnabled);
    this.completeSaving(trackingEnabled);
  }

  /**
   * Handles a settings-save failure with a sanitized tracking event and state rollback.
   *
   * @param {boolean} previousValue - Previously persisted tracking state.
   * @param {unknown} error - Raw storage error.
   * @returns {void} Does not return a value.
   */
  private handleSaveError(previousValue: boolean, error: unknown): void {
    if (!this.isMountedFlag) {
      return;
    }

    this.trackSettingsError('save_settings', error);
    this.failSaving(previousValue);
  }

  /**
   * Builds the shared settings tracking payload.
   *
   * @returns {BaseSettingsTrackingPayload} Shared settings tracking payload.
   */
  private getSettingsTrackingPayload(): BaseSettingsTrackingPayload {
    return {
      extensionVersion: this.props.appVersion,
      scope: 'organization',
      source: 'settings_page',
    };
  }

  /**
   * Emits the sanitized tracking event matching the saved settings preference.
   *
   * @param {trackingEnabled} trackingEnabled - Persisted tracking state.
   * @returns {void} Does not return a value.
   */
  private trackTrackingDisabledBeforeSaveIfNeeded(
    trackingEnabled: boolean,
  ): void {
    if (trackingEnabled) {
      return;
    }

    this.runTrackingTask(
      trackTrackingDisabled(
        this.props.trackingPort,
        this.getSettingsTrackingPayload(),
      ),
    );
  }

  /**
   * Emits the enabled event only after the persisted save succeeds.
   *
   * @param {boolean} trackingEnabled - Persisted tracking state.
   * @returns {void} Does not return a value.
   */
  private trackTrackingEnabledAfterSaveIfNeeded(
    trackingEnabled: boolean,
  ): void {
    if (!trackingEnabled) {
      return;
    }

    this.runTrackingTask(
      trackTrackingEnabled(
        this.props.trackingPort,
        this.getSettingsTrackingPayload(),
      ),
    );
  }

  /**
   * Emits a sanitized settings error event without exposing raw error details.
   *
   * @param {'load_settings' | 'save_settings'} operation - Settings operation that failed.
   * @param {unknown} error - Raw error value.
   * @returns {void} Does not return a value.
   */
  private trackSettingsError(
    operation: 'load_settings' | 'save_settings',
    error: unknown,
  ): void {
    this.runTrackingTask(
      trackTrackingErrorOccurred(this.props.trackingPort, {
        ...this.getSettingsTrackingPayload(),
        errorKind: normalizeErrorKind(error),
        operation,
        surface: 'settings_page',
      }),
    );
  }

  /**
   * Executes one tracking task without surfacing failures to the UI.
   *
   * @param {Promise<void>} task - Tracking task to execute.
   * @returns {void} Does not return a value.
   */
  private runTrackingTask(task: Promise<void>): void {
    task.catch(() => {
      return;
    });
  }

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
