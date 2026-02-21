# Plan 024: Release Hardening and Architecture Closure

## Objective

Complete architecture requirements (H1-H3, I1-I2, R7) and production hardening for safe Linux and macOS distribution.

## Scope

### In Scope
- H1-H3: Artifact signing for Linux (AppImage GPG) and macOS (notarization + codesign)
- I1-I2: Verify UUID/UTC consistency across all entities
- R7: Error redaction policy for release builds
- D1-D5: Production readiness review of AI adapters (already implemented)
- Update status.md and traceability

### Non-Goals
- Windows support
- Explicit decider modules (E1-E4) - current domain layer is sufficient
- New functional features
- E2E tests

---

## Architecture Impact Assessment

### Dependency Boundaries
No changes to layer boundaries. Work is:
- CI/release workflow changes (infrastructure)
- Error handling policy (main process only)
- Verification of existing patterns (no new modules)

### Affected Files
- `.github/workflows/release-linux.yml` (signing)
- `.github/workflows/release-macos.yml` (new)
- `src/main/services/ai/provider-ai-service.ts` (error redaction review)
- `src/main/features/*/slice.ts` (error redaction review)
- `docs/status.md` (update)

---

## Step-by-Step Implementation Plan

### Phase 1: Error Redaction Policy (R7) - 1-2 hours

**Goal**: Ensure secrets and internal details never leak in error messages.

#### 1.1 Audit current error paths
- Review `src/main/features/settings/slice.ts` for provider error handling
- Review `src/main/services/ai/provider-ai-service.ts` for error mapping
- Verify IPC error responses in `src/main/features/*/ipc-handlers.ts`

#### 1.2 Implement redaction helper
Create `src/main/services/error-redaction.ts`:
```typescript
type RedactedError = {
  kind: ErrorKind;
  userMessage: string;
  // devMessage only in dev mode, never in production
};
```

#### 1.3 Add tests
- Unit test for redaction helper
- Contract test verifying no secrets in IPC error payloads

#### 1.4 Verification
```bash
bun run test:unit
bun run test:integration
```

---

### Phase 2: UUID and UTC Verification (I1-I2) - 30 minutes

**Goal**: Confirm UUID and UTC patterns are consistent.

#### 2.1 Verify UUID generation
All entity creation uses `crypto.randomUUID()`:
- [x] `src/main/ipc/register-ipc.ts` - CouncilId, AgentId, MessageId
- [x] `src/main/features/settings/slice.ts` - credential refs

#### 2.2 Verify UTC storage
All timestamps use `toISOString()`:
- [x] `src/main/ipc/register-ipc.ts` - nowUtc
- [x] `src/main/services/db/sqlite-persistence-service.ts`

#### 2.3 Verify UTC-to-local rendering in renderer
Check `src/renderer/App.tsx` for timestamp display:
- If using `toLocaleString()` or similar, document
- If raw UTC shown, add conversion

#### 2.4 Add any missing brand type casts
Ensure all IDs use brand types at creation point.

#### 2.5 Verification
```bash
bun run test:unit
bun run typecheck
```

---

### Phase 3: Linux Artifact Signing (H1-H3) - 2-3 hours

**Goal**: GPG-sign AppImage releases for Linux.

#### 3.1 Prerequisites
- GPG private key (stored in GitHub Secrets)
- Public key published to keys.openpgp.org

#### 3.2 Update release workflow
Modify `.github/workflows/release-linux.yml`:
1. Import GPG key from secrets
2. Sign AppImage with `gpg --detach-sign`
3. Upload both `.AppImage` and `.AppImage.sig`
4. Publish signature to release notes

#### 3.3 Add verification script
Create `scripts/verify-signature.ts`:
- Downloads public key
- Verifies signature
- Used in CI and by users

#### 3.4 GitHub Secrets required
- `GPG_PRIVATE_KEY` - ASCII-armored private key
- `GPG_PASSPHRASE` - key passphrase (if encrypted)

#### 3.5 Verification
```bash
bun run package:linux
gpg --detach-sign dist/release/*.AppImage
gpg --verify dist/release/*.AppImage.sig
```

