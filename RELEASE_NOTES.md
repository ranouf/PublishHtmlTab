# Release Notes

## [V2] Support navigation, tab UX polish, and full-download archive

### Branch status snapshot (March 26, 2026)

- Current branch: `v2`
- Commits on top of `main`: none yet (all current updates are local/uncommitted changes)
- Scope includes:
  - previously prepared V2 changes in the working tree
  - latest local fixes requested during QA feedback

### Highlights

- Added support for `enableDownloadAll` in the pipeline task.
- Added `.zip` archive publication and viewer-side download action.
- Added in-tab HTML navigation handling so internal links stay inside the extension.
- Added hash/history sync for report navigation (`#report=...`) to improve deep linking and browser back/forward behavior.
- Improved iframe/content rendering pipeline for multi-page HTML reports.
- Added loading state in the extension UI while report content is still being prepared/rendered.
- Improved tab header UX and sticky behavior while scrolling.
- Refined tab/download button placement and spacing in response to UX feedback.

### Task and manifest changes

- `PublishHtmlReport/index.js`
  - new download attachment type for full archive
  - optional zip generation via `enableDownloadAll`
  - manifest now includes optional `downloadAll` metadata
- `PublishHtmlReport/task.json`
  - new input: `enableDownloadAll` (boolean)
- `azure-devops-extension.json` and task version fields
  - version metadata updated by automated versioning script

### Web viewer changes

- `src/tabContent.tsx`
  - report/link rewriting updates
  - iframe height messaging and dynamic sizing
  - hash-based navigation and selected report synchronization
  - explicit loading states and UX refinements
  - tab interaction changes for report reset/navigation
  - download button rendering logic updates
- `src/tabContent.scss`
  - header sticky behavior
  - tab and action button layout/styling updates
  - loading spinner/state styling
- `src/tabContent.html`
  - formatting and base shell cleanup

### Tooling / quality / packaging

- Added Prettier + ESLint configuration and scripts.
- Updated release packaging flow so version bump is followed by web rebuild before VSIX packaging.
- Improved CI workflow:
  - formatting/lint/build/package checks
  - PR validation summary comment
  - release workflow now consumes `RELEASE_NOTES.md`.

### Documentation updates

- Updated:
  - `README.md`
  - `OVERVIEW.md`
- Added examples for downloadable full-tab content.

### Validation status on current branch changes

- `npm run lint`: pass
- `npm run build`: pass
- Formatting checks were run during iteration; versioned JSON files are continuously rewritten by auto-versioning and then normalized.
