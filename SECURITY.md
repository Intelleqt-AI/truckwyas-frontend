# Security Notes

## Accepted Risks

### esbuild Dev Server Vulnerability (GHSA-67mh-4wv8-2f99)

**Severity:** Medium (dev-only)
**CVE/Advisory:** GHSA-67mh-4wv8-2f99
**Affected:** esbuild <= 0.24.2 (currently using 0.21.5 via vite)
**Description:** The esbuild development server allows any website to send requests and read responses, potentially exposing source code or dev data to malicious pages visited during development.

**Mitigation:**
- Vite dev server is now bound to `127.0.0.1` (localhost only) instead of `::` (all interfaces), reducing the attack surface.
- This vulnerability only affects the development server — it has **no impact on production builds**.
- esbuild is a transitive dependency of vite; upgrading it independently may cause compatibility issues.

**Action:** Accepted as dev-only risk. Will be resolved when vite upgrades its esbuild dependency to a patched version. Monitor vite releases for the fix.

**Date:** 2026-02-11
