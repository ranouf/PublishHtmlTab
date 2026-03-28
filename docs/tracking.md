# PublishTab Tracking

## Overview

PublishTab uses a small tracking layer that isolates the UI from the telemetry provider.

The application only emits typed events through the `TrackingPort` port.  
The tracking client lives behind that port and can be replaced or disabled without touching the UI components.

## Tracked events

- `publish_tab_opened`
- `publish_tab_selected`
- `publish_tab_download_clicked`
- `publish_tab_download_failed`
- `publish_tab_link_clicked`
- `publish_tab_navigation_failed`

## Privacy by design

The implementation is intentionally restrictive:

- no HTML content is sent
- no raw report content is sent
- no user names, emails, tokens, or personal identifiers are sent
- no raw internal URLs are sent
- no query strings are sent
- no raw file system paths are sent
- no console logging is used for tracking payloads

Internal targets are sanitized and hashed before being sent.  
External links are only classified by type and target kind; their raw URLs are not forwarded.

Tracking is disabled when:

- the browser enables Do Not Track
- the organization settings disable tracking
- the local override disables tracking

## Data sent

Only the following low-cardinality fields are used:

- `buildId`
- `extensionVersion`
- `mode`
- `tabCount`
- `pageCount`
- `hasDownload`
- `tabIndex`
- `tabType`
- `navigationSource`
- `downloadType`
- `linkType`
- `targetKind`
- `targetPathHash`
- `errorKind`
- `timeBeforeInteractionMs`
- `timeBeforeTabChangeMs`
- `manifestSizeBucket`

The tracking payload also includes:

- an anonymous `device_id`
- the extension `app_version`
- a generated `insert_id`
- the public extension page metadata (`page_location`, `page_path`, `page_title`)

## Provider

The current implementation sends events to **Amplitude HTTP V2**.

## How to extend

1. Add the new payload to `src/publishTab/domain/tracking/TrackingPayload.ts`
2. Register the new event name in `src/publishTab/domain/tracking/trackingEvents.ts`
3. Add the event-to-payload mapping in `src/publishTab/domain/tracking/TrackingEvent.ts`
4. Create an application use case in `src/publishTab/application/tracking`
5. Extend the whitelist mapping in `src/publishTab/infrastructure/tracking/TrackingClient.ts`
6. Add tests for:
   - payload mapping
   - sanitization and hashing
   - the integration point that emits the new event
