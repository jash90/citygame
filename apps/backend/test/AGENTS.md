<!-- Scope: apps/backend/test — E2E and integration tests -->
<!-- Source: .claude/rules/{lsp,dip}.md (testing implications) -->

# Testing Agent Rules

Jest-based unit tests (co-located with source) and E2E tests (this directory).

## Rules

- Never save test files to the repository root.
- Unit tests live next to the source file they test (`*.spec.ts`).
- E2E tests live in this `test/` directory (`*.e2e-spec.ts`).
- Prefer integration tests that hit real modules over isolated unit tests with heavy mocking.

## SOLID in Tests

### LSP

- Mocks and stubs must not silently behave differently from the real implementation.
- If the real service throws on invalid input, the mock must too.
- Never return `null` or `undefined` from a mock where the contract specifies a defined type.

### DIP

- Test modules use NestJS `Test.createTestingModule` to assemble dependencies — never instantiate services with `new`.
- Override providers with test doubles via `.overrideProvider()` — never patch imports directly.

### SRP

- One test file = one module/service under test.
- Keep test descriptions focused: describe the behavior, not the implementation.

## Anti-patterns

- Overriding a method to throw "not implemented" in test doubles.
- Testing implementation details instead of behavior.
- Test files that cover multiple unrelated modules.
