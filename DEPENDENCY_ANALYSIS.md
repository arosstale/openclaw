# Package.json OptionalDependencies Analysis

## Proposed Changes

Move from `dependencies` to `optionalDependencies`:
- @larksuiteoapi/node-sdk
- @whiskeysockets/baileys  
- pdfjs-dist
- playwright-core
- @line/bot-sdk
- @aws-sdk/client-bedrock

Remove from `files` array:
- docs/

## Question 1: Will core gateway startup break if these are missing (--omit=optional)?

**Answer: NO** ✅

### Gateway Startup Flow Analysis

Gateway initialization path: `cli/gateway-cli/register.ts` → `cli/gateway-cli/run.ts` → `gateway/server.impl.ts`

**Core startup sequence (server.impl.ts:200-450):**
1. Load and validate config
2. Apply plugin auto-enable settings
3. Initialize diagnostic heartbeat
4. **Load plugins** via `loadGatewayPlugins()` (line 259)
5. Create channel manager (line 418)
6. Initialize model catalog
7. Setup node registry, cron service, discovery
8. Create runtime state (HTTP servers, WebSocket handlers)
9. Start sidecars (line 629) - channels passed but NOT started

**Key Finding:** Plugins are loaded eagerly at startup, BUT channel handlers and tools are initialized **on-demand** only when:
- A channel is explicitly configured and `startChannel(channelId)` is called
- An agent invocation creates tools via `createOpenClawTools()`

**Impact:** If optional dependencies are missing at `--omit=optional` install:
- Gateway starts successfully ✅
- Plugin loading succeeds (no static imports in plugin registry)
- Channel startup will fail ONLY when that specific channel is configured/used
- Tools creation will fail ONLY when agent tries to use that feature

## Question 2: Are there static imports that would throw at startup if package is absent?

**Answer: YES for most packages, NO for pdfjs-dist** ⚠️

### Import Analysis

#### ❌ **@larksuiteoapi/node-sdk** - Static imports
**Files:** `extensions/feishu/src/{client.ts, monitor.ts, perm.ts, wiki.ts, drive.ts, docx.ts, streaming-card.ts}`
- **Import style:** `import * as Lark from "@larksuiteoapi/node-sdk"`
- **Location:** Extension (not core)
- **Risk:** Module will throw if imported when package missing
- **Mitigation needed:** Yes - see recommendations below

#### ❌ **@whiskeysockets/baileys** - Static imports  
**Files:** `src/web/{session.ts, login.ts, login-qr.ts, monitor.ts, inbound/*.ts}`
- **Import style:** `import { makeWASocket, ... } from "@whiskeysockets/baileys"`
- **Location:** Core WhatsApp Web channel
- **Risk:** Module will throw if imported when package missing
- **Mitigation needed:** Yes - see recommendations below

#### ✅ **pdfjs-dist** - Lazy/dynamic import
**Files:** `src/media/input-files.ts`
- **Import style:** `await import("pdfjs-dist/legacy/build/pdf.mjs")` (line 28)
- **Pattern:** Wrapped in `loadPdfJsModule()` with promise caching
- **Risk:** None - gracefully handles missing package
- **Safe to make optional:** YES ✅

#### ❌ **playwright-core** - Static imports
**Files:** `src/browser/{pw-session.ts, pw-tools-core.downloads.ts, pw-tools-core.state.ts}`
- **Import style:** `import { chromium } from "playwright-core"`
- **Location:** Browser tool handlers
- **Risk:** Module will throw if imported when package missing
- **Mitigation needed:** Yes - see recommendations below

#### ❌ **@line/bot-sdk** - Static imports
**Files:** `src/line/{bot-handlers.ts, send.ts, rich-menu.ts, download.ts, probe.ts, bot-message-context.ts}` (14+ files)
- **Import style:** `import * as line from "@line/bot-sdk"`
- **Location:** Core LINE channel
- **Risk:** Module will throw if imported when package missing
- **Mitigation needed:** Yes - see recommendations below

#### ❌ **@aws-sdk/client-bedrock** - Static imports
**Files:** `src/agents/{bedrock-discovery.ts, bedrock-discovery.e2e.test.ts}`
- **Import style:** `import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock"`
- **Location:** Agent feature (model discovery)
- **Risk:** Module will throw if imported when package missing
- **Mitigation needed:** Yes - see recommendations below

### Static Import Risk Summary

**5 out of 6 packages** use static imports that will throw at module load time if package is absent:
- @larksuiteoapi/node-sdk ❌
- @whiskeysockets/baileys ❌
- playwright-core ❌
- @line/bot-sdk ❌
- @aws-sdk/client-bedrock ❌
- pdfjs-dist ✅ (already lazy)

## Question 3: Is docs/ safe to remove from npm files list?

**Answer: NO** ❌

### Runtime Dependencies on docs/

**Critical runtime usage found:**

#### 1. Workspace Templates (`src/agents/workspace-templates.ts`)
```typescript
const FALLBACK_TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/reference/templates",
);
```

**Resolution logic:**
1. Try `packageRoot/docs/reference/templates`
2. Try `cwd/docs/reference/templates`
3. Fallback to compiled dist location

**Used in:** `src/agents/workspace.ts:67`
```typescript
throw new Error(
  `Missing workspace template: ${name} (${templatePath}). 
   Ensure docs/reference/templates are packaged.`
);
```

**Impact:** Agent workspace creation will fail without templates from `docs/reference/templates/`

#### 2. Docs Size: 14MB
Contains essential runtime assets (templates, images, etc.) needed by installed package.

### Recommendation on docs/

