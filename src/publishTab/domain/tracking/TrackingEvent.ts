import { trackingEvents, TrackingEventName } from './trackingEvents';
import {
  PublishTabDownloadClickedEvent,
  PublishTabDownloadFailedEvent,
  PublishTabLinkClickedEvent,
  PublishTabNavigationFailedEvent,
  PublishTabOpenedEvent,
  PublishTabSelectedEvent,
} from './TrackingPayload';

/**
 * Maps each tracking event name to its payload contract.
 */
export interface TrackingEventPayloadMap {
  [trackingEvents.publishTabDownloadClicked]: PublishTabDownloadClickedEvent;
  [trackingEvents.publishTabDownloadFailed]: PublishTabDownloadFailedEvent;
  [trackingEvents.publishTabLinkClicked]: PublishTabLinkClickedEvent;
  [trackingEvents.publishTabNavigationFailed]: PublishTabNavigationFailedEvent;
  [trackingEvents.publishTabOpened]: PublishTabOpenedEvent;
  [trackingEvents.publishTabSelected]: PublishTabSelectedEvent;
}

/**
 * Represents one tracking event ready to be sent by an adapter.
 */
export type TrackingEvent<Name extends TrackingEventName = TrackingEventName> =
  {
    name: Name;
    payload: TrackingEventPayloadMap[Name];
  };
