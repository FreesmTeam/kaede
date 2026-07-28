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

[Oxlint](https://oxc.rs/docs/guide/usage/linter.html) is the primary JavaScript,
TypeScript, and Vue script-block linter. It runs first and uses
`oxlint-tsgolint` for TS7-native type-aware rules. ESLint runs afterwards only
for unsupported behavior: Vue templates, UnoCSS, TSDoc, the local element-ID
rule, Stylistic, and newer Unicorn rules. `eslint-plugin-oxlint` reads the
effective `.oxlintrc.json` and disables every rule already owned by Oxlint, so
the tools do not repeat the same check. Run the combined gate before committing:

```bash
bun run lint
```

The application compiler remains TypeScript 6 while
`@typescript-eslint/parser` declares `typescript <6.1`; the independent
`oxlint-tsgolint` binary supplies the TypeScript 7 analyzer without violating
that peer contract.

### Maintaining the Oxlint/ESLint boundary

`oxlint.eslint-coverage.json` is a generated snapshot of the ESLint rules that
Oxlint 1.75 can execute natively. Regenerate it only together with an Oxlint
upgrade, using the matching migrator version:

```bash
bun x @oxlint/migrate@1.75.0 eslint.config.js \
  --output-file oxlint.eslint-coverage.json \
  --type-aware --js-plugins=false --details
```

Keep project-specific additions and option corrections in `.oxlintrc.json`.
For example, the source Unicorn 72 policy disables NaN checks in
`prefer-number-properties`, because the ESLint-only
`prefer-global-number-constants` rule owns that choice. The migrator currently
drops those options, so the root Oxlint config restores them explicitly.

After regeneration, inspect every skipped or option-changed rule, run Oxlint
before ESLint, and compare both effective configs on representative `.ts` and
`.vue` files. Any rule enabled by both tools is a configuration defect; do not
resolve it with source-level disable comments.

[Fallow](https://github.com/fallow-rs/fallow) checks the full import graph for
dead code and circular dependencies as a blocking gate. Error-level findings
fail the command; external consumers are modeled explicitly in `.fallowrc.json`
instead of being hidden by a baseline:

```bash
bun run analyze:fallow
```

### Maintaining the Fallow model

Treat an unexpected Fallow finding as a missing or incorrect graph edge until
the consumer has been traced. Keep the model precise rather than adding a
baseline, `ignoreExports`, or a global class-member name:

- If a private field's inferred type hides calls to another class, annotate the
  field with its concrete receiver type. This lets Fallow follow real internal
  calls without exempting the methods.
- For exports loaded by a compiler, test runner, alias, or config discovery,
  declare an exact `framework.usedExports` file/export pair under a framework
  with the correct runtime, test, or support role.
- For methods called by external plugin code, express the public surface as a
  meaningful interface and scope `usedClassMembers` to the class's
  `implements` clause. Never allow generic names such as `get` or `post`
  globally.
- Keep build-only packages in `devDependencies`. If a package-script entry is
  classified as production because it imports a tool's library API, invoke the
  installed tool as a CLI and list it in `toolingDependencies` instead.

After changing this model, validate the effective config and activation with
`fallow config` and `fallow plugin-check`. Then run the zero-finding gate and a
temporary mutation (for example, remove one exact `usedExports` mapping) to
prove that the relevant finding returns with exit code 1. Restore the contract
and rerun the gate before committing.

Rust visibility is checked separately with
[Hawk](https://github.com/astral-sh/hawk), using the production targets declared
in `src-tauri/hawk.toml`. Run it inside the checked-in Nix shell: Hawk 0.1.10 is
compiler-bound and the shell supplies the matching Rust 1.97.1 toolchain.

```bash
nix develop --command cargo hawk check \
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
bun run check:validators
bun run typecheck
bun run check:types
bun run lint
bun run analyze:fallow
bun run test
bun x vite build
cargo audit --file src-tauri/Cargo.lock
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
cargo hawk check --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target --color always -D warnings
```

Run the Rust commands in that list from `nix develop`. The JavaScript commands
use the Bun version pinned by `packageManager`, the Nix shell, and CI.

### Rust dependency audit status

Verified 2026-07-28: `cargo audit` reports no vulnerability and leaves 17
upstream warnings visible; the repository has no RustSec ignore list. Ten
unmaintained GTK3 binding warnings, the `glib 0.18.5` soundness warning, and
the `proc-macro-error 1.0.4` maintenance warning come through Tauri 2.11.5's
Linux GTK3/WebKitGTK stack. Five unmaintained UNIC warnings come through
`urlpattern 0.3.0`, used by `tauri-utils 2.9.3` and
`tauri-plugin-http 2.5.9`. Recheck these edges with `cargo tree --invert`
whenever Tauri or its plugins are updated; do not convert them into an
allowlist merely to make the report empty.

The compatible `event-listener 5.4.2` lockfile update is applied. Four older
transitive versions cannot be updated independently: `crypto-common 0.1.7`
requires `generic-array =0.14.7`, while `proc-macro-crate 2.0.2` requires
`toml_datetime =0.6.3` and `toml_edit =0.20.2`. That exact datetime pin also
prevents `system-deps 6.2.2` from selecting `toml 0.8.23`, which requires
`toml_datetime ^0.6.11`. Update the parent crates when their Tauri dependency
chain permits it; do not override these incompatible requirements locally.

`src/lib/schemas/generated/validators.js` and its declaration file are generated
artifacts, so the style linters exclude those exact paths instead of accepting
blanket disable comments in generated source. `bun run check:validators`
regenerates both files in memory and fails on any byte-level drift. The Vitest
suite also compares their behavior with live TypeBox validators, including
Kaede's host-only permission refinements.

Detailed TypeBox errors are loaded only after a generated check fails. The
public validator `Errors(value)` contract therefore returns a `Promise`; trusted
extension code must `await` it. This keeps TypeBox schemas and the value engine
out of the normal startup chunk while preserving synchronous `Check(value)`.

The full Rust test command includes the Tauri ACL smoke. Use
`bun run test:tauri-acl` only when rerunning that exact smoke in isolation.

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
