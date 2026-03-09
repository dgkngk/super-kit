import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { resolve_project_path, get_project_agents_root, list_project_agents, list_project_skills, list_project_workflows, load_project_agent_file, load_project_skill_file, load_project_workflow_file, PROJECT_ASSETS_DIR, } from '../ProjectAssets.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function create_agent_file(agents_dir, name, content = `# ${name}`) {
    await fs.mkdir(agents_dir, { recursive: true });
    await fs.writeFile(path.join(agents_dir, `${name}.md`), content, 'utf-8');
}
async function create_skill_file(skills_dir, category, skill_name, content = `# ${skill_name} SKILL`) {
    const skill_dir = path.join(skills_dir, category, skill_name);
    await fs.mkdir(skill_dir, { recursive: true });
    await fs.writeFile(path.join(skill_dir, 'SKILL.md'), content, 'utf-8');
}
async function create_workflow_file(workflows_dir, name, content = `# ${name}`) {
    await fs.mkdir(workflows_dir, { recursive: true });
    await fs.writeFile(path.join(workflows_dir, `${name}.md`), content, 'utf-8');
}
// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('ProjectAssets', () => {
    let temp_dir;
    let agents_root;
    let agents_dir;
    let skills_dir;
    let workflows_dir;
    beforeEach(async () => {
        temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-assets-test-'));
        agents_root = path.join(temp_dir, PROJECT_ASSETS_DIR);
        agents_dir = path.join(agents_root, 'agents');
        skills_dir = path.join(agents_root, 'skills');
        workflows_dir = path.join(agents_root, 'workflows');
    });
    afterEach(async () => {
        await fs.rm(temp_dir, { recursive: true, force: true });
    });
    // -------------------------------------------------------------------------
    // resolve_project_path
    // -------------------------------------------------------------------------
    describe('resolve_project_path', () => {
        it('returns the provided projectPath resolved to absolute', () => {
            const result = resolve_project_path(temp_dir);
            expect(result).toBe(path.resolve(temp_dir));
        });
        it('returns process.cwd() when no projectPath is provided', () => {
            const result = resolve_project_path();
            expect(result).toBe(process.cwd());
        });
        it('returns process.cwd() when projectPath is undefined', () => {
            const result = resolve_project_path(undefined);
            expect(result).toBe(process.cwd());
        });
        it('resolves a relative path to an absolute path', () => {
            const result = resolve_project_path('some/relative/path');
            expect(path.isAbsolute(result)).toBe(true);
        });
    });
    // -------------------------------------------------------------------------
    // get_project_agents_root
    // -------------------------------------------------------------------------
    describe('get_project_agents_root', () => {
        it('returns {projectPath}/.agents when projectPath is given', () => {
            const result = get_project_agents_root(temp_dir);
            expect(result).toBe(path.join(path.resolve(temp_dir), PROJECT_ASSETS_DIR));
        });
        it('returns {cwd}/.agents when no projectPath is provided', () => {
            const result = get_project_agents_root();
            expect(result).toBe(path.join(process.cwd(), PROJECT_ASSETS_DIR));
        });
    });
    // -------------------------------------------------------------------------
    // list_project_agents
    // -------------------------------------------------------------------------
    describe('list_project_agents', () => {
        it('returns an empty array when .agents/agents/ does not exist', async () => {
            const result = await list_project_agents(temp_dir);
            expect(result).toEqual([]);
        });
        it('returns agent names without .md extension', async () => {
            await create_agent_file(agents_dir, 'my-agent');
            await create_agent_file(agents_dir, 'another-agent');
            const result = await list_project_agents(temp_dir);
            expect(result.sort()).toEqual(['another-agent', 'my-agent']);
        });
        it('ignores non-.md files in agents directory', async () => {
            await fs.mkdir(agents_dir, { recursive: true });
            await fs.writeFile(path.join(agents_dir, 'my-agent.md'), '# agent', 'utf-8');
            await fs.writeFile(path.join(agents_dir, 'readme.txt'), 'ignore me', 'utf-8');
            await fs.writeFile(path.join(agents_dir, 'config.json'), '{}', 'utf-8');
            const result = await list_project_agents(temp_dir);
            expect(result).toEqual(['my-agent']);
        });
        it('ignores subdirectories inside agents/', async () => {
            await fs.mkdir(agents_dir, { recursive: true });
            await create_agent_file(agents_dir, 'real-agent');
            await fs.mkdir(path.join(agents_dir, 'subdir'), { recursive: true });
            const result = await list_project_agents(temp_dir);
            expect(result).toEqual(['real-agent']);
        });
        it('returns an empty array when agents/ directory is empty', async () => {
            await fs.mkdir(agents_dir, { recursive: true });
            const result = await list_project_agents(temp_dir);
            expect(result).toEqual([]);
        });
    });
    // -------------------------------------------------------------------------
    // list_project_skills
    // -------------------------------------------------------------------------
    describe('list_project_skills', () => {
        it('returns empty tech and meta arrays when .agents/skills/ does not exist', async () => {
            const result = await list_project_skills(temp_dir);
            expect(result).toEqual({ tech: [], meta: [] });
        });
        it('returns tech skill directory names', async () => {
            await create_skill_file(skills_dir, 'tech', 'react-patterns');
            await create_skill_file(skills_dir, 'tech', 'node-expert');
            const result = await list_project_skills(temp_dir);
            expect(result.tech.sort()).toEqual(['node-expert', 'react-patterns']);
            expect(result.meta).toEqual([]);
        });
        it('returns meta skill directory names', async () => {
            await create_skill_file(skills_dir, 'meta', 'session-resume');
            const result = await list_project_skills(temp_dir);
            expect(result.meta).toEqual(['session-resume']);
            expect(result.tech).toEqual([]);
        });
        it('returns both tech and meta skills independently', async () => {
            await create_skill_file(skills_dir, 'tech', 'docker-expert');
            await create_skill_file(skills_dir, 'meta', 'compound-docs');
            const result = await list_project_skills(temp_dir);
            expect(result.tech).toEqual(['docker-expert']);
            expect(result.meta).toEqual(['compound-docs']);
        });
        it('returns only directories (ignores files in skills/tech/ or skills/meta/)', async () => {
            await fs.mkdir(path.join(skills_dir, 'tech'), { recursive: true });
            await fs.mkdir(path.join(skills_dir, 'tech', 'real-skill'), { recursive: true });
            await fs.writeFile(path.join(skills_dir, 'tech', 'stray-file.md'), '# stray', 'utf-8');
            const result = await list_project_skills(temp_dir);
            expect(result.tech).toEqual(['real-skill']);
        });
        it('returns empty arrays when skills/tech/ and skills/meta/ are both empty', async () => {
            await fs.mkdir(path.join(skills_dir, 'tech'), { recursive: true });
            await fs.mkdir(path.join(skills_dir, 'meta'), { recursive: true });
            const result = await list_project_skills(temp_dir);
            expect(result).toEqual({ tech: [], meta: [] });
        });
    });
    // -------------------------------------------------------------------------
    // list_project_workflows
    // -------------------------------------------------------------------------
    describe('list_project_workflows', () => {
        it('returns an empty array when .agents/workflows/ does not exist', async () => {
            const result = await list_project_workflows(temp_dir);
            expect(result).toEqual([]);
        });
        it('returns workflow names without .md extension', async () => {
            await create_workflow_file(workflows_dir, 'deploy-staging');
            await create_workflow_file(workflows_dir, 'release');
            const result = await list_project_workflows(temp_dir);
            expect(result.sort()).toEqual(['deploy-staging', 'release']);
        });
        it('ignores non-.md files in workflows directory', async () => {
            await fs.mkdir(workflows_dir, { recursive: true });
            await fs.writeFile(path.join(workflows_dir, 'deploy.md'), '# deploy', 'utf-8');
            await fs.writeFile(path.join(workflows_dir, 'notes.txt'), 'ignore', 'utf-8');
            const result = await list_project_workflows(temp_dir);
            expect(result).toEqual(['deploy']);
        });
        it('returns an empty array when workflows/ directory is empty', async () => {
            await fs.mkdir(workflows_dir, { recursive: true });
            const result = await list_project_workflows(temp_dir);
            expect(result).toEqual([]);
        });
    });
    // -------------------------------------------------------------------------
    // load_project_agent_file
    // -------------------------------------------------------------------------
    describe('load_project_agent_file', () => {
        it('loads agent content from the correct path', async () => {
            const expected_content = '# My Custom Agent\n\nYou are a domain expert.';
            await create_agent_file(agents_dir, 'my-agent', expected_content);
            const result = await load_project_agent_file('my-agent', temp_dir);
            expect(result).toBe(expected_content);
        });
        it('throws a meaningful error when agent file does not exist', async () => {
            await expect(load_project_agent_file('nonexistent', temp_dir)).rejects.toThrow('Project agent not found: "nonexistent"');
        });
        it('rejects path traversal via ../ in agent name', async () => {
            await expect(load_project_agent_file('../../../etc/passwd', temp_dir)).rejects.toThrow(/invalid path components|traversal/i);
        });
        it('rejects an absolute path as agent name', async () => {
            await expect(load_project_agent_file('/etc/passwd', temp_dir)).rejects.toThrow(/absolute path|invalid/i);
        });
        it('throws when agentName is an empty string', async () => {
            await expect(load_project_agent_file('', temp_dir)).rejects.toThrow(/non-empty string/i);
        });
        it('loads correctly when projectPath is omitted (uses cwd as base)', async () => {
            // This test just verifies it does not throw due to missing projectPath arg.
            // The .agents/ folder won't exist in cwd during tests, so it should throw the
            // "not found" error — not a traversal or type error.
            await expect(load_project_agent_file('any-agent')).rejects.toThrow('Project agent not found: "any-agent"');
        });
    });
    // -------------------------------------------------------------------------
    // load_project_skill_file
    // -------------------------------------------------------------------------
    describe('load_project_skill_file', () => {
        it('loads SKILL.md content from the correct nested path', async () => {
            const expected_content = '# React Patterns\n\nUse hooks.';
            await create_skill_file(skills_dir, 'tech', 'react-patterns', expected_content);
            const result = await load_project_skill_file('tech', 'react-patterns', temp_dir);
            expect(result).toBe(expected_content);
        });
        it('throws a meaningful error when SKILL.md does not exist', async () => {
            await expect(load_project_skill_file('tech', 'nonexistent-skill', temp_dir)).rejects.toThrow('Project skill not found');
        });
        it('rejects path traversal in category', async () => {
            await expect(load_project_skill_file('../../etc', 'passwd', temp_dir)).rejects.toThrow(/invalid path components|traversal/i);
        });
        it('rejects path traversal in skillName', async () => {
            await expect(load_project_skill_file('tech', '../../../etc/passwd', temp_dir)).rejects.toThrow(/invalid path components|traversal/i);
        });
        it('rejects an absolute path as category', async () => {
            await expect(load_project_skill_file('/etc', 'passwd', temp_dir)).rejects.toThrow(/absolute path|invalid/i);
        });
        it('throws when category is an empty string', async () => {
            await expect(load_project_skill_file('', 'some-skill', temp_dir)).rejects.toThrow(/non-empty string/i);
        });
        it('throws when skillName is an empty string', async () => {
            await expect(load_project_skill_file('tech', '', temp_dir)).rejects.toThrow(/non-empty string/i);
        });
        it('supports meta category', async () => {
            const expected_content = '# Session Resume';
            await create_skill_file(skills_dir, 'meta', 'session-resume', expected_content);
            const result = await load_project_skill_file('meta', 'session-resume', temp_dir);
            expect(result).toBe(expected_content);
        });
    });
    // -------------------------------------------------------------------------
    // load_project_workflow_file
    // -------------------------------------------------------------------------
    describe('load_project_workflow_file', () => {
        it('loads workflow content from the correct path', async () => {
            const expected_content = '# Deploy to Staging\n\nRun these steps.';
            await create_workflow_file(workflows_dir, 'deploy-staging', expected_content);
            const result = await load_project_workflow_file('deploy-staging', temp_dir);
            expect(result).toBe(expected_content);
        });
        it('throws a meaningful error when workflow file does not exist', async () => {
            await expect(load_project_workflow_file('nonexistent-workflow', temp_dir)).rejects.toThrow('Project workflow not found: "nonexistent-workflow"');
        });
        it('rejects path traversal via ../ in workflow name', async () => {
            await expect(load_project_workflow_file('../../../etc/passwd', temp_dir)).rejects.toThrow(/invalid path components|traversal/i);
        });
        it('rejects an absolute path as workflow name', async () => {
            await expect(load_project_workflow_file('/etc/passwd', temp_dir)).rejects.toThrow(/absolute path|invalid/i);
        });
        it('throws when workflowName is an empty string', async () => {
            await expect(load_project_workflow_file('', temp_dir)).rejects.toThrow(/non-empty string/i);
        });
        it('loads correctly when projectPath is omitted', async () => {
            await expect(load_project_workflow_file('any-workflow')).rejects.toThrow('Project workflow not found: "any-workflow"');
        });
    });
    // -------------------------------------------------------------------------
    // Integration: full .agents/ folder scenario
    // -------------------------------------------------------------------------
    describe('full .agents/ folder scenario', () => {
        it('discovers all assets correctly from a populated .agents/ folder', async () => {
            await create_agent_file(agents_dir, 'domain-expert');
            await create_agent_file(agents_dir, 'data-wizard');
            await create_skill_file(skills_dir, 'tech', 'graphql-patterns');
            await create_skill_file(skills_dir, 'meta', 'onboarding');
            await create_workflow_file(workflows_dir, 'release-process');
            const [agents, skills, workflows] = await Promise.all([
                list_project_agents(temp_dir),
                list_project_skills(temp_dir),
                list_project_workflows(temp_dir),
            ]);
            expect(agents.sort()).toEqual(['data-wizard', 'domain-expert']);
            expect(skills.tech).toEqual(['graphql-patterns']);
            expect(skills.meta).toEqual(['onboarding']);
            expect(workflows).toEqual(['release-process']);
        });
        it('returns all-empty results when .agents/ does not exist at all', async () => {
            const [agents, skills, workflows] = await Promise.all([
                list_project_agents(temp_dir),
                list_project_skills(temp_dir),
                list_project_workflows(temp_dir),
            ]);
            expect(agents).toEqual([]);
            expect(skills).toEqual({ tech: [], meta: [] });
            expect(workflows).toEqual([]);
        });
    });
});
