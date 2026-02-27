import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMobileAudit } from '../mobileAudit.js';
import * as fs from 'fs/promises';
vi.mock('fs/promises');
describe('mobileAudit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should report warnings for generic rn file issues', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([{
                name: 'Screen.tsx',
                isDirectory: () => false
            }]);
        vi.mocked(fs.readFile).mockResolvedValue(`
            import React from 'react';
            import { View, ScrollView } from 'react-native';
            export const Screen = () => {
                return (
                    <ScrollView>
                       {data.map(d => <View key={index} />)}
                    </ScrollView>
                )
            }
        `);
        const res = await runMobileAudit('.');
        expect(res.passed).toBe(false);
        expect(res.report).toContain('ScrollView with .map()'); // critical performance
    });
    it('should ignore non react native / flutter files', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([{
                name: 'regular.tsx',
                isDirectory: () => false
            }]);
        vi.mocked(fs.readFile).mockResolvedValue(`
            export const App = () => <div>Hello Web</div>
        `);
        const res = await runMobileAudit('.');
        expect(res.passed).toBe(true);
    });
});
