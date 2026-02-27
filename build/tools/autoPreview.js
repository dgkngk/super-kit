import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
const AGENT_DIR = path.resolve('.agent');
const PID_FILE = path.join(AGENT_DIR, 'preview.pid');
const LOG_FILE = path.join(AGENT_DIR, 'preview.log');
export async function manageAutoPreview(action, port = 3000) {
    const root = path.resolve('.');
    // Ensure .agent dir exists
    if (!existsSync(AGENT_DIR)) {
        await fs.mkdir(AGENT_DIR, { recursive: true });
    }
    const isRunning = (pid) => {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch (e) {
            return false;
        }
    };
    if (action === 'start') {
        if (existsSync(PID_FILE)) {
            const pid = parseInt(await fs.readFile(PID_FILE, 'utf-8'));
            if (isRunning(pid)) {
                return `⚠️ Preview already running (PID: ${pid})`;
            }
        }
        const pkgPath = path.join(root, 'package.json');
        if (!existsSync(pkgPath)) {
            return "❌ No package.json found";
        }
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
        const scripts = pkg.scripts || {};
        // npm sometimes behaves differently on Windows, using shell helps
        let cmd = '';
        let args = [];
        if (scripts['dev']) {
            cmd = 'npm';
            args = ['run', 'dev'];
        }
        else if (scripts['start']) {
            cmd = 'npm';
            args = ['start'];
        }
        else {
            return "❌ No 'dev' or 'start' script found in package.json";
        }
        const logStream = (await import('fs')).createWriteStream(LOG_FILE, { flags: 'w' });
        const child = spawn(cmd, args, {
            cwd: root,
            env: { ...process.env, PORT: port.toString() },
            shell: true,
            detached: true,
            stdio: ['ignore', logStream, logStream]
        });
        child.unref();
        await fs.writeFile(PID_FILE, child.pid.toString());
        return `✅ Preview started! (PID: ${child.pid})\n   Logs: ${LOG_FILE}\n   URL: http://localhost:${port}`;
    }
    if (action === 'stop') {
        if (!existsSync(PID_FILE)) {
            return "ℹ️ No preview server found.";
        }
        const pid = parseInt(await fs.readFile(PID_FILE, 'utf-8'));
        if (isRunning(pid)) {
            try {
                process.kill(pid, process.platform === 'win32' ? 'SIGINT' : 'SIGTERM');
                await fs.unlink(PID_FILE).catch(() => { });
                return `🛑 Preview stopped (PID: ${pid})`;
            }
            catch (e) {
                if (process.platform === 'win32') {
                    execSync(`taskkill /F /T /PID ${pid}`);
                    await fs.unlink(PID_FILE).catch(() => { });
                    return `🛑 Preview stopped via taskkill (PID: ${pid})`;
                }
                return `❌ Error stopping server: ${e.message}`;
            }
        }
        await fs.unlink(PID_FILE).catch(() => { });
        return "ℹ️ Process was not running, removed stale PID file.";
    }
    if (action === 'status') {
        let running = false;
        let pid = null;
        if (existsSync(PID_FILE)) {
            pid = parseInt(await fs.readFile(PID_FILE, 'utf-8'));
            if (isRunning(pid))
                running = true;
        }
        if (running) {
            return `✅ Status: Running\n🔢 PID: ${pid}\n🌐 URL: http://localhost:${port}\n📝 Logs: ${LOG_FILE}`;
        }
        return "⚪ Status: Stopped";
    }
    return "❌ Invalid action.";
}
