import type {
  ReportManifest,
  ReportManifestEntry,
} from '../../src/publishTab/models';
import {
  findManifestEntryByAttachmentName,
  getLegacyTabTitle,
  getManifestEntries,
  getPreferredReportEntry,
  getReportDirectory,
  getReportPath,
  isIndexReport,
} from '../../src/publishTab/utils/reportManifest';

function createEntry(
  overrides: Partial<ReportManifestEntry>,
): ReportManifestEntry {
  return {
    attachmentName: 'report-1',
    displayName: 'Coverage report',
    fileName: 'coverage.html',
    ...overrides,
  };
}

describe('reportManifest', () => {
  it('returns manifest files when they are available', () => {
    const manifest: ReportManifest = {
      files: [createEntry({ attachmentName: 'file-entry' })],
      reports: [createEntry({ attachmentName: 'report-entry' })],
      schemaVersion: 1,
      tabName: 'Coverage',
    };

    expect(getManifestEntries(manifest)).toEqual(manifest.files);
  });

  it('falls back to reports when no file list exists', () => {
    const manifest: ReportManifest = {
      reports: [createEntry({ attachmentName: 'report-entry' })],
      schemaVersion: 1,
      tabName: 'Coverage',
    };

    expect(getManifestEntries(manifest)).toEqual(manifest.reports);
  });

  it('finds an entry by attachment name', () => {
    const entry = createEntry({ attachmentName: 'details-page' });
    const manifest: ReportManifest = {
      reports: [entry],
      schemaVersion: 1,
      tabName: 'Coverage',
    };

    expect(findManifestEntryByAttachmentName(manifest, 'details-page')).toBe(
      entry,
    );
    expect(findManifestEntryByAttachmentName(manifest, 'missing')).toBeUndefined();
  });

  it('derives the report path using relativePath, displayName, then fileName', () => {
    expect(
      getReportPath(
        createEntry({
          fileName: 'file-name.html',
          relativePath: 'reports/index.html',
        }),
      ),
    ).toBe('reports/index.html');

    expect(
      getReportPath(createEntry({ fileName: 'file-name.html', relativePath: undefined })),
    ).toBe('Coverage report');

    expect(
      getReportPath(
        createEntry({
          displayName: '',
          fileName: 'file-name.html',
          relativePath: undefined,
        }),
      ),
    ).toBe('file-name.html');
  });

  it('returns the containing directory with a trailing slash', () => {
    expect(
      getReportDirectory(
        createEntry({ relativePath: 'reports/coverage/index.html' }),
      ),
    ).toBe('reports/coverage/');
    expect(getReportDirectory(createEntry({ relativePath: 'index.html' }))).toBe(
      '',
    );
  });

  it('detects index reports regardless of extension casing', () => {
    expect(isIndexReport(createEntry({ relativePath: 'reports/index.html' }))).toBe(
      true,
    );
    expect(isIndexReport(createEntry({ relativePath: 'INDEX.HTM' }))).toBe(true);
    expect(
      isIndexReport(createEntry({ relativePath: 'reports/summary.html' })),
    ).toBe(false);
  });

  it('prefers the shortest index report when several entry points exist', () => {
    const rootIndex = createEntry({
      attachmentName: 'root',
      relativePath: 'index.html',
    });
    const nestedIndex = createEntry({
      attachmentName: 'nested',
      relativePath: 'reports/index.html',
    });
    const manifest: ReportManifest = {
      reports: [nestedIndex, rootIndex],
      schemaVersion: 1,
      tabName: 'Coverage',
    };

    expect(getPreferredReportEntry(manifest)).toBe(rootIndex);
  });

  it('falls back to the first report when no index page exists', () => {
    const firstReport = createEntry({ attachmentName: 'first' });
    const manifest: ReportManifest = {
      reports: [firstReport, createEntry({ attachmentName: 'second' })],
      schemaVersion: 1,
      tabName: 'Coverage',
    };

    expect(getPreferredReportEntry(manifest)).toBe(firstReport);
  });

  it('returns a legacy tab title without the extension suffix', () => {
    expect(getLegacyTabTitle('summary.html')).toBe('summary');
  });
});
