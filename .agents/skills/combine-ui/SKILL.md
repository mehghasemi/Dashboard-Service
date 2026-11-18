---
name: combine-ui
description: Build new pages and tools in the combine project using its approved Home and marketing-workbench design, shared icons, shell and component defaults. Use for Combine UI work; not unrelated websites or automatic restyling of existing pages.
---

# Combine pages and tools

Work in the combine repository containing `platform/component-catalog.mjs` and `design-system/STANDARD.md`. Usual location: `C:/Users/shahdaei/Documents/ChatGPT/combine`. Resolve the active checkout first; never silently switch projects.

Read root `AGENTS.md`, `PROJECT-MAP.md`, and `design-system/STANDARD.md`. The design is approved: do not ask again about Dana, colors, settings icons, header placement or menu style. Explicit user exceptions take precedence. Load only files relevant to the requested capability.

## Choose the scope

- **New page in an existing tool:** reuse its shell, identity and authorization. Add the content/route needed; do not create a second header or replace unrelated screens.
- **New tool:** read [integration.md](references/integration.md) for registration points. UI consistency does not imply data access.
- **Independent draft/template:** generate a working scaffold below. This does not register a tool or install anything.
- **Shared design change:** modify the canonical source once and assess consumers. Do not produce local variants of the settings icon or base CSS.

## Reusable scaffold

Run `scripts/scaffold.mjs` from this skill with `--project ROOT --id ID --title TITLE --output DIR`. Output must be a new directory inside project `outputs/` or `work/`. Optional `--config JSON_FILE` supplies navigation and description; see `assets/tool.config.json` for its schema by example.

The generated page works offline, includes local Dana, and builds navigation from configuration. Its `app.js` is the content hook. A single-section tool omits the unnecessary sidebar; multiple sections use the standard right sidebar and nested menus. This is a development scaffold, not a server package; sample controls do not implement business operations.

`design-system/tokens.css`, `components.css` and `icons.svg` are canonical. `assets/shell.css` and `assets/shell.js` supply the reusable shell. Copies inside the isolated draft are for portability only. For real integration, serve shared assets once through the platform and reference them from tools. The current packager copies top-level public files, not arbitrary public subdirectories: include new assets explicitly before claiming package coverage.

Reuse shared account/logout/password modules. Populate identity and versions from authenticated APIs, never config literals or imported source-version labels. Hide unavailable actions. iframe and Shadow DOM require explicit style delivery; preserve hashed imported source and use adapters.

## Completion

Verify the requested flow, responsive layout, navigation, Escape/focus handling and fonts/icons. Check business access at the server boundary separately. Update the relevant map only if an integration point changed. Report working behavior and remaining integration; do not call a draft installed. UI development does not imply product-version changes, packaging or publication.
