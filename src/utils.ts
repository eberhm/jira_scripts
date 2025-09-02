import dotenv from "dotenv";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
dotenv.config();

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

function ensureEnv(): void {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error(
      "Missing environment variables. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN"
    );
  }
}

/**
 * Simple logger helpers driven by LOG_LEVEL env var.
 * LOG_LEVEL values: DEBUG, INFO, WARN, ERROR (default: INFO)
 */
const LOG_LEVEL = (process.env.LOG_LEVEL || "INFO").toUpperCase();

const LEVEL_PRIORITY: Record<string, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

function currentPriority(): number {
  return LEVEL_PRIORITY[LOG_LEVEL] ?? LEVEL_PRIORITY.INFO;
}

function shouldLog(level: string): boolean {
  const p = LEVEL_PRIORITY[level] ?? 0;
  return p >= currentPriority();
}

export function debug(...args: any[]): void {
  if (shouldLog("DEBUG")) {
    console.debug("[DEBUG]", ...args);
  }
}
export function info(...args: any[]): void {
  if (shouldLog("INFO")) {
    console.log("[INFO]", ...args);
  }
}
export function warn(...args: any[]): void {
  if (shouldLog("WARN")) {
    console.warn("[WARN]", ...args);
  }
}
export function error(...args: any[]): void {
  if (shouldLog("ERROR")) {
    console.error("[ERROR]", ...args);
  }
}

/**
 * Calls Jira search API with the provided JQL and returns the parsed JSON body.
 * Supports optional paging and fields to avoid duplicating auth/request logic.
 */
export async function getTickets(
  jql: string,
  opts?: { startAt?: number; maxResults?: number; fields?: string[] }
): Promise<any> {
  ensureEnv();

  const baseUrl = JIRA_BASE_URL!.replace(/\/+$/, "");
  const auth = Buffer.from(`${JIRA_EMAIL!}:${JIRA_API_TOKEN!}`).toString(
    "base64"
  );

  const startAt = opts?.startAt ?? 0;
  const maxResults = opts?.maxResults ?? 50;
  const fields = opts?.fields ? opts.fields.join(",") : "summary";

  const encoded = encodeURIComponent(jql);
  const url = `${baseUrl}/rest/api/3/search?jql=${encoded}&startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`;

  debug("getTickets URL", url);
  const res = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  return res.data;
}

/**
 * Fetch all tickets matching a JQL by paging through results.
 * Returns a flat array of issues.
 */
export async function fetchAllTickets(jql: string): Promise<any[]> {
  const maxResults = 100;
  let startAt = 0;
  const all: any[] = [];

  while (true) {
    const data = await getTickets(jql, {
      startAt,
      maxResults,
      fields: [
        "summary",
        "status",
        "assignee",
        "priority",
        "created",
        "updated",
        "labels",
        "description",
        "resolution",
      ],
    });

    const issues = data.issues ?? [];
    all.push(...issues);

    const total = typeof data.total === "number" ? data.total : all.length;
    startAt += maxResults;
    if (all.length >= total) break;
  }

  return all;
}

/**
 * Sanitize and truncate text for inclusion in prompts.
 */
function sanitizeText(text: any, maxLen = 1000): string {
  if (!text) return "";
  const s = String(text)
    .replace(/\r\n|\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

/**
 * Build a concise prompt for Gemini to produce an executive report.
 */
export function buildReportPrompt(issues: any[]): string {
  const header =
    `You are an assistant that writes concise executive reports for engineering leadership. 
Produce three sections in Markdown: '## Achievements', '## Continued efforts', and '## In Progress'. 
Keep bullets short and outcome-focused. Synthesize related tickets into grouped bullets and 
avoid overly technical details. The most important things are always clustered in epics and 
Epics are the more insightfull things for the readers.

Be concise and do not exceed 1000 words approx`;

  const ticketLines = issues
    .map((i: any) => {
      const f = i.fields || {};
      const key = i.key;
      const summary = f.summary ?? "";
      const status = f.status?.name ?? "";
      const assignee = f.assignee?.displayName ?? "Unassigned";
      const priority = f.priority?.name ?? "";
      const labels = Array.isArray(f.labels) ? f.labels.join(", ") : "";
      const updated = f.updated ?? "";
      const desc = sanitizeText(f.description, 400);
      const parts = [
        `${key}: ${summary}`,
        status ? `[${status}]` : "",
        `assignee: ${assignee}`,
        priority ? `priority: ${priority}` : "",
        labels ? `labels: ${labels}` : "",
        `updated: ${updated}`,
      ]
        .filter(Boolean)
        .join(" • ");

      return `${parts}${desc ? " • " + desc : ""}`;
    })
    .join("\n");

  const instruction =
    "\n\nGiven the following compact list of Jira issues, generate an executive report in Markdown with the three sections mentioned above. Prioritize achievements and completed work in 'Achievements', notable ongoing efforts under 'Continued efforts', and active work or blockers under 'In Progress'. Keep the report succinct (about 8-20 bullets total) and use the same style as these examples:\n\n- Short outcome-focused bullets\n- Sub-bullets where helpful\n\nNow synthesize the input below:\n\n";

  return `${header}${instruction}${ticketLines}`;
}

/**
 * Call Gemini via official @google/genai SDK.
 * Uses GOOGLE_API_KEY (API key for Gemini Developer API) or Vertex if configured via env.
 */
export async function callGemini(
  prompt: string,
  opts: { model?: string; maxOutputTokens?: number; temperature?: number } = {}
): Promise<string> {
  // tolerate quoted API key in .env
  const rawKey = process.env.GOOGLE_API_KEY ?? "";
  const apiKey = rawKey.replace(/^"(.*)"$/, "$1").trim();

  // Default to a Gemini 2.x model name suitable for SDK usage
  const model =
    opts.model ?? process.env.GOOGLE_MODEL ?? "gemini-2.0-flash-001";

  // If user wants Vertex, they can set GOOGLE_GENAI_USE_VERTEXAI=true and provide GOOGLE_CLOUD_PROJECT & GOOGLE_CLOUD_LOCATION
  const useVertex =
    (process.env.GOOGLE_GENAI_USE_VERTEXAI ?? "").toLowerCase() === "true";

  if (!apiKey && !useVertex) {
    throw new Error(
      "Missing environment variable: GOOGLE_API_KEY or set GOOGLE_GENAI_USE_VERTEXAI for Vertex ADC auth"
    );
  }

  // Initialize client. For API-key usage, pass apiKey. For Vertex usage, SDK will use ADC and vertex settings.
  const client = apiKey
    ? new GoogleGenAI({ apiKey })
    : new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION,
      });

  debug("callGemini (SDK) initialize", {
    model,
    useVertex,
    preview: prompt.slice(0, 200),
  });

  try {
    const response: any = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 512,
      },
    });

    // SDK response shapes vary by version; try common properties
    if (response?.text) return response.text;
    if (response?.output?.[0]?.content) {
      const c = response.output[0].content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((p: any) => p.text ?? "").join("\n");
    }
    if (response?.candidates?.[0]?.content)
      return response.candidates[0].content;
    if (response?.candidates?.[0]?.text) return response.candidates[0].text;

    // fallback
    return JSON.stringify(response, null, 2);
  } catch (err: any) {
    if (err?.name === "ApiError" || err?.status) {
      error(
        "Gemini SDK ApiError:",
        err.name,
        err.message,
        "status:",
        err.status
      );
      if (err?.status === 404) {
        error("404 from Gemini SDK — check API key/project and model name.");
      }
    } else {
      error("Gemini SDK request failed:", err.message || err);
    }
    throw err;
  }
}
