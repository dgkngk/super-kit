import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import * as os from 'os';
const execAsync = promisify(exec);
export async function runLighthouseAudit(url) {
    const tempFilePath = path.join(os.tmpdir(), `lighthouse-${Date.now()}.json`);
    let report = `============================================================\n`;
    report += `LIGHTHOUSE AUDIT REPORT for ${url}\n`;
    report += `============================================================\n`;
    try {
        await execAsync(`lighthouse "${url}" --output=json --output-path="${tempFilePath}" --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices,seo`);
    }
    catch (error) {
        // Lighthouse sometimes exits with code 1 even when the report is valid generated
        // We will proceed to check if the file was created
    }
    try {
        const fileContent = await fs.readFile(tempFilePath, 'utf-8');
        const data = JSON.parse(fileContent);
        await fs.unlink(tempFilePath).catch(() => { }); // cleanup
        const categories = data.categories || {};
        const performance = Math.round((categories.performance?.score || 0) * 100);
        const accessibility = Math.round((categories.accessibility?.score || 0) * 100);
        const bestPractices = Math.round((categories['best-practices']?.score || 0) * 100);
        const seo = Math.round((categories.seo?.score || 0) * 100);
        report += `Performance: ${performance}/100\n`;
        report += `Accessibility: ${accessibility}/100\n`;
        report += `Best Practices: ${bestPractices}/100\n`;
        report += `SEO: ${seo}/100\n\n`;
        // Using average for pass/fail logic
        const avg = (performance + accessibility + bestPractices + seo) / 4;
        if (performance >= 90) {
            report += `[OK] Excellent performance\n`;
        }
        else if (performance >= 50) {
            report += `[!] Needs improvement\n`;
        }
        else {
            report += `[X] Poor performance\n`;
        }
        return { passed: avg >= 80, report };
    }
    catch (e) {
        report += `[ERROR] Failed to read or parse Lighthouse report: ${e.message}\n`;
        report += `Ensure Lighthouse CLI is installed globally (npm install -g lighthouse).\n`;
        return { passed: false, report };
    }
}
