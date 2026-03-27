import * as SDK from 'azure-devops-extension-sdk';
import type { Attachment } from 'azure-devops-extension-api/Build';

import type {
  AttachmentCollections,
  ReportManifest,
} from '../../src/publishTab/models';
import { AttachmentClient } from '../../src/publishTab/services/attachments/AttachmentClient';

jest.mock('azure-devops-extension-sdk', () => ({
  getAccessToken: jest.fn(),
}));

class TestAttachmentClient extends AttachmentClient {
  public prime(attachments: AttachmentCollections): void {
    this.setAttachments(attachments);
  }
}

describe('AttachmentClient', () => {
  let client: TestAttachmentClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TestAttachmentClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    (SDK.getAccessToken as jest.Mock).mockResolvedValue('token-123');
  });

  it('detects manifest mode only when summary and file attachments are both loaded', () => {
    client.prime({
      downloadAttachments: [],
      fileAttachments: [createAttachment('asset.css')],
      summaryAttachments: [createAttachment('manifest.json')],
    });

    expect(client.hasManifestMode()).toBe(true);

    client.prime({
      downloadAttachments: [],
      fileAttachments: [],
      summaryAttachments: [createAttachment('manifest.json')],
    });

    expect(client.hasManifestMode()).toBe(false);
  });

  it('loads and caches manifests from summary attachments', async () => {
    const manifest: ReportManifest = {
      reports: [],
      schemaVersion: 1,
      tabName: 'Coverage',
    };
    client.prime({
      downloadAttachments: [],
      fileAttachments: [],
      summaryAttachments: [createAttachment('manifest.json')],
    });
    fetchMock.mockResolvedValue(
      createTextResponse(JSON.stringify(manifest)),
    );

    await expect(client.getManifest('manifest.json')).resolves.toEqual(manifest);
    await expect(client.getManifest('manifest.json')).resolves.toEqual(manifest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads report content from file attachments when manifest mode is enabled', async () => {
    client.prime({
      downloadAttachments: [],
      fileAttachments: [createAttachment('report.html', 'https://files/report.html')],
      summaryAttachments: [createAttachment('manifest.json')],
    });
    fetchMock.mockResolvedValue(createTextResponse('<html>report</html>'));

    await expect(client.getReportContent('report.html')).resolves.toBe(
      '<html>report</html>',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://files/report.html',
      expect.objectContaining({
        headers: {
          Authorization: expect.stringMatching(/^Basic /),
        },
      }),
    );
  });

  it('returns report URLs from the active attachment source', () => {
    client.prime({
      downloadAttachments: [],
      fileAttachments: [createAttachment('report.html', 'https://files/report.html')],
      summaryAttachments: [createAttachment('manifest.json')],
    });

    expect(client.getReportUrl('report.html')).toBe('https://files/report.html');
  });

  it('triggers an archive download and revokes the blob URL afterwards', async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    client.prime({
      downloadAttachments: [
        createAttachment('archive.zip', 'https://downloads/archive.zip'),
      ],
      fileAttachments: [],
      summaryAttachments: [],
    });
    fetchMock.mockResolvedValue(
      createBlobResponse(new Blob(['archive'], { type: 'application/zip' })),
    );

    await client.downloadReportArchive('archive.zip', 'coverage.zip');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
  });

  it('reuses the Azure DevOps access token across multiple attachment requests', async () => {
    client.prime({
      downloadAttachments: [],
      fileAttachments: [createAttachment('report.html')],
      summaryAttachments: [createAttachment('manifest.json')],
    });
    fetchMock.mockResolvedValue(createTextResponse('content'));

    await client.getReportContent('report.html');
    await client.getReportContent('report.html');

    expect(SDK.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('throws when an attachment download fails', async () => {
    client.prime({
      downloadAttachments: [],
      fileAttachments: [createAttachment('report.html')],
      summaryAttachments: [createAttachment('manifest.json')],
    });
    fetchMock.mockResolvedValue(createErrorResponse('Forbidden'));

    await expect(client.getReportContent('report.html')).rejects.toThrow(
      'Forbidden',
    );
  });
});

function createAttachment(
  name: string,
  href = `https://attachments/${name}`,
): Attachment {
  return {
    _links: {
      self: {
        href,
      },
    },
    name,
  } as unknown as Attachment;
}

function createTextResponse(text: string): Response {
  return {
    ok: true,
    text: async () => text,
  } as Response;
}

function createBlobResponse(blob: Blob): Response {
  return {
    blob: async () => blob,
    ok: true,
  } as Response;
}

function createErrorResponse(statusText: string): Response {
  return {
    ok: false,
    statusText,
  } as Response;
}
