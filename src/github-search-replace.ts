import dotenv from "dotenv";
import {
  SearchReplaceConfig,
  getDefaultConfig,
  validateConfig,
} from "./search-replace-config";
import { GitHubClient, PRCreationResult, FileMatch } from "./github-client";
import { info, warn, error, debug } from "./utils";

dotenv.config();

export interface ExecutionSummary {
  totalRepositories: number;
  repositoriesWithMatches: number;
  totalFilesChanged: number;
  successfulPRs: number;
  failedPRs: number;
  prs: PRCreationResult[];
  errors: string[];
}

export async function executeSearchReplace(
  config: SearchReplaceConfig
): Promise<ExecutionSummary> {
  // Validate configuration
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`Configuration errors: ${configErrors.join(", ")}`);
  }

  info("Starting GitHub search and replace operation");
  info(`Organizations: ${config.organizations.join(", ")}`);
  info(`Search: "${config.searchString}"`);
  info(`Replace: "${config.replacementString}"`);
  info(`Dry run: ${config.dryRun ? "YES" : "NO"}`);

  const client = new GitHubClient(config);
  const summary: ExecutionSummary = {
    totalRepositories: 0,
    repositoriesWithMatches: 0,
    totalFilesChanged: 0,
    successfulPRs: 0,
    failedPRs: 0,
    prs: [],
    errors: [],
  };

  try {
    // Perform a single search across all organizations
    info(`\n=== Searching across all organizations ===`);
    const searchResults = await client.searchAcrossOrganizations();

    info(`Found matches in ${searchResults.size} repositories`);
    summary.repositoriesWithMatches = searchResults.size;

    // Process each repository with matches
    for (const [repoFullName, matches] of searchResults) {
      try {
        summary.totalFilesChanged += matches.length;

        const totalMatches = matches.reduce(
          (total: number, match: FileMatch) => total + match.matchCount,
          0
        );

        info(
          `Processing ${repoFullName}: ${matches.length} files, ${totalMatches} total occurrences`
        );

        // Log file details
        for (const match of matches) {
          info(`  - ${match.path}: ${match.matchCount} occurrences`);
        }

        if (config.dryRun) {
          info(`[DRY RUN] Would create PR for ${repoFullName}`);
          continue;
        }

        // Create pull request
        try {
          const prResult = await client.createPullRequest(
            repoFullName,
            matches
          );
          summary.prs.push(prResult);
          summary.successfulPRs++;
          info(`✅ Created PR for ${repoFullName}: ${prResult.prUrl}`);
        } catch (prError: any) {
          summary.failedPRs++;
          const errorMsg = `Failed to create PR for ${repoFullName}: ${prError.message}`;
          summary.errors.push(errorMsg);
          error(errorMsg);
        }
      } catch (repoError: any) {
        const errorMsg = `Error processing repository ${repoFullName}: ${repoError.message}`;
        summary.errors.push(errorMsg);
        error(errorMsg);
      }
    }
  } catch (searchError: any) {
    const errorMsg = `Error during search operation: ${searchError.message}`;
    summary.errors.push(errorMsg);
    error(errorMsg);
  }

  return summary;
}

function printSummary(summary: ExecutionSummary, config: SearchReplaceConfig) {
  info("\n" + "=".repeat(60));
  info("EXECUTION SUMMARY");
  info("=".repeat(60));
  info(`Organizations processed: ${config.organizations.join(", ")}`);
  info(`Total repositories scanned: ${summary.totalRepositories}`);
  info(`Repositories with matches: ${summary.repositoriesWithMatches}`);
  info(`Total files that would be/were changed: ${summary.totalFilesChanged}`);

  if (config.dryRun) {
    info(
      `[DRY RUN] PRs that would be created: ${summary.repositoriesWithMatches}`
    );
  } else {
    info(`Successful PRs created: ${summary.successfulPRs}`);
    info(`Failed PR attempts: ${summary.failedPRs}`);
  }

  if (summary.errors.length > 0) {
    warn(`\nErrors encountered: ${summary.errors.length}`);
    summary.errors.forEach((err, i) => warn(`  ${i + 1}. ${err}`));
  }

  if (summary.prs.length > 0) {
    info("\nCreated Pull Requests:");
    summary.prs.forEach((pr) => {
      info(
        `  • ${pr.repository}: PR #${pr.prNumber} (${pr.filesChanged} files)`
      );
      info(`    ${pr.prUrl}`);
    });
  }

  info("=".repeat(60));
}

async function main() {
  try {
    // Build configuration from environment and defaults
    const config: SearchReplaceConfig = {
      ...getDefaultConfig(),
      githubToken: process.env.GITHUB_TOKEN || "",
      organizations: ["new-work", "xing-com"],
      searchString: "project-metadata.xing.io",
      replacementString: "project-metadata.nwse.io",
    };

    // Override with environment variables if present
    if (process.env.GITHUB_ORGANIZATIONS) {
      config.organizations = process.env.GITHUB_ORGANIZATIONS.split(",").map(
        (org) => org.trim()
      );
    }
    if (process.env.SEARCH_STRING) {
      config.searchString = process.env.SEARCH_STRING;
    }
    if (process.env.REPLACEMENT_STRING) {
      config.replacementString = process.env.REPLACEMENT_STRING;
    }
    if (process.env.DRY_RUN === "true") {
      config.dryRun = true;
    }

    // Validate required environment variables
    if (!config.githubToken) {
      error(
        "Missing GITHUB_TOKEN environment variable. Please set it to your GitHub Personal Access Token."
      );
      process.exit(1);
    }

    info("Configuration loaded:");
    info(`  Organizations: ${config.organizations.join(", ")}`);
    info(`  Search string: "${config.searchString}"`);
    info(`  Replacement string: "${config.replacementString}"`);
    info(`  Dry run: ${config.dryRun ? "YES" : "NO"}`);
    info(`  Max repos per org: ${config.maxReposPerOrg}`);

    // Execute the search and replace operation
    const summary = await executeSearchReplace(config);

    // Print results
    printSummary(summary, config);

    // Exit with appropriate code
    const hasErrors = summary.errors.length > 0 || summary.failedPRs > 0;
    process.exit(hasErrors ? 1 : 0);
  } catch (err: any) {
    error("Fatal error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