**DO NOT REMOVE** from npm package unless:
1. Workspace templates are moved to a different location (e.g., `assets/templates/`)
2. Template resolution logic is updated to not reference `docs/`
3. All references are tested with `npm pack` install

## Question 4: Any other risks?

### Risk 1: Extension Dependencies in Root package.json

**Issue:** Extension-specific packages are in root `dependencies`:
- `@larksuiteoapi/node-sdk` (Feishu extension only)

**Current behavior:**
- Extensions run `npm install --omit=dev` in their own directory
- Extension `package.json` should list these in `dependencies`
- Root package shouldn't include extension-only deps

**Status:** ✅ **VERIFIED - Safe**
- Checked `extensions/feishu/package.json` - it correctly lists `@larksuiteoapi/node-sdk` in dependencies
- Feishu extension will work independently even if removed from root package
- No risk from this perspective

**However:** Feishu channel files still use static imports (extensions/feishu/src/*.ts), so lazy loading would still be required

### Risk 2: Static Import Pattern Across Channels

**Issue:** All channel implementations use static imports, incompatible with optional deps pattern

**Current pattern (example from LINE):**
```typescript
import * as line from "@line/bot-sdk";

export async function startLineBot(config) {
  const client = new line.messagingApi.MessagingApiClient(...);
}
```

**Required pattern for optional deps:**
```typescript
let line: typeof import("@line/bot-sdk") | undefined;

export async function startLineBot(config) {
  if (!line) {
    try {
      line = await import("@line/bot-sdk");
    } catch (err) {
      throw new Error("@line/bot-sdk not installed. Run: npm install @line/bot-sdk");
    }
  }
  const client = new line.messagingApi.MessagingApiClient(...);
}
```

**Effort:** This pattern must be applied to ~50+ files across 5 packages

### Risk 3: Build Output (`dist/`) and Type Checking

**Issue:** TypeScript compilation will fail if optional deps are missing during build

**Current build:**
```json
"prepack": "pnpm build && pnpm ui:build"
```

**Impact:**
- `pnpm build` runs `tsdown` which type-checks all files
- Static imports to missing packages will cause type errors
- Build will fail unless packages are installed

**Options:**
1. Keep optional deps installed during build (defeats size optimization)
2. Use `// @ts-expect-error` or type guards for optional imports
3. Move channel code to separate packages/extensions

### Risk 4: Testing and CI

**Issue:** Tests import these packages directly

**Files found:**
- `src/agents/bedrock-discovery.e2e.test.ts`
- Multiple channel test files

**Impact:** Test suite will fail if running with `--omit=optional`

**Recommendation:** Tests should be conditional or skip when optional dep missing

### Risk 5: pnpm.onlyBuiltDependencies

**Current config (package.json:210-220):**
```json
"onlyBuiltDependencies": [
  "@lydell/node-pty",
  "@matrix-org/matrix-sdk-crypto-nodejs",
  "@napi-rs/canvas",
  "@whiskeysockets/baileys",  // ← Listed here
  ...
]
```

**Issue:** `@whiskeysockets/baileys` is marked as needing native builds

**Risk:** Moving to optionalDependencies may affect build behavior if not installed

## Recommendations

### Option A: Make Truly Optional (High Effort)
1. Convert all static imports to lazy dynamic imports
2. Add graceful error handling when packages missing
3. Update ~50+ files across all affected channels
4. Add conditional test skipping
5. Document installation instructions per channel
6. Keep docs/ in npm package

**Pros:**
- Smaller base install size
- Pay-per-use dependency model
- Better for users who only need specific channels

**Cons:**
- Large refactoring effort
- Potential runtime errors if not handled correctly
- More complex codebase
- Harder to type-check

### Option B: Keep Current Structure (Low Risk)
1. Keep all packages in `dependencies`
2. Keep docs/ in npm package
3. No code changes needed

**Pros:**
- No breaking changes
- Full type safety maintained
- Simpler codebase
- All features work out of box

**Cons:**
- Larger install size
- Users install deps they may not use

### Option C: Split to Extensions (Medium Effort)
1. Move channel implementations to separate npm packages
2. Keep only core gateway in main package
3. Users install extensions as needed: `npm install @openclaw/whatsapp @openclaw/line`

**Pros:**
- Clean separation of concerns
- Truly optional per-channel installs
- Better long-term architecture

**Cons:**
- Significant refactoring
- Changes to plugin system
- Migration path for existing users

## Summary

| Package | Safe to Make Optional? | Reason |
|---------|----------------------|---------|
| @larksuiteoapi/node-sdk | ⚠️ No (without refactor) | Static imports in extension |
| @whiskeysockets/baileys | ⚠️ No (without refactor) | Static imports in core channel + native build |
| pdfjs-dist | ✅ Yes | Already uses lazy loading |
| playwright-core | ⚠️ No (without refactor) | Static imports in browser tools |
| @line/bot-sdk | ⚠️ No (without refactor) | Static imports in core channel |
| @aws-sdk/client-bedrock | ⚠️ No (without refactor) | Static imports in agent features |
| docs/ removal | ❌ No | Runtime dependency for workspace templates |

**Immediate Action:**
- **DO:** Move `pdfjs-dist` to optionalDependencies (already lazy-loaded) ✅
- **DON'T:** Move other packages without refactoring to lazy imports ❌
- **DON'T:** Remove docs/ from npm package ❌

**If proceeding with full migration:**
1. Start with refactoring channel code to use lazy imports
2. Add proper error messages when optional deps missing  
3. Update tests to conditionally skip
4. Test with `npm pack` and install with `--omit=optional`
5. Keep docs/ in package.json files array
