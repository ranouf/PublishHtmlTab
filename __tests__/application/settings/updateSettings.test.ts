import { updateSettings } from '../../../src/publishTab/application/settings/updateSettings';

describe('updateSettings', () => {
  it('persists settings through the repository', async () => {
    const repository = {
      getSettings: jest.fn(),
      updateSettings: jest.fn().mockResolvedValue({ trackingEnabled: true }),
    };

    await expect(
      updateSettings(repository, { trackingEnabled: true }),
    ).resolves.toEqual({
      trackingEnabled: true,
    });
    expect(repository.updateSettings).toHaveBeenCalledWith({
      trackingEnabled: true,
    });
  });
});
