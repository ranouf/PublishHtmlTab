import {
  createInternalReportHash,
  getAttachmentNameFromHash,
  isExternalUrl,
  normalizeReportPath,
  resolveRelativeReportPath,
} from '../../src/publishTab/utils/reportPaths';

describe('reportPaths', () => {
  describe('isExternalUrl', () => {
    it('returns true for hash links, absolute URLs, and protocol-relative URLs', () => {
      expect(isExternalUrl('#summary')).toBe(true);
      expect(isExternalUrl('https://example.com/report')).toBe(true);
      expect(isExternalUrl('//cdn.example.com/report.css')).toBe(true);
      expect(isExternalUrl('mailto:test@example.com')).toBe(true);
    });

    it('returns false for relative report paths', () => {
      expect(isExternalUrl('assets/site.css')).toBe(false);
      expect(isExternalUrl('../details/index.html')).toBe(false);
    });
  });

  describe('normalizeReportPath', () => {
    it('converts backslashes and strips leading dot-slashes', () => {
      expect(normalizeReportPath('./reports\\summary\\index.html')).toBe(
        'reports/summary/index.html',
      );
    });
  });

  describe('resolveRelativeReportPath', () => {
    it('normalizes relative paths and removes query strings and hashes', () => {
      expect(
        resolveRelativeReportPath(
          'reports/coverage/',
          '../assets/site.css?v=1#top',
        ),
      ).toBe('reports/assets/site.css');
    });

    it('uses the current directory when no report directory is provided', () => {
      expect(resolveRelativeReportPath('', './index.html')).toBe('index.html');
    });
  });

  describe('hash helpers', () => {
    it('round-trips an attachment name through the internal hash format', () => {
      const hash = createInternalReportHash('reports/index.html');

      expect(hash).toBe('#report=reports%2Findex.html');
      expect(getAttachmentNameFromHash(hash)).toBe('reports/index.html');
    });

    it('returns undefined when the hash does not contain a selected report', () => {
      expect(getAttachmentNameFromHash('')).toBeUndefined();
      expect(getAttachmentNameFromHash('#')).toBeUndefined();
    });
  });
});
