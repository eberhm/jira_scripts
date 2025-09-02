# jira_scripts

Minimal TypeScript scaffold with example scripts to manage a Jira Cloud account.

## Purpose

Store small TypeScript scripts runnable via `npm run` to interact with the Jira REST API.

## Setup

1. Install dependencies:
   npm install

2. Provide credentials via environment variables:
   - JIRA_BASE_URL (e.g. https://your-org.atlassian.net)
   - JIRA_EMAIL
   - JIRA_API_TOKEN

Export example (macOS / Linux / zsh):
export JIRA_BASE_URL="https://your-org.atlassian.net"
export JIRA_EMAIL="you@example.com"
export JIRA_API_TOKEN="your_api_token"

## Scripts

- npm run list-issues
  - Runs src/list_issues.ts using ts-node.
  - Lists issues assigned to the current user (key + summary).

## Notes

- This minimal scaffold uses Basic auth (email:api token). Keep tokens secure.
- For CI or more complex workflows consider adding dotenv, build step, and tests later.

## Files

- package.json — scripts and dependencies
- tsconfig.json — TypeScript config
- src/list_issues.ts — example script
- .gitignore
