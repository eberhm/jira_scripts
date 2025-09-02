# AGENTS

- Always search src/utils.ts for existing helper functions before adding new ones. Do not duplicate functionality that already exists in utils.

- Rule: reuse and extend existing utilities (e.g., getTickets) instead of creating new functions that re-implement the same HTTP/auth logic (e.g., fetchTicketsPage, fetchAllTickets).

- Recommended approach:

  - If you need pagination or different fields, extend getTickets to accept options (startAt, maxResults, fields) or add a thin wrapper that calls getTickets with those options.
  - Keep authentication, env validation, and request logic centralized in utils to avoid inconsistencies and bugs.

- Rationale: reduces duplicated code, eases maintenance, and ensures a single source of truth for Jira API interactions.

- Current action item: refactor generate_executive_report.ts to call getTickets (with appropriate options) or adjust getTickets to support paging/fields before removing duplicate helpers.
