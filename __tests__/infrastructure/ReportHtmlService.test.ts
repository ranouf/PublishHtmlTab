import {
  INTERNAL_REPORT_LINK_ATTRIBUTE,
  INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE,
} from '../../src/publishTab/constants';
import type {
  ReportManifest,
  ReportManifestEntry,
} from '../../src/publishTab/models';
import type { AttachmentClient } from '../../src/publishTab/services/attachments/AttachmentClient';
import { ReportHtmlService } from '../../src/publishTab/services/reports/ReportHtmlService';

describe('ReportHtmlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (URL.createObjectURL as jest.Mock).mockReturnValue('blob:script-url');
  });

  it('wraps legacy HTML without rewriting when no manifest is provided', async () => {
    const attachmentClient = createAttachmentClient({
      getReportContent: async () => '<html><body>legacy</body></html>',
    });
    const service = new ReportHtmlService(
      attachmentClient as unknown as AttachmentClient,
    );

    const html = await service.getReportFrameHtml('legacy-report');

    expect(html).toContain('srcdoc="&lt;html&gt;&lt;body&gt;legacy');
  });

  it('throws when the requested report is missing from the manifest', async () => {
    const service = new ReportHtmlService(
      createAttachmentClient() as unknown as AttachmentClient,
    );
    const manifest = createManifest([
      createEntry({ attachmentName: 'index.html', isHtml: true }),
    ]);

    await expect(
      service.getReportFrameHtml('missing.html', manifest),
    ).rejects.toThrow('Report missing.html was not found in the manifest');
  });

  it('rewrites internal report links, assets, linked stylesheets, and linked scripts', async () => {
    const attachmentClient = createAttachmentClient({
      getReportContent: async (attachmentName) => {
        switch (attachmentName) {
          case 'index.html':
            return `
              <html>
                <head>
                  <link rel="stylesheet" href="css/site.css">
                  <script src="scripts/app.js"></script>
                  <style>.inline { background:url("images/bg.png"); }</style>
                </head>
                <body>
                  <img src="images/logo.png">
                  <a id="details" href="pages/details.html">Details</a>
                  <a id="download" href="docs/report.pdf">Download</a>
                </body>
              </html>
            `;
          case 'site.css':
            return '.report { background:url("../images/bg.png"); }';
          case 'app.js':
            return 'console.log("report");';
          default:
            throw new Error(`Unexpected attachment ${attachmentName}`);
        }
      },
      getReportUrl: (attachmentName) => `https://downloads/${attachmentName}`,
    });
    const service = new ReportHtmlService(
      attachmentClient as unknown as AttachmentClient,
    );
    const manifest = createManifest([
      createEntry({ attachmentName: 'index.html', isHtml: true, relativePath: 'index.html' }),
      createEntry({
        attachmentName: 'details.html',
        displayName: 'Details',
        fileName: 'details.html',
        isHtml: true,
        relativePath: 'pages/details.html',
      }),
      createEntry({
        attachmentName: 'logo.png',
        displayName: 'Logo',
        fileName: 'logo.png',
        relativePath: 'images/logo.png',
      }),
      createEntry({
        attachmentName: 'bg.png',
        displayName: 'Background',
        fileName: 'bg.png',
        relativePath: 'images/bg.png',
      }),
      createEntry({
        attachmentName: 'site.css',
        displayName: 'Styles',
        fileName: 'site.css',
        relativePath: 'css/site.css',
      }),
      createEntry({
        attachmentName: 'app.js',
        displayName: 'Script',
        fileName: 'app.js',
        relativePath: 'scripts/app.js',
      }),
      createEntry({
        attachmentName: 'report.pdf',
        displayName: 'PDF',
        fileName: 'report.pdf',
        relativePath: 'docs/report.pdf',
      }),
    ]);

    const frameHtml = await service.getReportFrameHtml('index.html', manifest);
    const srcdoc = extractSrcdoc(frameHtml);

    expect(srcdoc).toContain(`href="#report=details.html"`);
    expect(srcdoc).toContain(
      `${INTERNAL_REPORT_LINK_ATTRIBUTE}="details.html"`,
    );
    expect(srcdoc).toContain('href="https://downloads/report.pdf"');
    expect(srcdoc).toContain('src="https://downloads/logo.png"');
    expect(srcdoc).toContain('url("https://downloads/bg.png")');
    expect(srcdoc).toContain('src="blob:script-url"');
    expect(srcdoc).toContain('publish-html-tab:height');
    expect(srcdoc).toContain('publish-html-tab:navigate');
  });

  it('marks missing anchors when a relative target cannot be resolved', async () => {
    const attachmentClient = createAttachmentClient({
      getReportContent: async () =>
        '<html><body><a href="missing/details.html">Missing</a></body></html>',
    });
    const service = new ReportHtmlService(
      attachmentClient as unknown as AttachmentClient,
    );
    const manifest = createManifest([
      createEntry({ attachmentName: 'index.html', isHtml: true, relativePath: 'index.html' }),
    ]);

    const frameHtml = await service.getReportFrameHtml('index.html', manifest);
    const srcdoc = extractSrcdoc(frameHtml);

    expect(srcdoc).toContain('href="#"');
    expect(srcdoc).toContain(
      `${INTERNAL_REPORT_MISSING_LINK_ATTRIBUTE}="missing/details.html"`,
    );
  });

  it('reuses cached linked assets and revokes blob URLs on dispose', async () => {
    const attachmentClient = createAttachmentClient({
      getReportContent: jest.fn(async (attachmentName: string) => {
        if (attachmentName === 'index.html') {
          return `
            <html>
              <head><script src="scripts/app.js"></script></head>
              <body>report</body>
            </html>
          `;
        }

        return 'console.log("cached");';
      }),
    });
    const service = new ReportHtmlService(
      attachmentClient as unknown as AttachmentClient,
    );
    const manifest = createManifest([
      createEntry({ attachmentName: 'index.html', isHtml: true, relativePath: 'index.html' }),
      createEntry({
        attachmentName: 'app.js',
        displayName: 'Script',
        fileName: 'app.js',
        relativePath: 'scripts/app.js',
      }),
    ]);

    await service.getReportFrameHtml('index.html', manifest);
    await service.getReportFrameHtml('index.html', manifest);

    expect(attachmentClient.getReportContent).toHaveBeenCalledTimes(3);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    service.dispose();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:script-url');
  });
});

function createAttachmentClient(overrides?: {
  getReportContent?: (attachmentName: string) => Promise<string>;
  getReportUrl?: (attachmentName: string) => string;
}): {
  getReportContent: jest.MockedFunction<(attachmentName: string) => Promise<string>>;
  getReportUrl: jest.MockedFunction<(attachmentName: string) => string>;
} {
  return {
    getReportContent: jest.fn(
      overrides?.getReportContent ?? (async () => '<html><body>report</body></html>'),
    ),
    getReportUrl: jest.fn(
      overrides?.getReportUrl ?? ((attachmentName: string) => `https://downloads/${attachmentName}`),
    ),
  };
}

function createManifest(reports: ReportManifestEntry[]): ReportManifest {
  return {
    reports,
    schemaVersion: 1,
    tabName: 'Coverage',
  };
}

function createEntry(
  overrides: Partial<ReportManifestEntry>,
): ReportManifestEntry {
  return {
    attachmentName: 'entry',
    displayName: 'Entry',
    fileName: 'entry.html',
    ...overrides,
  };
}

function extractSrcdoc(frameHtml: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(frameHtml, 'text/html');
  const frame = document.querySelector('iframe');

  return frame?.getAttribute('srcdoc') || '';
}
