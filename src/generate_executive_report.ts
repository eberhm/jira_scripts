/**
 * Script: generate_executive_report.ts
 * - Reads REPORT_JQL from env
 * - Fetches all matching Jira issues via utils.fetchAllTickets
 * - Builds a concise prompt via utils.buildReportPrompt
 * - Calls Google Vertex (Gemini) via utils.callGemini (text-bison-001)
 * - Prints report to stdout and saves a timestamped Markdown file under ./reports/
 */

import fs from "fs";
import path from "path";
import {
  fetchAllTickets,
  buildReportPrompt,
  callGemini,
  info,
  debug,
  warn,
  error,
} from "./utils";

async function generateExecutiveReport(): Promise<void> {
  try {
    const JQLS = [
      // Hardcoded JQLs — update these JQL strings as needed
      'project in ("Developer Experience & Automation") and updatedDate >= -4w and status in (Done, Closed, Resolved, "In Development") ORDER BY component ASC, issuetype ASC',
      'project in ("Developer Experience & Automation") and issuetype = Epic and updatedDate >= -4w and status in (Done, Closed, Resolved, "In Development") ORDER BY component ASC, issuetype ASC',
    ];

    info("Fetching tickets for JQLs:", JQLS);
    const issuesArrays = await Promise.all(
      JQLS.map((jql) => fetchAllTickets(jql))
    );
    const combined = ([] as any[]).concat(...issuesArrays.filter(Boolean));

    // Deduplicate issues by key (fallback to id)
    const seen = new Set<string>();
    const issues = combined.filter((issue: any) => {
      const key = issue?.key || issue?.id;
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!issues || issues.length === 0) {
      info("No issues found for given JQL.");
      return;
    }

    info(`Fetched ${issues.length} issues.`);
    debug("Building prompt from issues...");
    const prompt = buildReportPrompt(issues);

    info("Calling Gemini to generate executive report...");
    const maxOutputTokens = parseInt(
      process.env.REPORT_MAX_TOKENS || "4000",
      10
    );
    const report = await callGemini(prompt, {
      maxOutputTokens,
    });

    // Ensure reports directory exists
    const reportsDir = path.resolve(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:]/g, "").replace(/\..+/, "");
    const filename = `executive_report-${timestamp}.md`;
    const filepath = path.join(reportsDir, filename);

    const content = `# Executive report\n\nGenerated: ${now.toISOString()}\n\n${report}\n`;

    fs.writeFileSync(filepath, content, { encoding: "utf8" });

    info("Executive report generated:");
    info(content);
    info(`Saved to ${filepath}`);
  } catch (err: any) {
    if (err.response) {
      error(
        "API error:",
        err.response.status,
        JSON.stringify(err.response.data)
      );
    } else {
      error("Error:", err.message || err);
    }
    process.exit(1);
  }
}

generateExecutiveReport();
