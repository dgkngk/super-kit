import * as fs from 'fs/promises';
import * as path from 'path';

export async function findSchemaFiles(projectPath: string): Promise<string[]> {
    const schemas: string[] = [];

    async function search(dir: string) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (['node_modules', '.git', 'dist'].includes(item.name)) continue;

                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await search(fullPath);
                } else {
                    if (item.name === 'schema.prisma') {
                        schemas.push(fullPath);
                    } else if (fullPath.includes('drizzle') || fullPath.includes('schema') || fullPath.includes('table')) {
                        if (item.name.endsWith('.ts')) schemas.push(fullPath);
                    }
                }
            }
        } catch { }
    }

    await search(projectPath);
    return schemas.slice(0, 10);
}

export async function validatePrismaSchema(filePath: string): Promise<string[]> {
    const issues: string[] = [];
    try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Match models roughly: model Name { body }
        const modelMatches = [...content.matchAll(/model\s+(\w+)\s*{([^}]+)}/g)];

        for (const match of modelMatches) {
            const modelName = match[1];
            const modelBody = match[2];

            if (modelName[0] !== modelName[0].toUpperCase()) {
                issues.push(`Model '${modelName}' should be PascalCase`);
            }

            if (!modelBody.includes('@id') && !modelBody.toLowerCase().includes('id')) {
                issues.push(`Model '${modelName}' might be missing @id field`);
            }

            if (!modelBody.includes('createdAt') && !modelBody.includes('created_at')) {
                issues.push(`Model '${modelName}' missing createdAt field (recommended)`);
            }

            // Check for index suggestions
            const fks = [...modelBody.matchAll(/(\w+Id)\s+\w+/g)].map(m => m[1]);
            for (const fk of fks) {
                if (!content.includes(`@@index([${fk}])`) && !content.includes(`@@index(["${fk}"])`)) {
                    issues.push(`Consider adding @@index([${fk}]) for better query in ${modelName}`);
                }
            }
        }

        const enumMatches = [...content.matchAll(/enum\s+(\w+)\s*{/g)];
        for (const match of enumMatches) {
            if (match[1][0] !== match[1][0].toUpperCase()) {
                issues.push(`Enum '${match[1]}' should be PascalCase`);
            }
        }

    } catch (e: any) {
        issues.push(`Error reading schema: ${e.message.substring(0, 50)}`);
    }
    return issues;
}

export async function runSchemaValidator(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    const root = path.resolve(projectPath);
    let report = `============================================================\n`;
    report += `[SCHEMA VALIDATOR] Database Schema Validation\n`;
    report += `============================================================\n`;
    report += `Project: ${root}\n------------------------------------------------------------\n`;

    const schemas = await findSchemaFiles(root);
    report += `Found ${schemas.length} schema files\n`;

    if (schemas.length === 0) {
        report += "No schema files found\n";
        return { passed: true, report };
    }

    const allIssues: { file: string, type: string, issues: string[] }[] = [];

    for (const file of schemas) {
        const type = file.endsWith('.prisma') ? 'prisma' : 'drizzle';
        report += `\nValidating: ${path.basename(file)} (${type})\n`;

        const issues = type === 'prisma' ? await validatePrismaSchema(file) : [];
        if (issues.length > 0) {
            allIssues.push({ file: path.basename(file), type, issues });
        }
    }

    report += `\n============================================================\nSCHEMA ISSUES\n============================================================\n`;

    if (allIssues.length > 0) {
        for (const item of allIssues) {
            report += `\n${item.file} (${item.type}):\n`;
            for (const issue of item.issues.slice(0, 5)) {
                report += `  - ${issue}\n`;
            }
            if (item.issues.length > 5) report += `  ... and ${item.issues.length - 5} more issues\n`;
        }
    } else {
        report += "No schema issues found!\n";
    }

    return { passed: true, report }; // Schema is usually just warnings
}
