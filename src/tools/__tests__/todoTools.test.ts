import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTodo, startTodo, doneTodo, completeTodo, getNextTodoId } from '../todoTools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Todo Tools', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should calculate next todo ID correctly', async () => {
        const id1 = await getNextTodoId(tempDir);
        expect(id1).toBe('001');

        await fs.mkdir(path.join(tempDir, 'todos'), { recursive: true });
        await fs.writeFile(path.join(tempDir, 'todos', '005-pending-p2-test.md'), 'test');

        const id2 = await getNextTodoId(tempDir);
        expect(id2).toBe('006');
    });

    it('should create a new todo file', async () => {
        const result = await createTodo('p2', 'Fix Bug', 'The bug is terrible', ['Check 1', 'Check 2'], tempDir);

        expect(result).toContain('001-pending-p2-fix-bug');

        const files = await fs.readdir(path.join(tempDir, 'todos'));
        expect(files).toContain('001-pending-p2-fix-bug.md');

        const content = await fs.readFile(path.join(tempDir, 'todos', '001-pending-p2-fix-bug.md'), 'utf-8');
        expect(content).toContain('status: pending');
        expect(content).toContain('priority: p2');
        expect(content).toContain('- [ ] Check 1');
    });

    it('should start a todo file', async () => {
        await createTodo('p2', 'Fix Bug', 'The bug is terrible', ['Check 1'], tempDir);
        const todoFile = path.join('todos', '001-pending-p2-fix-bug.md');

        const result = await startTodo(todoFile, false, tempDir);
        expect(result).toContain('001-in-progress-p2-fix-bug.md');

        const newPath = path.join(tempDir, 'todos', '001-in-progress-p2-fix-bug.md');
        const content = await fs.readFile(newPath, 'utf-8');
        expect(content).toContain('status: in-progress');
    });

    it('should fail to done a todo if unchecked items exist', async () => {
        await createTodo('p2', 'Fix Bug', 'The bug is terrible', ['Check 1'], tempDir);
        // It's still pending so its name has pending
        const todoFile = path.join('todos', '001-pending-p2-fix-bug.md');

        await expect(doneTodo(todoFile, false, tempDir)).rejects.toThrow(/Unchecked items found/);
    });

    it('should done a todo if force is true with unchecked items', async () => {
        await createTodo('p2', 'Fix Bug', 'The bug is terrible', ['Check 1'], tempDir);
        const todoFile = path.join('todos', '001-pending-p2-fix-bug.md');

        const result = await doneTodo(todoFile, true, tempDir);
        expect(result).toContain('001-done-p2-fix-bug.md');
    });

    it('should done a todo if all items are checked', async () => {
        await createTodo('p2', 'Fix Bug', '', ['Check 1'], tempDir);
        const todoFile = path.normalize(path.join(tempDir, 'todos', '001-pending-p2-fix-bug.md'));

        let content = await fs.readFile(todoFile, 'utf-8');
        content = content.replace('- [ ] Check 1', '- [x] Check 1');
        await fs.writeFile(todoFile, content);

        const result = await doneTodo(path.join('todos', '001-pending-p2-fix-bug.md'), false, tempDir);
        expect(result).toContain('001-done-p2-fix-bug.md');

        const newPath = path.join(tempDir, 'todos', '001-done-p2-fix-bug.md');
        const newContent = await fs.readFile(newPath, 'utf-8');
        expect(newContent).toContain('status: done');
    });

    it('should reject startTodo if in terminal state without force', async () => {
        await createTodo('p2', 'Fix Bug', '', [], tempDir);
        const todoFile = path.normalize(path.join(tempDir, 'todos', '001-pending-p2-fix-bug.md'));
        let content = await fs.readFile(todoFile, 'utf-8');
        content = content.replace('status: pending', 'status: done');
        await fs.writeFile(todoFile, content);

        await expect(startTodo(path.join('todos', '001-pending-p2-fix-bug.md'), false, tempDir)).rejects.toThrow(/terminal state/);
    });
});
