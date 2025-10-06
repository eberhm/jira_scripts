import { Octokit } from "@octokit/rest";
import { SearchReplaceConfig } from "./search-replace-config";
import { info, debug, warn, error } from "./utils";

export interface RepositoryInfo {
  name: string;
  fullName: string;
  defaultBranch: string;
  isArchived: boolean;
  visibility: "public" | "private" | "internal";
  cloneUrl: string;
}

export interface FileMatch {
  path: string;
  content: string;
  sha: string;
  matchCount: number;
  repository: string;
  url: string;
}

export interface SearchResult {
  repository: string;
  matches: FileMatch[];
}

export interface PRCreationResult {
  repository: string;
  prNumber: number;
  prUrl: string;
  filesChanged: number;
  branchName: string;
}

export class GitHubClient {
  private octokit: Octokit;
  private config: SearchReplaceConfig;

  constructor(config: SearchReplaceConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.githubToken,
    });
  }

  async searchAcrossOrganizations(): Promise<Map<string, FileMatch[]>> {
    info(
      `Searching for "${
        this.config.searchString
      }" across organizations: ${this.config.organizations.join(", ")}`
    );

    const allMatches = new Map<string, FileMatch[]>();

    try {
      // Build search query for all organizations
      const orgQueries = this.config.organizations
        .map((org) => `org:${org}`)
        .join(" ");
      const fileExtensions = ""; //this.getFileExtensionQuery();

      // GitHub Code Search query
      // const searchQuery = `"${this.config.searchString}" ${orgQueries}${fileExtensions}`;
      // const searchQuery = `repo%3Anew-work%2Fproject-metadata%20project-metadata.xing.io`;
      //const searchQuery = "repo:new-work/project-metadata project-metadata.xing.io";
      const searchQuery = `"${this.config.searchString}" ${orgQueries}`;


      info(`GitHub search query: ${searchQuery}`);

      let page = 1;
      let hasMoreResults = true;
      const perPage = 100;

      while (hasMoreResults && page <= 10) {
        // Limit to 1000 results max
        debug(`Fetching search results page ${page}`);

        const response = await this.octokit.rest.search.code({
          q: searchQuery,
          per_page: perPage,
          page,
        });

        debug(response)

        const { data } = response; 

        if (data.items.length === 0) {
          hasMoreResults = false;
          break;
        }

        info(
          `Found ${data.items.length} code matches on page ${page} (total: ${data.total_count})`
        );

        // Process search results
        for (const item of data.items) {
          const repoName = item.repository.full_name;

          // Apply repository filters
          if (!this.shouldProcessRepository(item.repository)) {
            debug(`Skipping repository due to filters: ${repoName}`);
            continue;
          }

          // Skip if file should be excluded
          if (this.shouldExcludePath(item.path)) {
            debug(`Skipping file due to path exclusion: ${item.path}`);
            continue;
          }

          try {
            // Get the full file content
            const fileContent = await this.getFileContent(
              item.repository.owner.login,
              item.repository.name,
              item.path,
              item.repository.default_branch || "main"
            );

            if (
              fileContent &&
              fileContent.content.includes(this.config.searchString)
            ) {
              const matchCount = (
                fileContent.content.match(
                  new RegExp(this.config.searchString, "g")
                ) || []
              ).length;

              const fileMatch: FileMatch = {
                path: item.path,
                content: fileContent.content,
                sha: fileContent.sha,
                matchCount,
                repository: repoName,
                url: item.html_url,
              };

              if (!allMatches.has(repoName)) {
                allMatches.set(repoName, []);
              }
              allMatches.get(repoName)!.push(fileMatch);

              debug(`Found ${matchCount} matches in ${repoName}/${item.path}`);
            }
          } catch (fileError: any) {
            warn(
              `Could not fetch content for ${repoName}/${item.path}: ${fileError.message}`
            );
          }
        }

        // Check if we have more pages
        hasMoreResults =
          data.items.length === perPage &&
          page < Math.ceil(data.total_count / perPage);
        page++;

        // Add delay to respect rate limits
        if (hasMoreResults) {
          await this.delay(1000); // 1 second delay between pages
        }
      }

      info(
        `Search completed. Found matches in ${allMatches.size} repositories`
      );

      // Log summary
      for (const [repo, matches] of allMatches) {
        const totalMatches = matches.reduce(
          (sum, match) => sum + match.matchCount,
          0
        );
        info(
          `  ${repo}: ${matches.length} files, ${totalMatches} total occurrences`
        );
      }

      return allMatches;
    } catch (err: any) {
      error(`Search failed:`, err.message);
      throw err;
    }
  }

  private getFileExtensionQuery(): string {
    if (
      !this.config.includeExtensions ||
      this.config.includeExtensions.length === 0
    ) {
      return "";
    }

    // Convert extensions to GitHub search format
    const extensions = this.config.includeExtensions
      .map((ext) => (ext.startsWith(".") ? ext.slice(1) : ext))
      .map((ext) => `extension:${ext}`)
      .join(" ");

    return ` ${extensions}`;
  }

  private shouldProcessRepository(repo: any): boolean {
    // Check archived filter
    if (!this.config.includeArchived && repo.archived) {
      return false;
    }

    // Check visibility filter
    if (this.config.repositoryTypes && this.config.repositoryTypes.length > 0) {
      const visibility = repo.visibility || repo.private ? "private" : "public";
      if (!this.config.repositoryTypes.includes(visibility as any)) {
        return false;
      }
    }

    return true;
  }

  private shouldExcludePath(path: string): boolean {
    if (!this.config.excludePatterns) return false;

    return this.config.excludePatterns.some((pattern) => {
      if (pattern.includes("*")) {
        // Simple glob pattern matching
        const regexPattern = pattern.replace(/\*/g, ".*");
        return new RegExp(regexPattern).test(path);
      }
      return path.includes(pattern);
    });
  }

  private async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<{ content: string; sha: string } | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data) || data.type !== "file") {
        return null;
      }

      return {
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        sha: data.sha,
      };
    } catch (err: any) {
      throw new Error(`Failed to get file content: ${err.message}`);
    }
  }

  async getRepositoryInfo(
    repoFullName: string
  ): Promise<RepositoryInfo | null> {
    try {
      const [owner, repo] = repoFullName.split("/");
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return {
        name: data.name,
        fullName: data.full_name,
        defaultBranch: data.default_branch || "main",
        isArchived: data.archived || false,
        visibility:
          (data.visibility as any) || (data.private ? "private" : "public"),
        cloneUrl: data.clone_url || "",
      };
    } catch (err: any) {
      error(`Failed to get repository info for ${repoFullName}:`, err.message);
      return null;
    }
  }

  async createPullRequest(
    repoFullName: string,
    matches: FileMatch[]
  ): Promise<PRCreationResult> {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    const branchName = `${this.config.branchPrefix}-${timestamp}`;
    const [owner, repo] = repoFullName.split("/");

    info(`Creating PR for ${repoFullName} with ${matches.length} file changes`);

    try {
      // Get repository info to get default branch
      const repoInfo = await this.getRepositoryInfo(repoFullName);
      if (!repoInfo) {
        throw new Error(
          `Could not get repository information for ${repoFullName}`
        );
      }

      // Get the base branch reference
      const { data: baseBranch } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${repoInfo.defaultBranch}`,
      });

      // Create new branch
      await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseBranch.object.sha,
      });

      // Update files in the new branch
      for (const match of matches) {
        const newContent = match.content.replace(
          new RegExp(this.config.searchString, "g"),
          this.config.replacementString
        );

        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: match.path,
          message: `Replace ${this.config.searchString} with ${this.config.replacementString}`,
          content: Buffer.from(newContent, "utf-8").toString("base64"),
          sha: match.sha,
          branch: branchName,
        });
      }

      // Create pull request
      const prTitle = this.config
        .prTitle!.replace("{searchString}", this.config.searchString)
        .replace("{replacementString}", this.config.replacementString);

      const prBody = this.config
        .prBody!.replace("{searchString}", this.config.searchString)
        .replace("{replacementString}", this.config.replacementString);

      const { data: pr } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title: prTitle,
        head: branchName,
        base: repoInfo.defaultBranch,
        body: prBody,
      });

      // Add labels if configured
      if (this.config.prLabels && this.config.prLabels.length > 0) {
        try {
          await this.octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: pr.number,
            labels: this.config.prLabels,
          });
        } catch (err: any) {
          warn(
            `Could not add labels to PR ${pr.number} in ${repoFullName}:`,
            err.message
          );
        }
      }

      info(`Created PR #${pr.number}: ${pr.html_url}`);

      return {
        repository: repoFullName,
        prNumber: pr.number,
        prUrl: pr.html_url,
        filesChanged: matches.length,
        branchName,
      };
    } catch (err: any) {
      error(`Failed to create PR for ${repoFullName}:`, err.message);
      throw err;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
