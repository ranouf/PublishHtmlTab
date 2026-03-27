import * as React from 'react';
import { act, render, screen } from '@testing-library/react';

import type { PublishTabHeaderTab } from '../../src/publishTab/models';
import { useAnimatedTabs } from '../../src/publishTab/ui/hooks/useAnimatedTabs';

describe('useAnimatedTabs', () => {
  const tabs: PublishTabHeaderTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Details' },
  ];

  it('measures the selected tab and updates overflow state', () => {
    let latestState = createEmptyHookState();

    render(
      <HookHarness
        onStateChange={(state) => {
          latestState = state;
        }}
        selectedTabId="details"
        tabs={tabs}
      />,
    );

    const viewport = screen.getByTestId('viewport');
    const overviewTab = screen.getByTestId('tab-overview');
    const detailsTab = screen.getByTestId('tab-details');

    setElementMetric(viewport, 'clientWidth', 200);
    setElementMetric(viewport, 'scrollLeft', 0);
    setElementMetric(viewport, 'scrollWidth', 360);
    setElementMetric(overviewTab, 'clientWidth', 80);
    setElementMetric(overviewTab, 'offsetLeft', 0);
    setElementMetric(detailsTab, 'clientWidth', 140);
    setElementMetric(detailsTab, 'offsetLeft', 96);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(latestState.indicator).toEqual({ width: 140, x: 96 });
    expect(latestState.overflow).toEqual({
      canScrollBackward: false,
      canScrollForward: true,
      hasOverflow: true,
    });
  });

  it('scrolls the viewport by one step when the chevrons are used', () => {
    let latestState = createEmptyHookState();

    render(
      <HookHarness
        onStateChange={(state) => {
          latestState = state;
        }}
        selectedTabId="overview"
        tabs={tabs}
      />,
    );

    const viewport = screen.getByTestId('viewport');
    const scrollBy = jest.fn();

    setElementMetric(viewport, 'clientWidth', 250);
    Object.defineProperty(viewport, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });

    act(() => {
      latestState.scrollForward();
      latestState.scrollBackward();
    });

    expect(scrollBy).toHaveBeenNthCalledWith(1, {
      behavior: 'smooth',
      left: 200,
    });
    expect(scrollBy).toHaveBeenNthCalledWith(2, {
      behavior: 'smooth',
      left: -200,
    });
  });

  it('reveals the newly selected tab when selection changes', () => {
    let latestState = createEmptyHookState();
    const { rerender } = render(
      <HookHarness
        onStateChange={(state) => {
          latestState = state;
        }}
        selectedTabId="overview"
        tabs={tabs}
      />,
    );

    const detailsTab = screen.getByTestId('tab-details');
    const scrollIntoView = jest.fn();
    Object.defineProperty(detailsTab, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    rerender(
      <HookHarness
        onStateChange={(state) => {
          latestState = state;
        }}
        selectedTabId="details"
        tabs={tabs}
      />,
    );

    expect(latestState.indicator.x).toBeGreaterThanOrEqual(0);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });
});

type HookState = ReturnType<typeof useAnimatedTabs>;

function HookHarness(props: {
  onStateChange: (state: HookState) => void;
  selectedTabId: string;
  tabs: PublishTabHeaderTab[];
}): JSX.Element {
  const state = useAnimatedTabs(props.selectedTabId, props.tabs);

  React.useEffect(() => {
    props.onStateChange(state);
  }, [props, state]);

  return (
    <div data-testid="viewport" ref={state.viewportRef}>
      {props.tabs.map((tab) => (
        <div
          data-testid={`tab-${tab.id}`}
          key={tab.id}
          ref={state.registerTab(tab.id)}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
}

function createEmptyHookState(): HookState {
  return {
    indicator: { width: 0, x: 0 },
    overflow: {
      canScrollBackward: false,
      canScrollForward: false,
      hasOverflow: false,
    },
    registerTab: () => () => undefined,
    scrollBackward: () => undefined,
    scrollForward: () => undefined,
    viewportRef: { current: null },
  };
}

function setElementMetric(
  element: HTMLElement,
  property: 'clientWidth' | 'offsetLeft' | 'scrollLeft' | 'scrollWidth',
  value: number,
): void {
  Object.defineProperty(element, property, {
    configurable: true,
    value,
  });
}
