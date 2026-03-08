import * as fs from 'fs/promises';
import * as path from 'path';

export async function manageSession(command: 'status' | 'info', rootPath: string = '.'): Promise<string> {
    const root = path.resolve(rootPath);
    const pkgPath = path.join(root, 'package.json');

    const getPackageInfo = async () => {
        let name = root.split(path.sep).pop() || 'unnamed';
        let version = '0.0.0';
        const stack: string[] = [];
        let scripts: string[] = [];

        // 1. Node.js Check
        try {
            const data = await fs.readFile(pkgPath, 'utf8');
            const pkg = JSON.parse(data);
            name = pkg.name || name;
            version = pkg.version || version;
            scripts = Object.keys(pkg.scripts || {});

            const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

            if (allDeps['next']) stack.push("Next.js");
            else if (allDeps['react']) stack.push("React");
            else if (allDeps['vue']) stack.push("Vue");
            else if (allDeps['svelte']) stack.push("Svelte");
            else if (allDeps['express']) stack.push("Express");
            else if (allDeps['nestjs'] || allDeps['@nestjs/core']) stack.push("NestJS");

            if (allDeps['tailwindcss']) stack.push("Tailwind CSS");
            if (allDeps['prisma']) stack.push("Prisma");
            if (allDeps['typescript']) stack.push("TypeScript");

            if (stack.length === 0) stack.push("Node.js");
        } catch { }

        // 2. Polyglot Checks
        try {
            const files = await fs.readdir(root);

            // Python
            if (files.includes('requirements.txt') || files.includes('Pipfile') || files.includes('pyproject.toml')) {
                if (!stack.includes("Python")) stack.push("Python");
                if (files.includes('manage.py')) stack.push("Django");
                if (files.includes('requirements.txt')) {
                    const content = await fs.readFile(path.join(root, 'requirements.txt'), 'utf8');
                    if (content.includes('flask')) stack.push("Flask");
                    if (content.includes('fastapi')) stack.push("FastAPI");
                    if (content.includes('django') && !stack.includes("Django")) stack.push("Django");
                }
            }

            // Go
            if (files.includes('go.mod')) stack.push("Go");

            // Rust
            if (files.includes('Cargo.toml')) stack.push("Rust");

            // Java / Kotlin
            if (files.includes('pom.xml')) stack.push("Java (Maven)");
            if (files.includes('build.gradle') || files.includes('build.gradle.kts')) stack.push("Java/Kotlin (Gradle)");

            // PHP
            if (files.includes('composer.json')) {
                if (!stack.includes("PHP")) stack.push("PHP");
                try {
                    const composer = JSON.parse(await fs.readFile(path.join(root, 'composer.json'), 'utf8'));
                    const deps = { ...(composer.require || {}), ...(composer['require-dev'] || {}) };
                    if (deps['laravel/framework']) stack.push("Laravel");
                    if (deps['symfony/framework-bundle']) stack.push("Symfony");
                } catch { }
            }

            // Infrastructure
            if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) stack.push("Docker");
            if (files.some(f => f.endsWith('.tf'))) stack.push("Terraform");

        } catch { }

        if (stack.length === 0) stack.push("Generic");

        return {
            name,
            version,
            stack: Array.from(new Set(stack)),
            scripts
        };
    };

    const countFiles = async (dir: string): Promise<number> => {
        let count = 0;
        const exclude = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.agent', '.gemini', '__pycache__']);
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (exclude.has(item.name)) continue;
                if (item.isDirectory()) {
                    count += await countFiles(path.join(dir, item.name));
                } else {
                    count++;
                }
            }
        } catch { }
        return count;
    };

    const detectFeatures = async (): Promise<string[]> => {
        const features: string[] = [];
        const srcPath = path.join(root, 'src');
        const possibleDirs = ["components", "modules", "features", "app", "pages", "services"];

        try {
            const srcExists = await fs.stat(srcPath).then(s => s.isDirectory()).catch(() => false);
            if (srcExists) {
                for (const d of possibleDirs) {
                    const p = path.join(srcPath, d);
                    const pExists = await fs.stat(p).then(s => s.isDirectory()).catch(() => false);
                    if (pExists) {
                        const children = await fs.readdir(p, { withFileTypes: true });
                        for (const child of children) {
                            if (child.isDirectory()) features.push(child.name);
                        }
                    }
                }
            }
        } catch { }
        return features.slice(0, 10);
    };

    const info = await getPackageInfo();

    if (command === 'info') {
        return JSON.stringify(info, null, 2);
    }

    if (command === 'status') {
        const fileCount = await countFiles(root);
        const features = await detectFeatures();

        let output = `=== Project Status ===\n\n`;
        output += `📁 Project: ${info.name}\n`;
        output += `📂 Path: ${root}\n`;
        output += `🏷️  Type: ${info.stack.join(', ')}\n`;

        // Check for active todos to determine status
        let status = 'Idle';
        try {
            const todos = await fs.readdir(path.join(root, 'todos'));
            const hasActive = todos.some(f => f.endsWith('.md') && !f.includes('template') && !f.includes('archive'));
            if (hasActive) status = 'Active';
        } catch { }

        output += `📊 Status: ${status}\n\n`;

        output += `🔧 Tech Stack:\n`;
        for (const tech of info.stack) output += `   • ${tech}\n`;

        output += `\n✅ Detected Modules/Features (${features.length}):\n`;
        if (features.length === 0) output += `   (No distinct feature modules detected)\n`;
        for (const feat of features) output += `   • ${feat}\n`;

        output += `\n📄 Files: ${fileCount} total files tracked\n`;
        return output;
    }

    return "❌ Invalid command";
}
