import * as React from 'react';

import { PublishTabHeaderTab } from '../../models';

const EDGE_THRESHOLD = 1;
const SCROLL_STEP_RATIO = 0.8;

type OverflowState = {
  canScrollBackward: boolean;
  canScrollForward: boolean;
  hasOverflow: boolean;
};

type IndicatorState = {
  width: number;
  x: number;
};

/**
 * Manages overflow controls, active tab measurement, and auto-scroll behavior.
 *
 * @param {string} selectedTabId - Identifier of the currently selected tab.
 * @param {PublishTabHeaderTab[]} tabs - Tabs rendered in the current tab list.
 * @returns {{ indicator: IndicatorState; overflow: OverflowState; registerTab: (tabId: string) => (element: HTMLDivElement | null) => void; scrollBackward: () => void; scrollForward: () => void; viewportRef: React.RefObject<HTMLDivElement> }} Refs, indicator state, and overflow actions for the tab bar UI.
 */
export function useAnimatedTabs(
  selectedTabId: string,
  tabs: PublishTabHeaderTab[],
): {
  indicator: IndicatorState;
  overflow: OverflowState;
  registerTab: (tabId: string) => (element: HTMLDivElement | null) => void;
  scrollBackward: () => void;
  scrollForward: () => void;
  viewportRef: React.RefObject<HTMLDivElement>;
} {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const { registerTab, tabElementsRef } = useTabRegistry();
  const indicator = useIndicatorState(tabElementsRef, selectedTabId, tabs);
  const overflow = useOverflowState(viewportRef, indicator, tabs);
  const scrollByStep = useScrollByStep(viewportRef);

  useSelectedTabReveal(tabElementsRef, selectedTabId, tabs);

  return {
    indicator,
    overflow,
    registerTab,
    scrollBackward: () => {
      scrollByStep(-1);
    },
    scrollForward: () => {
      scrollByStep(1);
    },
    viewportRef,
  };
}

/**
 * Creates the registry used to store measured tab elements by id.
 *
 * @returns {{ registerTab: (tabId: string) => (element: HTMLDivElement | null) => void; tabElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>> }} Tab ref registry helpers.
 */
function useTabRegistry(): {
  registerTab: (tabId: string) => (element: HTMLDivElement | null) => void;
  tabElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
} {
  const tabElementsRef = React.useRef<Record<string, HTMLDivElement | null>>(
    {},
  );
  const registerTab = React.useCallback(
    (tabId: string) => (element: HTMLDivElement | null): void => {
      tabElementsRef.current[tabId] = element;
    },
    [],
  );

  return { registerTab, tabElementsRef };
}

/**
 * Tracks the current underline position and width for the active tab.
 *
 * @param {React.MutableRefObject<Record<string, HTMLDivElement | null>>} tabElementsRef - Registered tab elements.
 * @param {string} selectedTabId - Identifier of the currently selected tab.
 * @param {PublishTabHeaderTab[]} tabs - Tabs rendered in the current tab list.
 * @returns {IndicatorState} Underline position and width.
 */
function useIndicatorState(
  tabElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  selectedTabId: string,
  tabs: PublishTabHeaderTab[],
): IndicatorState {
  const [indicator, setIndicator] = React.useState<IndicatorState>({
    width: 0,
    x: 0,
  });
  const updateIndicator = useIndicatorUpdater(tabElementsRef, selectedTabId, setIndicator);

  useIndicatorResizeSync(tabElementsRef, tabs, updateIndicator);
  React.useLayoutEffect(() => {
    updateIndicator();
  }, [tabs, updateIndicator]);

  return indicator;
}

/**
 * Creates the callback used to measure the currently selected tab.
 *
 * @param {React.MutableRefObject<Record<string, HTMLDivElement | null>>} tabElementsRef - Registered tab elements.
 * @param {string} selectedTabId - Identifier of the currently selected tab.
 * @param {React.Dispatch<React.SetStateAction<IndicatorState>>} setIndicator - State setter for the underline position.
 * @returns {() => void} Callback that updates the underline measurement.
 */
function useIndicatorUpdater(
  tabElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  selectedTabId: string,
  setIndicator: React.Dispatch<React.SetStateAction<IndicatorState>>,
): () => void {
  return React.useCallback((): void => {
    const selectedTab = tabElementsRef.current[selectedTabId];
    if (!selectedTab) {
      return;
    }

    setIndicator({
      width: selectedTab.clientWidth,
      x: selectedTab.offsetLeft,
    });
  }, [selectedTabId, setIndicator, tabElementsRef]);
}

