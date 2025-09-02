/**
 * Example script: list_issues.ts
 * - Uses getTickets(jql) from ./utils
 * - Prints issue key and summary
 */

import { getTickets } from "./utils";

async function listIssues(): Promise<void> {
  try {
    const jql = "assignee=currentuser() ORDER BY updated DESC";
    const data = await getTickets(jql);

    const issues = data.issues ?? [];
    if (issues.length === 0) {
      console.log("No issues found for current user.");
      return;
    }

    const rows = issues.map((i: any) => ({
      key: i.key,
      summary: i.fields?.summary ?? "",
    }));

    console.table(rows);
  } catch (err: any) {
    if (err.response) {
      console.error(
        "Jira API error:",
        err.response.status,
        JSON.stringify(err.response.data)
      );
    } else {
      console.error("Request error:", err.message || err);
    }
    process.exit(1);
  }
}

listIssues();
