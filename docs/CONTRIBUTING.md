[<<< Back](../docs/README.md#contributing)

- [README for TypeScript-related code](../src/README.md)
- [README for Rust-related code](../src-tauri/README.md)
- Viewing Contributing Guidelines
- [MultiMC Patch System](../docs/MULTIMC.md)

# Contributions Guidelines

## Note

Thanks for your interest in contributing to Kaede!

## Translations

Translations are done externally via a [Kaede Translations repository](https://github.com/kaede-basement/translations)

## Extensions

Information about extensions can be found [here](./EXTENSIONS.md).

## Code of Conduct

See [Code of Conduct](./CODE_OF_CONDUCT.md)

## Static Analysis and Formatting

All TypeScript files are checked with [ESLint](https://eslint.org/) using
`eslint.config.js`. [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) provides
a second, fast correctness pass through `.oxlintrc.json`; it supplements rather
than replaces the repository-specific ESLint contract. Run both before
committing:

```bash
bun run lint
```

[Fallow](https://github.com/fallow-rs/fallow) checks the full import graph for
dead code and circular dependencies in report mode. Its findings remain visible
for review and are not hidden by a baseline:

```bash
bun run analyze:fallow
```

Rust visibility is checked separately with
[Hawk](https://github.com/astral-sh/hawk), using the production targets declared
in `src-tauri/hawk.toml`:

```bash
cargo hawk check \
  --manifest-path src-tauri/Cargo.toml \
  --target-dir src-tauri/target \
  --color always \
  -D warnings
```

The complete local validation set used by CI is:

```bash
bun install --frozen-lockfile
bun audit --audit-level=low
bun run check:dependency-compatibility
bun run typecheck
bun run check:types
bun run lint
bun run analyze:fallow
bun run test
bun run build:frontend
cargo audit --file src-tauri/Cargo.lock
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
cargo hawk check --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target --color always -D warnings
bun run test:tauri-acl
```

Please also follow the project's conventions for the frontend:

- No AI slops in the launcher code (plugins do not count as the part of the launcher).
- TypeScript is highly recommended. If type checking drives you insane, ask me for the help :d
- `.vue` file names should be formatted as `PascalCase`. All other files should use `kebab-case`.
- Exported constants should be formatted as `PascalCase`.
- Functions, variables, and non-exported constants should be formatted as `camelCase`.
- Element styling is preferred by using `Tailwind v3` classes. In case if the UnoCSS preset misses some utility classes, make a custom CSS class.
- [BEM](https://en.bem.info/methodology/) methodology is the preferred way to name element IDs and classes (alongside the Atomic CSS names) to simplify styling for extensions. All elements should have unique IDs.
- Desirably, HTML structure should be semantically correct, i.e. no `<div></div>` in the `<button></button>` elements.

## Commit Messages

TL;DR follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Format

- `type: subject`
- `type!: subject`
- `type(scope): subject`
- `type(scope)!: subject`

### Elements

- **Type**: Choose from the following list. If none of the types match, use `chore`.
  - `feat`: a new feature.
  - `fix`: a bug fix.
  - `docs`: documentation only changes.
  - `style`: changes that do not affect the meaning of the code.
  - `refactor`: improving code structure.
  - `perf`: a code change that improves performance.
  - `test`: adding missing tests or correcting existing tests.
  - `build`: changes that affect the build system or external dependencies.
  - `chore`: other changes that do not modify src or test files.
  - `revert`: reverts a previous commit.
  - `release`: releasing a new version.
  - `ci`: changes to our CI configuration.
- **Scope**: provides a short context to the commit.
- **Breaking Change**: used when introducing a (possibly) breaking change.

### Guidelines

- Use imperative mood, e.g. "add feature" instead of "adding feature" or "added feature".
- Avoid ending with a period.

### Examples

- `feat: add a support for fabric`
- `refactor!: re-write the config synchronization`
- `perf(startup): concurrently resolve independent Tauri API invokes`
- `chore(deps): add svelte`
- `build(linux)!: migrate to the mold linker`

Or just look at others' commit messages lol
