export interface SearchReplaceConfig {
  // GitHub authentication
  githubToken: string;

  // Target organizations and search parameters
  organizations: string[];
  searchString: string;
  replacementString: string;

  // File filtering options
  includeExtensions?: string[];
  excludePatterns?: string[];

  // Repository filtering
  includeArchived?: boolean;
  repositoryTypes?: ("public" | "private" | "internal")[];

  // Pull request settings
  branchPrefix?: string;
  prTitle?: string;
  prBody?: string;
  prLabels?: string[];

  // Execution options
  dryRun?: boolean;
  maxReposPerOrg?: number;
}

export function getDefaultConfig(): Partial<SearchReplaceConfig> {
  return {
    includeExtensions: [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".json",
      ".yml",
      ".yaml",
      ".md",
      ".txt",
      ".html",
      ".css",
      ".py",
      ".java",
      ".go",
      ".rs",
      ".dockerfile",
      ".sh",
      ".env.example",
    ],
    excludePatterns: [
      ".git/",
      "node_modules/",
      "dist/",
      "build/",
      ".next/",
      "coverage/",
      "*.log",
      "*.lock",
      "package-lock.json",
      "yarn.lock",
    ],
    includeArchived: false,
    repositoryTypes: ["public", "private", "internal"],
    branchPrefix: "automated-string-replacement",
    prTitle: "Replace {searchString} with {replacementString}",
    prBody: `This PR replaces all occurrences of \`{searchString}\` with \`{replacementString}\`.

## Changes Made
- Updated string references across the codebase
- No functional changes expected

## Review Notes
Please verify that the replacements are correct and don't break any functionality.

_This PR was created automatically by a search and replace script._`,
    prLabels: ["automated", "maintenance"],
    dryRun: false,
    maxReposPerOrg: 50,
  };
}

export function validateConfig(config: SearchReplaceConfig): string[] {
  const errors: string[] = [];

  if (!config.githubToken) {
    errors.push("GitHub token is required");
  }

  if (!config.organizations || config.organizations.length === 0) {
    errors.push("At least one organization must be specified");
  }

  if (!config.searchString) {
    errors.push("Search string is required");
  }

  if (!config.replacementString) {
    errors.push("Replacement string is required");
  }

  if (config.searchString === config.replacementString) {
    errors.push("Search and replacement strings cannot be the same");
  }

  return errors;
}
