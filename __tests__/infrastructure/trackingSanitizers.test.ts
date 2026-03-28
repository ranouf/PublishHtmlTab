import {
  bucketManifestSize,
  normalizeErrorKind,
  sanitizeLinkDetails,
  sanitizeTrackedPath,
} from '../../src/publishTab/infrastructure/tracking/sanitizers';

describe('tracking sanitizers', () => {
  it('normalizes tracked paths and removes query strings', () => {
    expect(sanitizeTrackedPath('./reports\\coverage.html?token=secret#details')).toBe(
      'reports/coverage.html',
    );
  });

  it('classifies internal report links without exposing raw href fields', () => {
    expect(
      sanitizeLinkDetails({
        attachmentName: 'coverage/index.html',
      }),
    ).toEqual({
      linkType: 'internal',
      targetKind: 'report',
      targetPath: 'coverage/index.html',
    });
  });

  it('classifies external links without forwarding their path', () => {
    expect(
      sanitizeLinkDetails({
        href: 'https://internal.example.local/report?token=secret',
      }),
    ).toEqual({
      linkType: 'external',
      targetKind: 'unknown',
      targetPath: undefined,
    });
  });

  it('normalizes known error categories for tracking-safe reporting', () => {
    expect(normalizeErrorKind(new Error('403 Forbidden'))).toBe('unauthorized');
    expect(normalizeErrorKind(new Error('Failed to fetch'))).toBe('network');
    expect(normalizeErrorKind(new Error('Download failed'))).toBe(
      'download_failed',
    );
  });

  it('buckets manifest sizes into low-cardinality values', () => {
    expect(bucketManifestSize(1)).toBe('1');
    expect(bucketManifestSize(7)).toBe('6-10');
    expect(bucketManifestSize(80)).toBe('51+');
  });
});
