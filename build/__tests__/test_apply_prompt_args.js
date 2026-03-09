import { describe, it, expect } from 'vitest';
import { apply_prompt_args } from '../index.js';
describe('apply_prompt_args', () => {
    describe('{{args}} substitution', () => {
        it('should replace {{args}} with the provided user args', () => {
            const result = apply_prompt_args('Task: {{args}}', 'Add user authentication');
            expect(result).toBe('Task: Add user authentication');
        });
        it('should replace all occurrences of {{args}}', () => {
            const result = apply_prompt_args('{{args}} and also {{args}}', 'hello');
            expect(result).toBe('hello and also hello');
        });
        it('should replace {{args}} with an empty string when no args are provided', () => {
            const result = apply_prompt_args('Task: {{args}}', '');
            expect(result).toBe('Task: ');
        });
        it('should replace {{args}} with an empty string when args is only whitespace', () => {
            const result = apply_prompt_args('Task: {{args}}', '   ');
            expect(result).toBe('Task:    ');
        });
    });
    describe('{{#if args}} ... {{/if}} block (no else branch)', () => {
        it('should include the block content when args is provided', () => {
            const template = '{{#if args}}Task: {{args}}{{/if}}';
            const result = apply_prompt_args(template, 'Fix bug');
            expect(result).toBe('Task: Fix bug');
        });
        it('should remove the block entirely when args is empty', () => {
            const template = 'Before\n{{#if args}}Task: {{args}}{{/if}}\nAfter';
            const result = apply_prompt_args(template, '');
            expect(result).toBe('Before\n\nAfter');
        });
        it('should remove the block entirely when args is only whitespace', () => {
            const template = '{{#if args}}Task: {{args}}{{/if}}';
            const result = apply_prompt_args(template, '   ');
            expect(result).toBe('');
        });
        it('should handle multiline block content', () => {
            const template = '{{#if args}}\n# Task\n**Input:** {{args}}\n{{/if}}';
            const result = apply_prompt_args(template, 'Do something');
            expect(result).toBe('\n# Task\n**Input:** Do something\n');
        });
    });
    describe('{{#if args}} ... {{else}} ... {{/if}} block', () => {
        it('should render the if-block when args is provided', () => {
            const template = '{{#if args}}Task: {{args}}{{else}}No task provided.{{/if}}';
            const result = apply_prompt_args(template, 'Add login');
            expect(result).toBe('Task: Add login');
        });
        it('should render the else-block when args is empty', () => {
            const template = '{{#if args}}Task: {{args}}{{else}}No task provided.{{/if}}';
            const result = apply_prompt_args(template, '');
            expect(result).toBe('No task provided.');
        });
        it('should render the else-block when args is only whitespace', () => {
            const template = '{{#if args}}Task: {{args}}{{else}}No task provided.{{/if}}';
            const result = apply_prompt_args(template, '   ');
            expect(result).toBe('No task provided.');
        });
        it('should handle multiline if and else blocks', () => {
            const template = [
                '{{#if args}}',
                '# Running: {{args}}',
                'Execute the task above.',
                '{{else}}',
                '# Usage',
                'Provide a task to run.',
                '{{/if}}',
            ].join('\n');
            const with_args = apply_prompt_args(template, 'Build the feature');
            expect(with_args).toContain('# Running: Build the feature');
            expect(with_args).not.toContain('# Usage');
            const without_args = apply_prompt_args(template, '');
            expect(without_args).toContain('# Usage');
            expect(without_args).not.toContain('# Running:');
        });
    });
    describe('edge cases', () => {
        it('should return the template unchanged when it has no placeholders', () => {
            const template = '# Plan\nThis is a static template.';
            const result = apply_prompt_args(template, 'some args');
            expect(result).toBe(template);
        });
        it('should handle a template with both {{args}} and {{#if args}} blocks', () => {
            const template = [
                '{{#if args}}',
                '**Task:** {{args}}',
                '{{else}}',
                '**Task:** (none)',
                '{{/if}}',
                '',
                'Details: {{args}}',
            ].join('\n');
            const result = apply_prompt_args(template, 'Refactor auth');
            expect(result).toContain('**Task:** Refactor auth');
            expect(result).toContain('Details: Refactor auth');
            expect(result).not.toContain('(none)');
        });
        it('should handle empty template string', () => {
            const result = apply_prompt_args('', 'some args');
            expect(result).toBe('');
        });
    });
});
