import { PublishTabHeaderTab } from './PublishTabHeaderTab';

/**
 * Defines the data and callbacks required by the animated tab bar.
 */
export interface AnimatedTabBarProps {
  ariaLabel: string;
  endAccessory?: JSX.Element | null;
  onSelectedTabChanged: (tabId: string) => void;
  renderTrailingAction?: (
    tab: PublishTabHeaderTab,
  ) => JSX.Element | null | undefined;
  selectedTabId: string;
  tabs: PublishTabHeaderTab[];
}
