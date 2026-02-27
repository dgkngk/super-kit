import * as fs from 'fs/promises';
import * as path from 'path';

export async function manageSession(command: 'status' | 'info', rootPath: string = '.'): Promise<string> {
    const root = path.resolve(rootPath);
    const pkgPath = path.join(root, 'package.json');

    const getPackageInfo = async () => {
        try {
            const data = await fs.readFile(pkgPath, 'utf8');
            const pkg = JSON.parse(data);
            const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            const stack: string[] = [];

            if (allDeps['next']) stack.push("Next.js");
            else if (allDeps['react']) stack.push("React");
            else if (allDeps['vue']) stack.push("Vue");
            else if (allDeps['svelte']) stack.push("Svelte");
            else if (allDeps['express']) stack.push("Express");
            else if (allDeps['nestjs'] || allDeps['@nestjs/core']) stack.push("NestJS");

            if (allDeps['tailwindcss']) stack.push("Tailwind CSS");
            if (allDeps['prisma']) stack.push("Prisma");
            if (allDeps['typescript']) stack.push("TypeScript");

            return {
                name: pkg.name || 'unnamed',
                version: pkg.version || '0.0.0',
                stack,
                scripts: Object.keys(pkg.scripts || {})
            };
        } catch (e: any) {
            return { name: root.split(path.sep).pop() || 'unnamed', version: '0.0.0', stack: ['Generic'], scripts: [] };
        }
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
        output += `📊 Status: Active\n\n`;

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
