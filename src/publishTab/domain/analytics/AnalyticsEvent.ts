import { analyticsEvents, AnalyticsEventName } from './analyticsEvents';
import {
  PublishTabDownloadClickedEvent,
  PublishTabDownloadFailedEvent,
  PublishTabLinkClickedEvent,
  PublishTabNavigationFailedEvent,
  PublishTabOpenedEvent,
  PublishTabSelectedEvent,
} from './AnalyticsPayload';

/**
 * Maps each analytics event name to its payload contract.
 */
export interface AnalyticsEventPayloadMap {
  [analyticsEvents.publishTabDownloadClicked]: PublishTabDownloadClickedEvent;
  [analyticsEvents.publishTabDownloadFailed]: PublishTabDownloadFailedEvent;
  [analyticsEvents.publishTabLinkClicked]: PublishTabLinkClickedEvent;
  [analyticsEvents.publishTabNavigationFailed]: PublishTabNavigationFailedEvent;
  [analyticsEvents.publishTabOpened]: PublishTabOpenedEvent;
  [analyticsEvents.publishTabSelected]: PublishTabSelectedEvent;
}

/**
 * Represents one analytics event ready to be sent by an adapter.
 */
export type AnalyticsEvent<
  Name extends AnalyticsEventName = AnalyticsEventName,
> = {
  name: Name;
  payload: AnalyticsEventPayloadMap[Name];
};
