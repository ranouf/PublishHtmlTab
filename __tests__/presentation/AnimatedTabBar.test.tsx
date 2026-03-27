import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { AnimatedTabBarProps } from '../../src/publishTab/models';
import { AnimatedTabBar } from '../../src/publishTab/ui/components/AnimatedTabBar';
import { useAnimatedTabs } from '../../src/publishTab/ui/hooks/useAnimatedTabs';

jest.mock('../../src/publishTab/ui/hooks/useAnimatedTabs', () => ({
  useAnimatedTabs: jest.fn(),
}));

describe('AnimatedTabBar', () => {
  const baseProps: AnimatedTabBarProps = {
    ariaLabel: 'Summary tabs',
    endAccessory: <a href="https://example.com">v1.0.0</a>,
    onSelectedTabChanged: jest.fn(),
    renderTrailingAction: (tab) => (
      <button type="button">Download {tab.label}</button>
    ),
    selectedTabId: 'coverage',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'coverage', label: 'Coverage' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnimatedTabs as jest.Mock).mockReturnValue({
      indicator: { width: 120, x: 64 },
      overflow: {
        canScrollBackward: true,
        canScrollForward: false,
        hasOverflow: true,
      },
      registerTab: () => () => undefined,
      scrollBackward: jest.fn(),
      scrollForward: jest.fn(),
      viewportRef: { current: null },
    });
  });

  it('renders tabs, the selected indicator, and the end accessory', () => {
    render(<AnimatedTabBar {...baseProps} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Download Coverage')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(document.querySelector('.publish-tab-strip__indicator')).toHaveStyle({
      transform: 'translateX(64px)',
      width: '120px',
    });
  });

  it('invokes the selection callback when a tab is clicked', () => {
    render(<AnimatedTabBar {...baseProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

    expect(baseProps.onSelectedTabChanged).toHaveBeenCalledWith('overview');
  });

  it('wires both overflow buttons to the hook actions and disables unavailable directions', () => {
    const scrollBackward = jest.fn();
    const scrollForward = jest.fn();
    (useAnimatedTabs as jest.Mock).mockReturnValue({
      indicator: { width: 120, x: 64 },
      overflow: {
        canScrollBackward: true,
        canScrollForward: false,
        hasOverflow: true,
      },
      registerTab: () => () => undefined,
      scrollBackward,
      scrollForward,
      viewportRef: { current: null },
    });

    render(<AnimatedTabBar {...baseProps} />);

    const leftButton = screen.getByRole('button', { name: 'Scroll tabs left' });
    const rightButton = screen.getByRole('button', { name: 'Scroll tabs right' });

    fireEvent.click(leftButton);

    expect(scrollBackward).toHaveBeenCalledTimes(1);
    expect(rightButton).toBeDisabled();
    expect(scrollForward).not.toHaveBeenCalled();
  });
});
