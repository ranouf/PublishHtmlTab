import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { initializePublishTab } from '../../src/publishTab/bootstrap';

const getSettingsMock = jest.fn();
const mockLoad = jest.fn();
const trackingPort = {
  track: jest.fn(),
};

jest.mock('react-dom', () => ({
  render: jest.fn(),
}));

jest.mock('../../src/publishTab/controllers/PublishTabContainer', () => ({
  PublishTabContainer: 'publish-tab-container',
}));

jest.mock('../../src/publishTab/services/attachments/BuildAttachmentClient', () => ({
  BuildAttachmentClient: jest.fn().mockImplementation(() => ({
    load: mockLoad,
  })),
}));

jest.mock(
  '../../src/publishTab/infrastructure/tracking/createTrackingPort',
  () => ({
    createTrackingPort: jest.fn(() => trackingPort),
  }),
);

jest.mock('../../src/publishTab/infrastructure/settings/createSettingsRepository', () => ({
  createSettingsRepository: jest.fn(() => ({
    getSettings: getSettingsMock,
  })),
}));

jest.mock('../../src/publishTab/application/settings/getSettings', () => ({
  getSettings: jest.fn((repository) => repository.getSettings()),
}));

jest.mock('azure-devops-extension-sdk', () => ({
  getAccessToken: jest.fn(),
  getConfiguration: jest.fn(),
  getExtensionContext: jest.fn(),
  init: jest.fn(),
  notifyLoadFailed: jest.fn(),
  notifyLoadSucceeded: jest.fn(),
  ready: jest.fn(),
}));

describe('initializePublishTab', () => {
  const mockOnBuildChanged = jest.fn();
  const build = {
    id: 42,
    project: { id: 'project-1' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML =
      '<div id="html-report-extention-container"></div>';
    trackingPort.track.mockResolvedValue(undefined);
    getSettingsMock.mockResolvedValue({ trackingEnabled: true });
    mockLoad.mockResolvedValue(undefined);
    (SDK.ready as jest.Mock).mockResolvedValue(undefined);
    (SDK.getExtensionContext as jest.Mock).mockReturnValue({
      version: '9.9.9',
    });
    (SDK.getConfiguration as jest.Mock).mockReturnValue({
      onBuildChanged: mockOnBuildChanged.mockImplementation((handler) => {
        void handler(build as never);
      }),
    });
  });

  it('prefers the Azure DevOps host extension version over the build-time fallback', async () => {
    initializePublishTab('1.2.3');
    await flushPromises();

    expect(SDK.init).toHaveBeenCalledTimes(1);
    expect(SDK.ready).toHaveBeenCalledTimes(1);
    expect(getSettingsMock).toHaveBeenCalledTimes(1);
    expect(mockOnBuildChanged).toHaveBeenCalledTimes(1);
    expect(mockLoad).toHaveBeenCalledTimes(1);

    const [renderedElement, container] = (ReactDOM.render as jest.Mock).mock
      .calls[0];

    expect(React.isValidElement(renderedElement)).toBe(true);
    expect(renderedElement.props.appVersion).toBe('9.9.9');
    expect(renderedElement.props.attachmentClient).toBeDefined();
    expect(renderedElement.props.trackingPort).toBe(trackingPort);
    expect(renderedElement.props.buildId).toBe(42);
    expect(renderedElement.key).toBe('publish-tab-0');
    expect(container).toBe(
      document.getElementById('html-report-extention-container'),
    );
  });

  it('skips rendering when the extension container is missing', async () => {
    document.body.innerHTML = '';

    initializePublishTab('1.2.3');
    await flushPromises();

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(ReactDOM.render).not.toHaveBeenCalled();
  });

  it('falls back to the build-time version when the host context has no version', async () => {
    (SDK.getExtensionContext as jest.Mock).mockReturnValue({});

    initializePublishTab('1.2.3');
    await flushPromises();

    const [renderedElement] = (ReactDOM.render as jest.Mock).mock.calls[0];
    expect(renderedElement.props.appVersion).toBe('1.2.3');
  });

  it('defaults tracking to enabled when loading settings fails', async () => {
    const { createTrackingPort } = jest.requireMock(
      '../../src/publishTab/infrastructure/tracking/createTrackingPort',
    ) as {
      createTrackingPort: jest.Mock;
    };
    getSettingsMock.mockRejectedValue(new Error('Settings unavailable'));

    initializePublishTab('1.2.3');
    await flushPromises();

    expect(createTrackingPort).toHaveBeenCalledWith(true);
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
