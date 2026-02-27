import * as fs from 'fs/promises';
import * as path from 'path';
export async function findApiFiles(projectPath) {
    let files = [];
    // very basic matching 
    async function search(dir) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(item.name))
                    continue;
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await search(fullPath);
                }
                else {
                    const name = item.name.toLowerCase();
                    if ((name.includes('api') || fullPath.includes('routes') || fullPath.includes('controllers') || fullPath.includes('endpoints')) &&
                        (name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.py'))) {
                        files.push(fullPath);
                    }
                    if (name.includes('openapi') || name.includes('swagger')) {
                        files.push(fullPath);
                    }
                }
            }
        }
        catch { }
    }
    await search(projectPath);
    return files;
}
export async function checkOpenApiSpec(filePath) {
    const result = { file: filePath, passed: [], issues: [], type: 'openapi' };
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (filePath.endsWith('.json')) {
            const spec = JSON.parse(content);
            if (spec.openapi || spec.swagger)
                result.passed.push("[OK] OpenAPI version defined");
            if (spec.info?.title)
                result.passed.push("[OK] API title defined");
            if (spec.info?.version)
                result.passed.push("[OK] API version defined");
            if (!spec.info?.description)
                result.issues.push("[!] API description missing");
            if (spec.paths) {
                result.passed.push(`[OK] ${Object.keys(spec.paths).length} endpoints defined`);
                for (const [p, methods] of Object.entries(spec.paths)) {
                    for (const [method, details] of Object.entries(methods)) {
                        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
                            if (!details.responses)
                                result.issues.push(`[X] ${method.toUpperCase()} ${p}: No responses defined`);
                            if (!details.summary && !details.description)
                                result.issues.push(`[!] ${method.toUpperCase()} ${p}: No description`);
                        }
                    }
                }
            }
        }
        else {
            // Basic YAML
            if (content.includes('openapi:') || content.includes('swagger:'))
                result.passed.push("[OK] OpenAPI/Swagger version defined");
            else
                result.issues.push("[X] No OpenAPI version found");
            if (content.includes('paths:'))
                result.passed.push("[OK] Paths section exists");
            else
                result.issues.push("[X] No paths defined");
        }
    }
    catch (e) {
        result.issues.push(`[X] Parse error: ${e.message}`);
    }
    return result;
}
export async function checkApiCode(filePath) {
    const result = { file: filePath, passed: [], issues: [], type: 'code' };
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        // error handling
        if (/try\s*{|try:|\.catch\(|except\s+|catch\s*\(/.test(content))
            result.passed.push("[OK] Error handling present");
        else
            result.issues.push("[X] No error handling found");
        // status codes
        if (/status\s*\(\s*\d{3}\s*\)|statusCode\s*[=:]\s*\d{3}|HttpStatus\.|status_code\s*=\s*\d{3}/.test(content))
            result.passed.push("[OK] HTTP status codes used");
        else
            result.issues.push("[!] No explicit HTTP status codes");
        // validation
        if (/validate|schema|zod|joi|yup|pydantic|@Body\(|@Query\(/i.test(content))
            result.passed.push("[OK] Input validation present");
        else
            result.issues.push("[!] No input validation detected");
        // auth
        if (/auth|jwt|bearer|token|middleware|guard|@Authenticated/i.test(content))
            result.passed.push("[OK] Authentication/authorization detected");
    }
    catch (e) {
        result.issues.push(`[X] Read error: ${e.message}`);
    }
    return result;
}
export async function runApiValidator(projectPath = ".") {
    const root = path.resolve(projectPath);
    const files = await findApiFiles(root);
    let report = `============================================================\n`;
    report += `  API VALIDATOR - Endpoint Best Practices Check\n`;
    report += `============================================================\n`;
    if (files.length === 0) {
        return { passed: true, report: report + "[!] No API files found.\n" };
    }
    const results = [];
    for (const file of files.slice(0, 15)) {
        if (file.toLowerCase().includes('openapi') || file.toLowerCase().includes('swagger')) {
            results.push(await checkOpenApiSpec(file));
        }
        else {
            results.push(await checkApiCode(file));
        }
    }
    let totalIssues = 0, totalPassed = 0;
    for (const r of results) {
        report += `\n[FILE] ${path.basename(r.file)} [${r.type}]\n`;
        for (const p of r.passed) {
            report += `   ${p}\n`;
            totalPassed++;
        }
        for (const i of r.issues) {
            report += `   ${i}\n`;
            if (i.startsWith("[X]"))
                totalIssues++;
        }
    }
    report += `\n============================================================\n`;
    report += `[RESULTS] ${totalPassed} passed, ${totalIssues} critical issues\n`;
    return { passed: totalIssues === 0, report };
}
