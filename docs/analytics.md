# PublishTab Analytics

## Overview

PublishTab uses a small analytics layer that isolates the UI from Google Analytics.

The application only emits typed events through the `AnalyticsTracker` port.  
The Google Analytics adapter lives behind that port and can be replaced or disabled without touching the UI components.

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
- no raw internal URLs are sent to Google Analytics
- no query strings are sent
- no raw file system paths are sent
- no console logging is used for analytics payloads

Internal targets are sanitized and hashed before being sent.  
External links are only classified by type and target kind; their raw URLs are not forwarded.

Google Analytics is initialized with:

- `send_page_view: false`
- `anonymize_ip: true`
- `allow_google_signals: false`
- `allow_ad_personalization_signals: false`
- a fixed public `page_location` pointing to the Marketplace page, so the host Azure DevOps URL is not exposed

If the browser enables Do Not Track, analytics is disabled.

## Data sent

Only the following low-cardinality fields are used in V1:

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

## How to extend

1. Add the new payload to `src/publishTab/domain/analytics/AnalyticsPayload.ts`
2. Register the new event name in `src/publishTab/domain/analytics/analyticsEvents.ts`
3. Add the event-to-payload mapping in `src/publishTab/domain/analytics/AnalyticsEvent.ts`
4. Create an application use case in `src/publishTab/application/analytics`
5. Extend the whitelist mapping in `src/publishTab/infrastructure/analytics/GoogleAnalyticsTracker.ts`
6. Add tests for:
   - payload mapping
   - sanitization and hashing
   - the integration point that emits the new event
