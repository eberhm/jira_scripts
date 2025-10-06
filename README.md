# jira_scripts

Collection of TypeScript scripts to manage a Jira Cloud account and GitHub repositories.

## Purpose

Store small TypeScript scripts runnable via `npm run` to interact with the Jira REST API and generate simple artifacts (for example, an executive report).

## Setup

1. Install dependencies:

```bash
npm install
```

2. Provide credentials via environment variables:

- JIRA_BASE_URL (e.g. https://your-org.atlassian.net)
- JIRA_EMAIL
- JIRA_API_TOKEN

Export example (macOS / Linux / zsh):

```bash
export JIRA_BASE_URL="https://your-org.atlassian.net"
export JIRA_EMAIL="you@example.com"
export JIRA_API_TOKEN="your_api_token"
```

3. For Gemini (Google) API:

- Either set GOOGLE_API_KEY (simple API key usage), or configure Vertex ADC:
  - Set GOOGLE_GENAI_USE_VERTEXAI=true and provide GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION
- Optionally set REPORT_MAX_TOKENS to increase output size (default: 4000)

## Scripts

- npm run list-issues

  - Runs `src/list_issues.ts` using `ts-node`.
  - Lists issues assigned to the current user (key + summary).

- npm run generate-executive-report
  - Runs `src/generate_executive_report.ts` using `ts-node`.
  - The script fetches issues for multiple hardcoded JQLs declared in `src/generate_executive_report.ts`, deduplicates them, builds a concise prompt, calls Gemini (via `@google/genai`), and saves a timestamped Markdown report under `./reports/`.
  - To override the max tokens for Gemini output:

```bash
REPORT_MAX_TOKENS=6000 npm run generate-executive-report
```

- To change which JQLs are run, edit the `JQLS` array inside `src/generate_executive_report.ts`.

- npm run github-search-replace
  - Runs `src/github-search-replace.ts` using `ts-node`.
  - Searches for a string across all repositories in specified GitHub organizations and creates pull requests with replacements.
  - Requires GITHUB_TOKEN environment variable.
  - See [GITHUB_SEARCH_REPLACE.md](GITHUB_SEARCH_REPLACE.md) for detailed documentation.

## Reports

- Generated reports are written to the `reports/` directory as `executive_report-<timestamp>.md`.

## Files

- package.json — scripts and dependencies
- tsconfig.json — TypeScript config
- src/list_issues.ts — example script to list issues
- src/generate_executive_report.ts — generate executive report from multiple JQLs
- src/github-search-replace.ts — GitHub search and replace script
- src/github-client.ts — GitHub API wrapper
- src/search-replace-config.ts — configuration interface for GitHub script
- src/utils.ts — helper functions (Jira fetch, prompt builder, Gemini caller)
- reports/ — generated reports (output)
- GITHUB_SEARCH_REPLACE.md — detailed documentation for GitHub script

## Notes

- This minimal scaffold uses Basic auth (email:api token). Keep tokens secure.
- For CI or more complex workflows consider adding dotenv usage, a build step, and tests.
