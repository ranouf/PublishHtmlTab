import { getClient } from 'azure-devops-extension-api';
import { BuildRestClient } from 'azure-devops-extension-api/Build';

import { BuildAttachmentClient } from '../../src/publishTab/services/attachments/BuildAttachmentClient';
import {
  DOWNLOAD_ATTACHMENT_TYPE,
  FILE_ATTACHMENT_TYPE,
  SUMMARY_ATTACHMENT_TYPE,
} from '../../src/publishTab/constants';

jest.mock('azure-devops-extension-api', () => ({
  getClient: jest.fn(),
}));

jest.mock('azure-devops-extension-api/Build', () => ({
  BuildRestClient: jest.fn(),
}));

jest.mock('azure-devops-extension-sdk', () => ({
  getAccessToken: jest.fn(),
}));

describe('BuildAttachmentClient', () => {
  const build = {
    id: 99,
    project: { id: 'project-1' },
  } as never;

  it('loads every attachment bucket for the active build', async () => {
    const buildClient = {
      getAttachments: jest
        .fn()
        .mockResolvedValueOnce([{ name: 'summary.json' }])
        .mockResolvedValueOnce([{ name: 'report.html' }])
        .mockResolvedValueOnce([{ name: 'archive.zip' }]),
    };
    (getClient as jest.Mock).mockReturnValue(buildClient);

    const client = new BuildAttachmentClient(build);
    await client.load();

    expect(getClient).toHaveBeenCalledWith(BuildRestClient);
    expect(buildClient.getAttachments).toHaveBeenNthCalledWith(
      1,
      'project-1',
      99,
      SUMMARY_ATTACHMENT_TYPE,
    );
    expect(buildClient.getAttachments).toHaveBeenNthCalledWith(
      2,
      'project-1',
      99,
      FILE_ATTACHMENT_TYPE,
    );
    expect(buildClient.getAttachments).toHaveBeenNthCalledWith(
      3,
      'project-1',
      99,
      DOWNLOAD_ATTACHMENT_TYPE,
    );
    expect(client.getSummaryAttachments()).toHaveLength(1);
    expect(client.hasManifestMode()).toBe(true);
  });

  it('propagates Azure DevOps attachment request failures', async () => {
    const buildClient = {
      getAttachments: jest
        .fn()
        .mockRejectedValue(new Error('Attachment lookup failed')),
    };
    (getClient as jest.Mock).mockReturnValue(buildClient);

    const client = new BuildAttachmentClient(build);

    await expect(client.load()).rejects.toThrow('Attachment lookup failed');
  });
});
