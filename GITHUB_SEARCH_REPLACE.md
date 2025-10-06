# GitHub Search and Replace Script

This script searches for a specific string across all repositories in configured GitHub organizations and creates pull requests to replace the string with a new value.

## Features

- 🔍 **Multi-Organization Search**: Search across multiple GitHub organizations with a single API call
- 📁 **File Type Filtering**: Configure which file extensions to process
- 🚫 **Smart Exclusions**: Skip common directories like `node_modules`, `.git`, etc.
- 🔀 **Automated PRs**: Create pull requests with the replacements
- 🏷️ **Custom Labels**: Add labels to created pull requests
- 🧪 **Dry Run Mode**: Test the script without creating actual PRs
- 📊 **Detailed Reporting**: Get comprehensive execution summaries
- ⚡ **Optimized API Usage**: Uses GitHub's Code Search API to minimize API calls

## Prerequisites

1. **GitHub Personal Access Token** with the following permissions:

   - `repo` - Full repository access
   - `read:org` - Read organization membership

2. **Node.js** and **npm** installed

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env and set your GITHUB_TOKEN
   ```

3. **Set your GitHub token** in `.env`:
   ```env
   GITHUB_TOKEN=your_github_personal_access_token
   ```

## Usage

### Basic Usage

Run with default configuration (searches for `project-metadata.xing.io` and replaces with `project-metadata.nwse.io` in `new-work` and `xing-com` organizations):

```bash
npm run github-search-replace
```

### Environment Variable Configuration

You can override the default settings using environment variables:

```bash
# Set custom organizations
GITHUB_ORGANIZATIONS="org1,org2,org3" npm run github-search-replace

# Set custom search and replacement strings
SEARCH_STRING="old-value" REPLACEMENT_STRING="new-value" npm run github-search-replace

# Run in dry-run mode (no PRs created)
DRY_RUN=true npm run github-search-replace
```

### Complete Example

```bash
# Search for 'api.example.com' and replace with 'api-v2.example.com'
# in 'my-org' organization, in dry-run mode
GITHUB_ORGANIZATIONS="my-org" \
SEARCH_STRING="api.example.com" \
REPLACEMENT_STRING="api-v2.example.com" \
DRY_RUN=true \
npm run github-search-replace
```

## Configuration

The script uses sensible defaults but can be customized:

### Default File Extensions Processed

- JavaScript/TypeScript: `.js`, `.ts`, `.jsx`, `.tsx`
- Configuration: `.json`, `.yml`, `.yaml`
- Documentation: `.md`, `.txt`
- Web: `.html`, `.css`
- Other languages: `.py`, `.java`, `.go`, `.rs`
- Scripts: `.dockerfile`, `.sh`
- Environment: `.env.example`

### Default Excluded Patterns

- `.git/`
- `node_modules/`
- `dist/`, `build/`, `.next/`
- `coverage/`
- `*.log`, `*.lock`
- `package-lock.json`, `yarn.lock`

### Default PR Settings

- **Branch prefix**: `automated-string-replacement`
- **Labels**: `["automated", "maintenance"]`
- **Max repos per org**: 50

## Output

The script provides detailed logging and a comprehensive summary:

```
=== Processing organization: my-org ===
Found 25 repositories in my-org
Found matches in my-org/frontend: 3 files, 7 total occurrences
  - src/config.js: 2 occurrences
  - README.md: 1 occurrences
  - package.json: 4 occurrences
✅ Created PR for my-org/frontend: https://github.com/my-org/frontend/pull/123

============================================================
EXECUTION SUMMARY
============================================================
Organizations processed: my-org
Total repositories scanned: 25
Repositories with matches: 5
Total files that would be/were changed: 12
Successful PRs created: 5
Failed PR attempts: 0
============================================================
```

## GitHub Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select the following scopes:
   - `repo` - Full control of private repositories
   - `read:org` - Read org and team membership
4. Copy the token and add it to your `.env` file

## Safety Features

### Dry Run Mode

Always test first with dry run mode:

```bash
DRY_RUN=true npm run github-search-replace
```

### Repository Filtering

- Skips archived repositories by default
- Supports public/private repository filtering
- Limits number of repositories processed per organization

### Error Handling

- Continues processing other repositories if one fails
- Provides detailed error reporting
- Non-zero exit code if any errors occur

## Troubleshooting

### Common Issues

1. **"Authentication failed"**

   - Check your GitHub token is set correctly
   - Ensure token has required permissions

2. **"Organization not found"**

   - Verify organization names are correct
   - Check your token has access to the organizations

3. **"Rate limit exceeded"**

   - GitHub API has rate limits
   - Wait and retry, or reduce `maxReposPerOrg`

4. **"No repositories found"**
   - Organization might be empty
   - Check repository type filters
   - Verify archived repository settings

### Debug Mode

Enable debug logging to see detailed information:

```bash
LOG_LEVEL=DEBUG npm run github-search-replace
```

## Advanced Configuration

For more advanced use cases, you can modify the configuration directly in `src/github-search-replace.ts`:

```typescript
const config: SearchReplaceConfig = {
  // ... existing config
  includeExtensions: [".js", ".ts", ".json"], // Custom file types
  excludePatterns: ["custom-exclude/"], // Custom exclusions
  maxReposPerOrg: 10, // Limit repos processed
  prLabels: ["urgent", "breaking-change"], // Custom PR labels
};
```

## Security Considerations

- Never commit your `.env` file with real tokens
- Use tokens with minimal required permissions
- Consider using organization-scoped tokens when available
- Review all changes in created PRs before merging

## Examples

### Example 1: Update API Endpoints

```bash
SEARCH_STRING="api-v1.company.com" \
REPLACEMENT_STRING="api-v2.company.com" \
npm run github-search-replace
```

### Example 2: Update Configuration Values

```bash
SEARCH_STRING='"environment": "staging"' \
REPLACEMENT_STRING='"environment": "production"' \
npm run github-search-replace
```

### Example 3: Multiple Organizations

```bash
GITHUB_ORGANIZATIONS="frontend-team,backend-team,devops-team" \
SEARCH_STRING="old-service.internal" \
REPLACEMENT_STRING="new-service.internal" \
npm run github-search-replace
```
