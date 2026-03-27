import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { ReportViewer } from '../../src/publishTab/ui/components/ReportViewer';

describe('ReportViewer', () => {
  it('renders a loading state when no HTML content is available', () => {
    render(<ReportViewer />);

    expect(screen.getByText('Loading report content...')).toBeInTheDocument();
    expect(
      document.querySelector('.report-loading-spinner'),
    ).toBeInTheDocument();
  });

  it('renders a custom loading message when one is provided', () => {
    render(<ReportViewer loadingMessage="Loading detailed coverage..." />);

    expect(
      screen.getByText('Loading detailed coverage...'),
    ).toBeInTheDocument();
  });

  it('renders the provided report HTML when content is available', () => {
    render(<ReportViewer contentHtml="<section><h1>Coverage</h1></section>" />);

    expect(
      screen.getByRole('heading', { name: 'Coverage' }),
    ).toBeInTheDocument();
  });
});
