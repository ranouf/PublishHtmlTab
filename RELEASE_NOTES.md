# Release Notes

## Current Release

- Added an organization-level settings page in Azure DevOps to enable or disable anonymous tracking.
- Replaced the previous Google Analytics approach with Amplitude HTTP V2 tracking.
- Renamed the codebase and documentation vocabulary from analytics to tracking for consistency.
- Updated the privacy policy and extension metadata to reflect the current tracking behavior.
- Improved settings loading to safely fall back to defaults when the persisted tracking document does not exist yet.
- Improved the disabled chevron UX so the cursor clearly indicates when no scrolling action is available.
