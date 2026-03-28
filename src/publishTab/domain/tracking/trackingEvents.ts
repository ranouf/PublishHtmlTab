/**
 * Lists the tracking event names emitted by PublishTab.
 */
export const trackingEvents = {
  publishTabDownloadClicked: 'publish_tab_download_clicked',
  publishTabDownloadFailed: 'publish_tab_download_failed',
  publishTabLinkClicked: 'publish_tab_link_clicked',
  publishTabNavigationFailed: 'publish_tab_navigation_failed',
  publishTabOpened: 'publish_tab_opened',
  publishTabSelected: 'publish_tab_selected',
} as const;

/**
 * Enumerates all tracking event names supported by PublishTab.
 */
export type TrackingEventName =
  (typeof trackingEvents)[keyof typeof trackingEvents];
