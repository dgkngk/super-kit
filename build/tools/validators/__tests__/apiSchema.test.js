import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePrismaSchema } from '../schemaValidator.js';
import { checkApiCode, checkOpenApiSpec } from '../apiValidator.js';
import * as fs from 'fs/promises';
vi.mock('fs/promises');
describe('schemaValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('validatePrismaSchema', () => {
        it('should detect bad model names and missing fields', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                 model user {
                     name String
                 }
                 model Post {
                     id String @id
                     userId String
                     createdAt DateTime
                 }
                 enum role { ADMIN, USER }
             `);
            const issues = await validatePrismaSchema('/mock.prisma');
            expect(issues.some(i => i.includes("Model 'user' should be PascalCase"))).toBe(true);
            expect(issues.some(i => i.includes("Enum 'role' should be PascalCase"))).toBe(true);
            expect(issues.some(i => i.includes("missing createdAt"))).toBe(true); // for user
            expect(issues.some(i => i.includes("adding @@index([userId])"))).toBe(true); // for Post
        });
    });
});
describe('apiValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('checkOpenApiSpec', () => {
        it('should validate openapi json', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                openapi: "3.0.0",
                info: { title: "Test", version: "1" },
                paths: {
                    "/test": { get: { responses: { 200: {} }, description: "desc" } }
                }
            }));
            const res = await checkOpenApiSpec('api.json');
            expect(res.issues.length).toBe(0);
        });
    });
    describe('checkApiCode', () => {
        it('should detect missing api practices', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                 function handler() {
                     // no try, no status, no auth
                     return "hello";
                 }
             `);
            const res = await checkApiCode('route.ts');
            expect(res.issues.some(i => i.includes('No error handling'))).toBe(true);
            expect(res.issues.some(i => i.includes('No explicit HTTP status'))).toBe(true);
            expect(res.passed.length).toBe(0);
        });
        it('should pass good practices', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                 import { z } from 'zod';
                 function handler(req, res) {
                     try {
                         const jwtToken = "123";
                         return res.status(200).send("hello");
                     } catch(e) {}
                 }
             `);
            const res = await checkApiCode('route.ts');
            expect(res.passed.some(i => i.includes('Error handling'))).toBe(true);
            expect(res.passed.some(i => i.includes('validation present'))).toBe(true);
            expect(res.passed.some(i => i.includes('status codes used'))).toBe(true);
        });
    });
});