/**
 * Keeps the indicator measurement in sync with tab and window resizes.
 *
 * @param {React.MutableRefObject<Record<string, HTMLDivElement | null>>} tabElementsRef - Registered tab elements.
 * @param {PublishTabHeaderTab[]} tabs - Tabs rendered in the current tab list.
 * @param {() => void} updateIndicator - Callback that updates the underline measurement.
 * @returns {void} Does not return a value.
 */
function useIndicatorResizeSync(
  tabElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  tabs: PublishTabHeaderTab[],
  updateIndicator: () => void,
): void {
  React.useEffect(() => {
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(updateIndicator);

    window.addEventListener('resize', updateIndicator);
    tabs.forEach((tab) => {
      const tabElement = tabElementsRef.current[tab.id];
      if (tabElement) {
        resizeObserver?.observe(tabElement);
      }
    });

    return () => {
      window.removeEventListener('resize', updateIndicator);
      resizeObserver?.disconnect();
    };
  }, [tabElementsRef, tabs, updateIndicator]);
}

/**
 * Tracks whether the tab strip currently overflows in either direction.
 *
 * @param {React.RefObject<HTMLDivElement>} viewportRef - Scrollable viewport that hosts the tabs.
 * @param {IndicatorState} indicator - Current underline measurement.
 * @param {PublishTabHeaderTab[]} tabs - Tabs rendered in the current tab list.
 * @returns {OverflowState} Current overflow flags for the tab strip.
 */
function useOverflowState(
  viewportRef: React.RefObject<HTMLDivElement>,
  indicator: IndicatorState,
  tabs: PublishTabHeaderTab[],
): OverflowState {
  const [overflow, setOverflow] = React.useState<OverflowState>({
    canScrollBackward: false,
    canScrollForward: false,
    hasOverflow: false,
  });
  const updateOverflow = useOverflowUpdater(viewportRef, setOverflow);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      updateOverflow();
      return undefined;
    }

    viewport.addEventListener('scroll', updateOverflow, { passive: true });
    window.addEventListener('resize', updateOverflow);
    updateOverflow();

    return () => {
      viewport.removeEventListener('scroll', updateOverflow);
      window.removeEventListener('resize', updateOverflow);
    };
  }, [indicator, tabs, updateOverflow, viewportRef]);

  return overflow;
}

/**
 * Creates the callback used to recompute overflow flags from the viewport.
 *
 * @param {React.RefObject<HTMLDivElement>} viewportRef - Scrollable viewport that hosts the tabs.
 * @param {React.Dispatch<React.SetStateAction<OverflowState>>} setOverflow - State setter for overflow flags.
 * @returns {() => void} Callback that updates the overflow state.
 */
function useOverflowUpdater(
  viewportRef: React.RefObject<HTMLDivElement>,
  setOverflow: React.Dispatch<React.SetStateAction<OverflowState>>,
): () => void {
  return React.useCallback((): void => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const maxScrollLeft = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );
    const hasOverflow = maxScrollLeft > EDGE_THRESHOLD;

    setOverflow({
      canScrollBackward: hasOverflow && viewport.scrollLeft > EDGE_THRESHOLD,
      canScrollForward:
        hasOverflow && viewport.scrollLeft < maxScrollLeft - EDGE_THRESHOLD,
      hasOverflow,
    });
  }, [setOverflow, viewportRef]);
}

/**
 * Scrolls the active tab fully into view when selection changes.
 *
 * @param {React.MutableRefObject<Record<string, HTMLDivElement | null>>} tabElementsRef - Registered tab elements.
 * @param {string} selectedTabId - Identifier of the currently selected tab.
 * @param {PublishTabHeaderTab[]} tabs - Tabs rendered in the current tab list.
 * @returns {void} Does not return a value.
 */
function useSelectedTabReveal(
  tabElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  selectedTabId: string,
  tabs: PublishTabHeaderTab[],
): void {
  React.useLayoutEffect(() => {
    const selectedTab = tabElementsRef.current[selectedTabId];
    selectedTab?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedTabId, tabElementsRef, tabs]);
}

/**
 * Creates the scroll action used by the overflow chevrons.
 *
 * @param {React.RefObject<HTMLDivElement>} viewportRef - Scrollable viewport that hosts the tabs.
 * @returns {(direction: number) => void} Callback that scrolls one step left or right.
 */
function useScrollByStep(
  viewportRef: React.RefObject<HTMLDivElement>,
): (direction: number) => void {
  return React.useCallback(
    (direction: number): void => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      viewport.scrollBy({
        behavior: 'smooth',
        left: viewport.clientWidth * SCROLL_STEP_RATIO * direction,
      });
    },
    [viewportRef],
  );
}
