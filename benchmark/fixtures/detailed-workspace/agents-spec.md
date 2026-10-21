# Workspace implementation instructions

## Objective

Extend an existing web workspace that manages user accounts, projects, and saved prompts. Work directly in the current repository. First inspect its existing structure and conventions, then implement the requested change, run the relevant checks, and report verified results.

## Architecture and existing behavior

- Preserve the current PostgreSQL schema and existing account records.
- Keep the current Next.js application and its established route structure.
- Reuse the existing account identity and session services.
- Preserve current API response contracts unless a migration is required and documented.
- Do not introduce another database or a second account system.
- Do not replace the existing UI framework or state-management library.
- Keep existing public links and saved prompt URLs working.

## Authentication requirements

- Support sign-in with Google and GitHub.
- Existing email-and-password users must authenticate before linking a social provider.
- A verified social email that belongs to an existing account must not create another account.
- Do not create duplicate accounts under any provider-linking sequence.
- A social identity that already belongs to another account must be rejected.
- Preserve every existing account record and saved prompt while linking identities.
- Require a valid authenticated session before an identity can be linked.
- Revoke sessions when an account is deleted.
- Store only the minimum provider identity data required for sign-in.
- Never write access tokens, password reset tokens, or raw API keys to logs.

## API behavior

- Validate request content type and origin before processing account changes.
- Return a clear client error for malformed request data.
- Return an authentication error when a protected route has no valid session.
- Do not return provider secrets in any browser response.
- Keep error responses consistent with the existing API format.
- Add rate limiting to account-linking requests.
- Ensure retries cannot link the same identity twice.
- Keep route handlers small and delegate database work to existing services.

## Data integrity and security

- Use database uniqueness constraints as the final defense against duplicate identities.
- Use parameterized SQL for every database query.
- Wrap multi-row account updates in a transaction.
- Roll back the transaction if linking fails at any step.
- Preserve referential integrity when deleting or unlinking an identity.
- Do not weaken current authorization checks.
- Do not store credentials in local storage, session storage, or browser-readable cookies.
- Keep session cookies HTTP-only and secure in production.
- Avoid logging personally identifying information unless an existing audit requirement needs it.
- Treat provider profile data as untrusted input.

## User experience

- Explain why an existing password sign-in is required before linking a new provider.
- Tell the user when an identity is already attached to another account.
- Keep loading, success, and failure states accessible to screen readers.
- Preserve the existing settings layout and responsive behavior.
- Do not show another user's email address in errors.
- Do not ask users to repeat identity details already available from the provider.

## Tests and verification

- Add a regression test that prevents duplicate-account creation.
- Add a regression test for linking after authenticating with the existing password.
- Add a test for rejecting an identity attached to another account.
- Test transaction rollback when the identity write fails.
- Test that a protected route rejects a missing or expired session.
- Test that provider credentials never appear in API responses or captured logs.
- Test that deleting an account revokes active sessions.
- Run the focused identity tests, then the full repository test suite.
- Run formatting, lint, type checking, and a production build.
- Report any check that could not run and include its exact reason.

## Delivery constraints

- Do not add a paid dependency without a clear need.
- Do not change unrelated routes or visual styles.
- Do not rewrite project history or force-push a shared branch.
- Do not deploy until the implementation has passed its required checks.
- Do not claim a test passed unless it was run and its result was inspected.