---

### Phase 4: macOS Release Workflow (H1-H3) - 3-4 hours

**Goal**: Notarize and codesign macOS app bundle.

#### 4.1 Prerequisites
- Apple Developer account
- Developer ID Application certificate
- App-specific password for notarization

#### 4.2 Create macOS workflow
Create `.github/workflows/release-macos.yml`:
1. Run on `macos-latest`
2. Install dependencies (no libsecret needed)
3. Build and rebuild native modules
4. Package as DMG/ZIP
5. Codesign with `codesign`
6. Notarize with `notarytool`
7. Staple ticket with `stapler`
8. Upload signed artifact

#### 4.3 GitHub Secrets required
- `APPLE_DEVELOPER_ID` - certificate base64
- `APPLE_DEVELOPER_ID_PASSWORD` - certificate password
- `APPLE_ID` - Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` - app-specific password
- `APPLE_TEAM_ID` - team ID

#### 4.4 Update package.json
Add `package:macos` script for electron-builder macOS config.

#### 4.5 Verification
Local signing test requires actual certificates (CI-only verification).

---

### Phase 5: Production Readiness Review (D1-D5) - 1 hour

**Goal**: Confirm AI adapters are production-ready.

#### 5.1 Review provider-ai-service.ts
- [x] AbortSignal support
- [x] No console logging
- [x] Secrets stay in main process
- [x] Error mapping to "ProviderError"

#### 5.2 Review runtime cancellation
Check `src/main/features/councils/slice.ts`:
- [x] AbortController created per generation
- [x] Cancel discards output entirely
- [x] No partial persistence

#### 5.3 Add any missing edge case handling
- Timeout handling (add default timeout?)
- Retry logic (already implemented)

#### 5.4 Verification
```bash
bun run test:unit
bun run test:integration
bun run diag:electron
```

---

### Phase 6: Documentation and Traceability - 30 minutes

#### 6.1 Update status.md
- Mark H1-H3, I1-I2, R7, D1-D5 as Done
- Document implementation approach
- List any remaining gaps

#### 6.2 Update architecture-decision.md
- Add signing/notarization details to G section
- Document error redaction policy

#### 6.3 Regenerate traceability
```bash
bun run trace:generate
bun run check:traceability
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| GPG key compromise | Use subkeys, rotate annually |
| Apple certificate expiration | Document renewal process, set calendar reminder |
| Notarization failure | Detailed error logs, fallback to unsigned with warning |
| macOS runner cost | Only run on tags, not every PR |

---

## Coverage Matrix

| Requirement ID | Test Coverage |
|----------------|---------------|
| D1-D5 | `tests/unit/provider-ai-service.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` |
| H1-H3 | `tests/integration/packaging-pipeline.integration.spec.ts` (extend for signing) |
| I1-I2 | `tests/unit/ids.spec.ts`, existing handler tests |
| R7 | New `tests/unit/error-redaction.spec.ts`, `tests/integration/providers-ipc.contract.integration.spec.ts` |

---

## Validation Commands

```bash
bun run lint
bun run typecheck
bun run build
bun run test:coverage
bun run check:coverage-guardrails
bun run check:traceability
bun run check:boundaries
bun run diag:electron
```

---

## Rollback Strategy

1. Signing failures: Release unsigned artifacts with clear warning
2. Notarization failures: Fall back to unsigned DMG with documentation
3. Error redaction issues: Quick revert of redaction helper (fallback to current behavior)

---

## Estimated Effort

| Phase | Hours |
|-------|-------|
| Phase 1: Error Redaction | 1-2 |
| Phase 2: UUID/UTC Verification | 0.5 |
| Phase 3: Linux Signing | 2-3 |
| Phase 4: macOS Release | 3-4 |
| Phase 5: Production Review | 1 |
| Phase 6: Documentation | 0.5 |
| **Total** | **8-11 hours** |

---

## Dependencies

### Required before starting
- None (all current tests passing)

### Required before merge
- GPG key generated and stored in GitHub Secrets
- Apple Developer account access (for Phase 4)
- All validation commands passing
