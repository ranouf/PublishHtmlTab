import * as SDK from 'azure-devops-extension-sdk';

import { CommonServiceIds } from 'azure-devops-extension-api/Common/CommonServices';

import { AzureDevOpsSettingsRepository } from '../../../src/publishTab/infrastructure/settings/AzureDevOpsSettingsRepository';

const getValueMock = jest.fn();
const setValueMock = jest.fn();

jest.mock('azure-devops-extension-sdk', () => ({
  getAccessToken: jest.fn(),
  getExtensionContext: jest.fn(),
  getService: jest.fn(),
}));

describe('AzureDevOpsSettingsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SDK.getAccessToken as jest.Mock).mockResolvedValue('token-1');
    (SDK.getExtensionContext as jest.Mock).mockReturnValue({
      id: 'ranouf.publish-html-tab',
    });
    (SDK.getService as jest.Mock).mockResolvedValue({
      getExtensionDataManager: jest.fn().mockResolvedValue({
        getValue: getValueMock,
        setValue: setValueMock,
      }),
    });
  });

  it('defaults tracking to enabled when no persisted value exists', async () => {
    getValueMock.mockResolvedValue(undefined);
    const repository = new AzureDevOpsSettingsRepository();

    await expect(repository.getSettings()).resolves.toEqual({
      trackingEnabled: true,
    });
    expect(SDK.getService).toHaveBeenCalledWith(
      CommonServiceIds.ExtensionDataService,
    );
    expect(getValueMock).toHaveBeenCalledWith(
      'publish-html-tab.tracking-enabled',
    );
  });

  it('loads a persisted disabled value', async () => {
    getValueMock.mockResolvedValue(false);
    const repository = new AzureDevOpsSettingsRepository();

    await expect(repository.getSettings()).resolves.toEqual({
      trackingEnabled: false,
    });
  });

  it('falls back to the default setting when the settings collection does not exist yet', async () => {
    getValueMock.mockRejectedValue({
      message: 'The collection does not exist',
      typeKey: 'DocumentCollectionDoesNotExistException',
    });
    const repository = new AzureDevOpsSettingsRepository();

    await expect(repository.getSettings()).resolves.toEqual({
      trackingEnabled: true,
    });
  });

  it('persists the tracking setting through the extension data manager', async () => {
    setValueMock.mockResolvedValue(false);
    const repository = new AzureDevOpsSettingsRepository();

    await expect(
      repository.updateSettings({ trackingEnabled: false }),
    ).resolves.toEqual({
      trackingEnabled: false,
    });
    expect(setValueMock).toHaveBeenCalledWith(
      'publish-html-tab.tracking-enabled',
      false,
    );
  });
});
