# BizPilot AI — Agent Rules

## 1. Product
BizPilot AI is a premium CRM workspace with AI-assisted lead analysis and optional n8n automation.
Priority: reliable business workflows, security, maintainability and professional UX.

## 2. Token efficiency
- Read only files relevant to the current task.
- Read relevant sections of docs, not entire documents by default.
- Never repeat completed audits or checks without a reason.
- Avoid dumping large files, logs or command output.
- Prefer targeted searches and minimal diffs.
- Do not create unnecessary plans, reports or documentation.
- Keep final reports concise and factual.

## 3. Architecture
Three layers:
- Presentation: app/, components/.
- Application: services/ and use-case orchestration.
- Infrastructure: Prisma, database, AI and integrations in lib/.

Rules:
- No separate domain/ layer.
- Business logic belongs in services, not Route Handlers or UI.
- Follow existing project patterns.
- Avoid duplication and unnecessary abstractions.
- Do not rewrite working code to satisfy personal preferences.

## 4. Security — mandatory
- Derive user and workspace identity from the server session.
- Never trust workspaceId, role or ownership supplied by clients.
- Scope every business-data query and mutation to the current workspace.
- Validate linked entities on create and update.
- Filter relations on reads; never expose cross-workspace data or foreign IDs.
- Deletion must not modify another workspace, including through database FK actions.
- Check authorization and role permissions server-side.
- Validate input with Zod.
- Keep secrets server-side; never log or expose them.
- Preserve API response conventions and error handling.
- Do not weaken auth, CSRF, rate limits, HMAC or replay protection.

Detailed rules: docs/SECURITY.md, docs/API.md, docs/ARCHITECTURE.md.

## 5. Database
- Use existing Prisma models and migration conventions.
- Never modify schema or add migrations without a real requirement.
- No destructive DB operations without explicit approval.
- Integration tests must use an isolated test database/schema.
- Never run destructive or isolation tests against dev/seed/production data.
- Preserve workspace isolation in queries, relations and transactions.

## 6. AI
- Use the existing provider abstraction and server-side credentials.
- Validate all provider output with Zod.
- Treat user text as untrusted input.
- Never invent contacts or facts; extracted data must be supported by source text.
- Preserve AI history and error handling.
- Applying AI results always requires explicit user confirmation.
- Never send messages or perform external actions automatically.
- Do not change provider, model or prompts unless the task requires it.

## 7. Automation
- n8n is optional; CRM must work without it.
- Preserve outbox, idempotency, HMAC, timestamp validation and retry behavior.
- Never log integration secrets.
- Do not fake successful external delivery.

Detailed rules: docs/N8N.md and docs/SECURITY.md.

## 8. UI and design
Design direction: Premium Intelligent SaaS, light-first.
- Use the existing shared design tokens and components.
- Use Lucide icons; no decorative emoji in UI.
- Keep glass effects subtle and limited to appropriate controls.
- Prioritize hierarchy, contrast, readability and useful information density.
- Keep desktop and mobile layouts usable.
- Preserve all existing functionality and interaction states.
- Do not change business logic during visual-only tasks.

## 9. Changes and tests
- Inspect relevant code before editing.
- Make the smallest safe change.
- Add or update tests for changed behavior.
- Run only relevant checks; run broader checks when impact warrants it.
- Never claim a test passed unless it was executed.
- Update docs only when behavior, API, architecture or setup changes.
- Keep docs/IMPLEMENTATION_PLAN.md accurate.

## 10. Git and completion
- Check git status before editing.
- Preserve all existing user changes and uncommitted work.
- Never use git add . .
- Never reset, clean, discard or rewrite history without explicit approval.
- Never commit or push unless explicitly requested.
- Report changed files, checks actually run and remaining blockers.
