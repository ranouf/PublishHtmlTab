import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as SDK from 'azure-devops-extension-sdk';

import { initializePublishTab } from '../../src/publishTab/bootstrap';

const mockLoad = jest.fn();

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

jest.mock('azure-devops-extension-sdk', () => ({
  getConfiguration: jest.fn(),
  init: jest.fn(),
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
    mockLoad.mockResolvedValue(undefined);
    (SDK.ready as jest.Mock).mockResolvedValue(undefined);
    (SDK.getConfiguration as jest.Mock).mockReturnValue({
      onBuildChanged: mockOnBuildChanged.mockImplementation((handler) => {
        void handler(build as never);
      }),
    });
  });

  it('initializes the SDK and renders the publish tab container for the current build', async () => {
    initializePublishTab('1.2.3');
    await flushPromises();

    expect(SDK.init).toHaveBeenCalledTimes(1);
    expect(SDK.ready).toHaveBeenCalledTimes(1);
    expect(mockOnBuildChanged).toHaveBeenCalledTimes(1);
    expect(mockLoad).toHaveBeenCalledTimes(1);

    const [renderedElement, container] = (ReactDOM.render as jest.Mock).mock
      .calls[0];

    expect(React.isValidElement(renderedElement)).toBe(true);
    expect(renderedElement.props.appVersion).toBe('1.2.3');
    expect(renderedElement.props.attachmentClient).toBeDefined();
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
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
