import {
  escapeHtml,
  formatErrorHtml,
  formatNotFoundHtml,
  wrapHtmlInReportFrame,
} from '../../src/publishTab/utils/html';
import { INTERNAL_REPORT_FRAME_ATTRIBUTE } from '../../src/publishTab/constants';

describe('html helpers', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml(`<'test' & "value">`)).toBe(
      '&lt;&#39;test&#39; &amp; &quot;value&quot;&gt;',
    );
  });

  it('formats an escaped error panel', () => {
    expect(formatErrorHtml('<failure>')).toContain('&lt;failure&gt;');
    expect(formatErrorHtml('<failure>')).not.toContain('<failure>');
  });

  it('formats an escaped not-found state', () => {
    const html = formatNotFoundHtml('<Missing>', 'Nothing "here"');

    expect(html).toContain('&lt;Missing&gt;');
    expect(html).toContain('Nothing &quot;here&quot;');
  });

  it('wraps report HTML inside the sandboxed frame markup', () => {
    const frameHtml = wrapHtmlInReportFrame('<div>report</div>', 'report-1');

    expect(frameHtml).toContain('publish-html-tab-report-frame');
    expect(frameHtml).toContain(`${INTERNAL_REPORT_FRAME_ATTRIBUTE}="report-1"`);
    expect(frameHtml).toContain(
      'srcdoc="&lt;div&gt;report&lt;/div&gt;"',
    );
  });
});
