import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SettingsPageContainer } from '../../src/settingsPage/controllers/SettingsPageContainer';
import type { TrackingPort } from '../../src/publishTab/domain/tracking';

describe('SettingsPageContainer', () => {
  const trackingPort: TrackingPort = {
    track: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the persisted tracking setting on mount', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: false }),
      updateSettings: jest.fn(),
    };

    render(
      <SettingsPageContainer
        appVersion="1.2.3"
        repository={repository}
        trackingPort={trackingPort}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {
          name: 'Enable anonymous tracking',
        }),
      ).not.toBeChecked();
    });
    expect(trackingPort.track).toHaveBeenCalledWith({
      name: 'tracking_settings_opened',
      payload: {
        extensionVersion: '1.2.3',
        scope: 'organization',
        source: 'settings_page',
      },
    });
  });

  it('persists tracking changes immediately and shows a saved message', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: true }),
      updateSettings: jest.fn().mockResolvedValue({ trackingEnabled: false }),
    };

    render(
      <SettingsPageContainer
        appVersion="1.2.3"
        repository={repository}
        trackingPort={trackingPort}
      />,
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Enable anonymous tracking',
    });

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({
        trackingEnabled: false,
      });
    });
    expect(screen.getByText('Settings saved.')).toBeInTheDocument();
    expect(trackingPort.track).toHaveBeenCalledWith({
      name: 'tracking_disabled',
      payload: {
        extensionVersion: '1.2.3',
        scope: 'organization',
        source: 'settings_page',
      },
    });
  });

  it('sends tracking_disabled before persisting a disable action', async () => {
    const callOrder: string[] = [];
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: true }),
      updateSettings: jest.fn().mockImplementation(async () => {
        callOrder.push('save');
        return { trackingEnabled: false };
      }),
    };
    const orderedTrackingPort: TrackingPort = {
      track: jest.fn().mockImplementation(async (event) => {
        if (event.name === 'tracking_disabled') {
          callOrder.push('track_disabled');
        }
      }),
    };

    render(
      <SettingsPageContainer
        appVersion="1.2.3"
        repository={repository}
        trackingPort={orderedTrackingPort}
      />,
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Enable anonymous tracking',
    });

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({
        trackingEnabled: false,
      });
    });

    expect(callOrder).toContain('track_disabled');
    expect(callOrder.indexOf('track_disabled')).toBeLessThan(
      callOrder.indexOf('save'),
    );
  });

  it('restores the previous value when saving fails', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: true }),
      updateSettings: jest.fn().mockRejectedValue(new Error('Save failed')),
    };

    render(
      <SettingsPageContainer
        appVersion="1.2.3"
        repository={repository}
        trackingPort={trackingPort}
      />,
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Enable anonymous tracking',
    });

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Unable to save settings right now. Your last change was not persisted.',
        ),
      ).toBeInTheDocument();
    });
    expect(checkbox).toBeChecked();
    expect(trackingPort.track).toHaveBeenCalledWith({
      name: 'tracking_error_occurred',
      payload: {
        errorKind: 'unknown',
        extensionVersion: '1.2.3',
        operation: 'save_settings',
        scope: 'organization',
        source: 'settings_page',
        surface: 'settings_page',
      },
    });
  });
});
