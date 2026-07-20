# Changelog

All notable changes to the "Yummy GitHistory" extension are documented in this file.

## [1.1.1] - 2026-07-20

### Fixed

- Extension failed to activate: dependency-injection bindings for `Source`
  could not be resolved.

## [1.1.0] - 2026-07-20

### Added

- Collapsible commit descriptions: the list shows only the subject, with a
  comment icon to preview (hover) or expand (click) the body.
- Merge-base divergence highlighting in the commits table.
- Branch-follow mode for the log view.
- Horizontal scroll, column auto-hide, and a reset-sizes button.

### Changed

- Tags hide `HEAD` and mark current/remote references.

## [1.0.2] - 2026-07-08

### Changed

- Refreshed the commit-graph color palette for better contrast and readability.
- Lowered the minimum required VS Code version to `1.74.0` for broader compatibility.

## [1.0.1] - 2026-07-08

### Changed

- Maintenance release: rebuilt extension bundle and refreshed the packaged artifact.

## [1.0.0] - 2026-07-08

### Added

- Initial release.
- **History** view with a virtualized commit list and inline branch graph.
- **Branches** view with create, checkout, rename, delete, compare, merge, rebase,
  cherry-pick, push, pull, fetch, set-upstream, and remote-tracking actions.
- **Changes** view showing files affected by the selected commit.
- Stash support (stash, pop, apply, drop).
- Filtering by author and message, and locating a commit by hash.
- Multi-repository switching and hiding.
- Configurable history columns.
