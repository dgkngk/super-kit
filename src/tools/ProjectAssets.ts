import * as fs from 'fs/promises';
import * as path from 'path';

// The conventional folder name for project-local Super-Kit assets
export const PROJECT_ASSETS_DIR = '.agents';

/**
 * Resolves the effective project root path.
 * - If an explicit projectPath is provided, it is resolved to an absolute path.
 * - Otherwise, falls back to process.cwd().
 */
export function resolve_project_path(projectPath?: string): string {
  if (projectPath) {
    return path.resolve(projectPath);
  }
  return process.cwd();
}

/**
 * Returns the absolute path to the .agents/ root for the given project.
 */
export function get_project_agents_root(projectPath?: string): string {
  return path.join(resolve_project_path(projectPath), PROJECT_ASSETS_DIR);
}

/**
 * Internal guard: ensures the resolved path stays strictly within the .agents/ root.
 * Returns the resolved absolute path, or null if a traversal attempt is detected.
 */
function safe_project_path(agentsRoot: string, relative: string): string | null {
  // Normalize the root so the startsWith check is reliable on all platforms
  const normalizedRoot = path.resolve(agentsRoot);
  const resolved = path.resolve(agentsRoot, relative);
  // On Windows path.resolve produces lower-cased drive letters consistently,
  // so this comparison is safe cross-platform.
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    return null; // traversal detected
  }
  return resolved;
}

/**
 * Validates a user-supplied asset name (agentName, skillName, workflowName).
 * Rejects absolute paths and anything containing path-separator characters.
 */
function validate_asset_name(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Asset name must be a non-empty string.');
  }
  if (path.isAbsolute(name)) {
    throw new Error(`Asset name must not be an absolute path: "${name}"`);
  }
  // Reject any component that contains a path separator or navigates upward
  const normalized = path.normalize(name);
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('\\')) {
    throw new Error(`Asset name contains invalid path components: "${name}"`);
  }
}

// ---------------------------------------------------------------------------
// Listing helpers
// ---------------------------------------------------------------------------

/**
 * Lists project-scoped agent names (without .md extension) from .agents/agents/.
 * Returns an empty array if the directory does not exist.
 */
export async function list_project_agents(projectPath?: string): Promise<string[]> {
  const agentsRoot = get_project_agents_root(projectPath);
  const agentsDir = path.join(agentsRoot, 'agents');

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name.replace(/\.md$/, ''));
  } catch {
    // Directory does not exist — graceful degradation
    return [];
  }
}

/**
 * Lists project-scoped skill directory names from .agents/skills/tech/ and .agents/skills/meta/.
 * Returns empty arrays for each category if the directories do not exist.
 */
export async function list_project_skills(
  projectPath?: string,
): Promise<{ tech: string[]; meta: string[] }> {
  const agentsRoot = get_project_agents_root(projectPath);

  const list_category_skills = async (category: string): Promise<string[]> => {
    const categoryDir = path.join(agentsRoot, 'skills', category);
    try {
      const entries = await fs.readdir(categoryDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  };

  const [tech, meta] = await Promise.all([
    list_category_skills('tech'),
    list_category_skills('meta'),
  ]);

  return { tech, meta };
}

/**
 * Lists project-scoped workflow names (without .md extension) from .agents/workflows/.
 * Returns an empty array if the directory does not exist.
 */
export async function list_project_workflows(projectPath?: string): Promise<string[]> {
  const agentsRoot = get_project_agents_root(projectPath);
  const workflowsDir = path.join(agentsRoot, 'workflows');

  try {
    const entries = await fs.readdir(workflowsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Loading helpers
// ---------------------------------------------------------------------------

/**
 * Loads a project-scoped agent's markdown content from:
 *   {projectPath}/.agents/agents/{agentName}.md
 */
export async function load_project_agent_file(
  agentName: string,
  projectPath?: string,
): Promise<string> {
  validate_asset_name(agentName);

  const agentsRoot = get_project_agents_root(projectPath);
  const relative = path.join('agents', `${agentName}.md`);
  const safePath = safe_project_path(agentsRoot, relative);

  if (!safePath) {
    throw new Error(`Path traversal detected for agent name: "${agentName}"`);
  }

  try {
    return await fs.readFile(safePath, 'utf-8');
  } catch {
    throw new Error(
      `Project agent not found: "${agentName}". ` +
        `Expected file at: ${safePath}`,
    );
  }
}

/**
 * Loads a project-scoped skill's SKILL.md content from:
 *   {projectPath}/.agents/skills/{category}/{skillName}/SKILL.md
 */
export async function load_project_skill_file(
  category: string,
  skillName: string,
  projectPath?: string,
): Promise<string> {
  validate_asset_name(category);
  validate_asset_name(skillName);

  const agentsRoot = get_project_agents_root(projectPath);
  const relative = path.join('skills', category, skillName, 'SKILL.md');
  const safePath = safe_project_path(agentsRoot, relative);

  if (!safePath) {
    throw new Error(
      `Path traversal detected for skill: category="${category}", skillName="${skillName}"`,
    );
  }

  try {
    return await fs.readFile(safePath, 'utf-8');
  } catch {
    throw new Error(
      `Project skill not found: category="${category}", skillName="${skillName}". ` +
        `Expected SKILL.md at: ${safePath}`,
    );
  }
}

/**
 * Loads a project-scoped workflow's markdown content from:
 *   {projectPath}/.agents/workflows/{workflowName}.md
 */
export async function load_project_workflow_file(
  workflowName: string,
  projectPath?: string,
): Promise<string> {
  validate_asset_name(workflowName);

  const agentsRoot = get_project_agents_root(projectPath);
  const relative = path.join('workflows', `${workflowName}.md`);
  const safePath = safe_project_path(agentsRoot, relative);

  if (!safePath) {
    throw new Error(`Path traversal detected for workflow name: "${workflowName}"`);
  }

  try {
    return await fs.readFile(safePath, 'utf-8');
  } catch {
    throw new Error(
      `Project workflow not found: "${workflowName}". ` +
        `Expected file at: ${safePath}`,
    );
  }
}
