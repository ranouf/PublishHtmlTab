import { getSettings } from '../../../src/publishTab/application/settings/getSettings';

describe('getSettings', () => {
  it('loads settings from the repository', async () => {
    const repository = {
      getSettings: jest.fn().mockResolvedValue({ trackingEnabled: false }),
      updateSettings: jest.fn(),
    };

    await expect(getSettings(repository)).resolves.toEqual({
      trackingEnabled: false,
    });
    expect(repository.getSettings).toHaveBeenCalledTimes(1);
  });
});
