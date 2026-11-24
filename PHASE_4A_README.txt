WAYFORWARD CONSULTANCY CRM | PHASE 4A - CORE JOB WORKFLOW
Baseline: uploaded GoDaddy backend and tested GitHub frontend Status Fix ZIP.

DEPLOYMENT
1. Export a fresh live database backup. Do not import any old SQL dump.
2. Back up the live Node application files and GitHub revision. Deploy backend first.
3. Extract backend ZIP and upload contents of its existing Wayforward_GoDaddy_Reuse_Backend folder into the existing Node application root (same server.js location). Preserve live .env, credentials, hosting settings and database. Restart Node application.
4. Extract frontend ZIP and replace files at the existing GitHub repository root. Preserve your live config.js if it differs from supplied baseline. Commit; after Pages deploys, hard-refresh (Ctrl+F5).
5. No manual SQL migration or environment variable changes required for existing 35-table schema. Existing application schema initialization remains in place.

CHANGES
- Hide New Job buttons from Client Master, Jobs & Services and Follow-ups; retain existing authorised message, Client Profile and Client Workspace creation routes.
- New unified jobs start Assigned. Acknowledge Job records an acknowledgement event, sets IN_PROGRESS and notifies named Admin/Team Lead accounts plus legacy Admin-key login.
- Employee Job Completed submits for review; only Admin may approve Job Done. Return for Correction requires a reason. Cancel on optional completion prompt leaves status unchanged.
- Workflow-derived case status is authoritative for linked jobs in job cards, dashboard register, profile and master job listings. Legacy raw case stage is retained for historical compatibility; manual edit cannot override linked workflow stage or assignee.
- Billing options and job-linked invoice POST require at least one Admin-completed workflow task and no unfinished or untracked linked tasks. Cancelled tasks do not prevent billing if another linked task is approved. Existing unlinked/manual invoices remain supported. Billed jobs cannot be reopened, reassigned or receive extra workflow tasks; review invoice before making corrections.
- Existing notification panel receives acknowledgement/review events; new central bell and UI redesign are Phase 4B/4C work. Legacy notifications remain available under prior history rules.
- No inbox redesign, no conversation button changes, no WhatsApp webhook/API changes. Full stage tracker, counters, document management, follow-up enhancements and remaining billing design deferred to later phases.

LIVE ACCEPTANCE TEST (use a new test job; do not use already billed jobs)
[ ] Admin logs in and confirms the 3 unwanted job creation options are absent; existing creation works.
[ ] Admin creates a job assigned to Guru. Both case list and employee dashboard show Assigned.
[ ] Guru opens My Dashboard, clicks Acknowledge Job. It changes directly to In Progress.
[ ] Admin sees Job acknowledged in existing notifications. Refresh if needed (poll ~15 seconds for foreground page).
[ ] Guru selects Job Completed; optional summary can be cancelled without change. Confirmed submission shows Pending Admin Review.
[ ] Admin confirms the job is not selectable for linked billing while under review.
[ ] Admin returns job for correction with reason, Guru acknowledges again and resubmits.
[ ] Admin clicks Job Done in Staff Tasks or task dashboard; job status displays Job Done and assigned employee gets notification.
[ ] Central Billing & Collections shows approved, unbilled job in eligible selection; do not send a real invoice while testing.
[ ] Confirm existing client data, message history, jobs, invoices and receipts remain available.
[ ] Verify existing inbound/outbound WhatsApp exchange using authorised test recipient.

LOCAL VERIFICATION
All shipped JavaScript files passed node --check. Simulated backend route tests passed for acknowledgement, role checks, waiting/review/reopen/approve, billing gate and billed job lock. Derived status SQL expression passed 12 scenarios in SQLite. These tests do not replace live MySQL, browser or GoDaddy deployment testing. No live data or hosting changes were made.

ROLLBACK
Restore previous frontend commit and backend files together; keep the live database intact. Never reimport a historical SQL backup merely to roll back application code. Any workflow events created during live testing should be retained and reviewed.
