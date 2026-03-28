# Release Notes

## [V2.2] Tracking settings, Amplitude integration, and sanitized tracking events

### User-facing changes

- Added an organization-level settings page in Azure DevOps to enable or disable anonymous tracking.
- Replaced the previous Google Analytics approach with Amplitude HTTP V2 tracking.
- Improved the disabled chevron UX so the cursor clearly indicates when no scrolling action is available.

### Tracking and privacy updates

- Renamed the codebase and documentation vocabulary from analytics to tracking for consistency.
- Added tracking events for report interactions and settings:
  - `publish_tab_opened`
  - `publish_tab_selected`
  - `publish_tab_link_clicked`
  - `publish_tab_navigation_failed`
  - `publish_tab_download_clicked`
  - `publish_tab_download_failed`
  - `tracking_settings_opened`
  - `tracking_enabled`
  - `tracking_disabled`
  - `tracking_error_occurred`
- Added sanitized error tracking for settings operations without sending raw messages, stack traces, URLs, or sensitive data.
- Updated the privacy policy and extension metadata to reflect the current tracking behavior.

### Reliability improvements

- Improved settings loading to safely fall back to defaults when the persisted tracking document does not exist yet.
- Added `.gitattributes` and normalized tracked text files to LF line endings for more consistent local and CI behavior.
- Added tests to cover the new tracking events, settings tracking flow, and tracking adapter creation paths.
- Restored CI coverage compliance without lowering the enforced thresholds.

### Validation summary

- `npm run format:check`: pass
- `npm run lint`: pass
- `npm run build:web`: pass
- `npm run test:ci`: pass
