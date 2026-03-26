# Release Notes

## [V2] In-tab navigation, Cobertura compatibility, and full-report download

### User-facing changes

- Added `enableDownloadAll` support in the pipeline task.
- Added full report archive download (`.zip`) from the extension tab.
- Internal links inside published HTML now stay in the same extension tab.
- Added loading screen inside the extension while reports are being prepared/rendered.
- Tab header is now sticky so tabs/actions remain visible while scrolling.
- Download button placement and spacing in the tab area were refined for better UX.

### Navigation and deep-linking improvements

- Added report navigation state sync (`#report=...`) for in-tab navigation.
- Added host URL sync with query params:
  - `phtSummary`
  - `phtReport`
- Opening a copied build-results URL now restores:
  - selected summary tab
  - selected report page (including secondary HTML pages, not only primary entry pages)
- Browser back/forward behavior is improved by keeping report navigation state in URL.

### Cobertura/report script compatibility fixes

- Fixed MIME-related script execution issues (`application/octet-stream`) by serving report scripts through cached `blob:text/javascript` URLs.
- Preserved script execution semantics to avoid breakage in keyboard-driven report navigation.
- This addresses errors such as:
  - `Refused to execute script ... MIME type ('application/octet-stream') is not executable`
  - follow-up runtime failures (`prettyPrint is not defined`, etc.) caused by blocked scripts.

### Task + manifest changes

- `PublishHtmlReport/index.js`
  - new `report-html-download` attachment type
  - optional zip generation when `enableDownloadAll=true`
  - manifest includes optional `downloadAll` metadata
- `PublishHtmlReport/task.json`
  - new input: `enableDownloadAll` (boolean)

### Web viewer changes

- `src/tabContent.tsx`
  - attachment loading/cache improvements
  - report rewriting and in-tab link interception
  - iframe height messaging + dynamic sizing
  - loading state rendering
  - host URL query sync and restore logic (`phtSummary`, `phtReport`)
  - report script handling via blob URLs for MIME compatibility
- `src/tabContent.scss`
  - sticky header
  - tab/action layout refinements
  - loading spinner/state styles
- `src/tabContent.html`
  - shell formatting/cleanup

### Tooling, CI, and packaging

- Added Prettier + ESLint setup and scripts.
- Improved PR validation workflow:
  - format check
  - lint
  - build
  - VSIX packaging
  - PR status comment
- Release workflow now uses `RELEASE_NOTES.md`.
- Packaging flow fixed so version bump is followed by web rebuild before VSIX creation (ensures displayed extension version matches packaged version).

### Documentation updates

- Updated `README.md` and `OVERVIEW.md`.
- Added examples for downloadable full-tab content.

### Validation summary

- `npm run lint`: pass
- `npm run build`: pass
