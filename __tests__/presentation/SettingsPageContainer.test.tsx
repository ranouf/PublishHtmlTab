import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SettingsPageContainer } from '../../src/settingsPage/controllers/SettingsPageContainer';

describe('SettingsPageContainer', () => {
  it('loads the persisted tracking setting on mount', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: false }),
      updateSettings: jest.fn(),
    };

    render(<SettingsPageContainer repository={repository} />);

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {
          name: 'Enable anonymous tracking',
        }),
      ).not.toBeChecked();
    });
  });

  it('persists tracking changes immediately and shows a saved message', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: true }),
      updateSettings: jest.fn().mockResolvedValue({ trackingEnabled: false }),
    };

    render(<SettingsPageContainer repository={repository} />);

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
  });

  it('restores the previous value when saving fails', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: true }),
      updateSettings: jest.fn().mockRejectedValue(new Error('Save failed')),
    };

    render(<SettingsPageContainer repository={repository} />);

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
  });
});
