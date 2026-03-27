import * as React from 'react';

import { AnimatedTabBarProps } from '../../models';
import { useAnimatedTabs } from '../hooks/useAnimatedTabs';

/**
 * Renders a Red Hat-inspired horizontal tab bar with overflow chevrons.
 *
 * @param {AnimatedTabBarProps} props - Tab data and interaction callbacks.
 * @returns {JSX.Element} Animated tab bar markup.
 */
export function AnimatedTabBar(props: AnimatedTabBarProps): JSX.Element {
  const {
    indicator,
    overflow,
    registerTab,
    scrollBackward,
    scrollForward,
    viewportRef,
  } = useAnimatedTabs(props.selectedTabId, props.tabs);

  return (
    <div className="publish-tab-strip">
      {renderScrollButton(
        'Scroll tabs left',
        overflow.hasOverflow && overflow.canScrollBackward,
        scrollBackward,
        'left',
      )}
      {renderTabViewport(props, viewportRef, indicator, registerTab)}
      {renderEndSection(
        props.endAccessory,
        overflow.hasOverflow && overflow.canScrollForward,
        scrollForward,
      )}
    </div>
  );
}

/**
 * Renders the scrollable viewport that contains all tabs and the moving indicator.
 *
 * @param {AnimatedTabBarProps} props - Tab data and interaction callbacks.
 * @param {React.RefObject<HTMLDivElement>} viewportRef - Ref attached to the scrollable viewport.
 * @param {{ x: number; width: number }} indicator - Current underline position and width.
 * @param {(tabId: string) => (element: HTMLDivElement | null) => void} registerTab - Ref registration callback for measurement.
 * @returns {JSX.Element} Scrollable tab viewport markup.
 */
function renderTabViewport(
  props: AnimatedTabBarProps,
  viewportRef: React.RefObject<HTMLDivElement>,
  indicator: { x: number; width: number },
  registerTab: (tabId: string) => (element: HTMLDivElement | null) => void,
): JSX.Element {
  return (
    <div
      aria-label={props.ariaLabel}
      className="publish-tab-strip__viewport"
      ref={viewportRef}
      role="tablist"
    >
      <div className="publish-tab-strip__list">
        {props.tabs.map((tab) =>
          renderTabItem(
            tab,
            props,
            tab.id === props.selectedTabId,
            registerTab,
          ),
        )}
        {renderIndicator(indicator)}
      </div>
    </div>
  );
}

/**
 * Renders a single tab item with optional trailing action content.
 *
 * @param {AnimatedTabBarProps['tabs'][number]} tab - Tab descriptor to render.
 * @param {AnimatedTabBarProps} props - Shared tab bar props.
 * @param {boolean} isSelected - Indicates whether this tab is currently active.
 * @param {(tabId: string) => (element: HTMLDivElement | null) => void} registerTab - Ref registration callback for measurement.
 * @returns {JSX.Element} One tab item.
 */
function renderTabItem(
  tab: AnimatedTabBarProps['tabs'][number],
  props: AnimatedTabBarProps,
  isSelected: boolean,
  registerTab: (tabId: string) => (element: HTMLDivElement | null) => void,
): JSX.Element {
  const className = getTabItemClassName(isSelected);
  const trailingAction = props.renderTrailingAction
    ? props.renderTrailingAction(tab)
    : null;

  return (
    <div
      className={className}
      key={tab.id}
      ref={registerTab(tab.id)}
    >
      {renderTabTrigger(tab, props.onSelectedTabChanged, isSelected)}
      {trailingAction}
    </div>
  );
}

/**
 * Renders the interactive button used to select one tab.
 *
 * @param {AnimatedTabBarProps['tabs'][number]} tab - Tab descriptor to render.
 * @param {(tabId: string) => void} onSelectedTabChanged - Callback fired when the tab is selected.
 * @param {boolean} isSelected - Indicates whether this tab is currently active.
 * @returns {JSX.Element} Tab trigger button markup.
 */
function renderTabTrigger(
  tab: AnimatedTabBarProps['tabs'][number],
  onSelectedTabChanged: (tabId: string) => void,
  isSelected: boolean,
): JSX.Element {
  return (
    <button
      aria-selected={isSelected}
      className="publish-tab-strip__trigger"
      onClick={() => {
        onSelectedTabChanged(tab.id);
      }}
      role="tab"
      tabIndex={isSelected ? 0 : -1}
      type="button"
    >
      <span className="publish-tab-strip__label">{tab.label}</span>
    </button>
  );
}

/**
 * Renders the right side of the tab strip with the forward chevron and optional accessory.
 *
 * @param {JSX.Element | null | undefined} endAccessory - Extra element rendered after the forward chevron.
 * @param {boolean} canScrollForward - Indicates whether scrolling right is possible.
 * @param {() => void} scrollForward - Scroll action triggered by the right chevron.
 * @returns {JSX.Element} End section markup.
 */
function renderEndSection(
  endAccessory: JSX.Element | null | undefined,
  canScrollForward: boolean,
  scrollForward: () => void,
): JSX.Element {
  return (
    <div className="publish-tab-strip__end">
      {renderScrollButton(
        'Scroll tabs right',
        canScrollForward,
        scrollForward,
        'right',
      )}
      {endAccessory}
    </div>
  );
}

/**
 * Builds the CSS class name for one tab item.
 *
 * @param {boolean} isSelected - Indicates whether this tab is currently active.
 * @returns {string} Tab item class name.
 */
function getTabItemClassName(isSelected: boolean): string {
  return `publish-tab-strip__item${
    isSelected ? ' publish-tab-strip__item--selected' : ''
  }`;
}

/**
 * Renders the shared underline indicator for the selected tab.
 *
 * @param {{ x: number; width: number }} indicator - Current underline position and width.
 * @returns {JSX.Element} Underline indicator markup.
 */
function renderIndicator(indicator: { x: number; width: number }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="publish-tab-strip__indicator"
      style={{
        transform: `translateX(${indicator.x}px)`,
        width: `${indicator.width}px`,
      }}
    />
  );
}

/**
 * Renders one overflow control button when the tab list is clipped.
 *
 * @param {string} ariaLabel - Accessible label describing the button action.
 * @param {boolean} enabled - Indicates whether scrolling in this direction is possible.
 * @param {() => void} onClick - Scroll action triggered by the button.
 * @param {'left' | 'right'} direction - Direction represented by the button.
 * @returns {JSX.Element} Overflow control button markup.
 */
function renderScrollButton(
  ariaLabel: string,
  enabled: boolean,
  onClick: () => void,
  direction: 'left' | 'right',
): JSX.Element {
  return (
    <button
      aria-label={ariaLabel}
      className="publish-tab-strip__scroll-button"
      disabled={!enabled}
      onClick={onClick}
      type="button"
    >
      {renderScrollIcon(direction)}
    </button>
  );
}

/**
 * Renders the icon used inside an overflow scroll button.
 *
 * @param {'left' | 'right'} direction - Direction represented by the icon.
 * @returns {JSX.Element} Chevron icon markup.
 */
function renderScrollIcon(direction: 'left' | 'right'): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="publish-tab-strip__scroll-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
