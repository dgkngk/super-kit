import * as fs from 'fs/promises';
import * as path from 'path';
class UXAuditor {
    issues = [];
    warnings = [];
    passed_count = 0;
    files_checked = 0;
    async auditFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            this.files_checked++;
            const filename = path.basename(filePath);
            const lowerC = content.toLowerCase();
            const hasLongText = /<p|<div.*class=.*text|article|<span.*text/i.test(content);
            const hasForm = /<form|<input|password|credit|card|payment/i.test(content);
            const complexElements = (content.match(/<input|<select|<textarea|<option/gi) || []).length;
            const navItems = (content.match(/<NavLink|<Link|<a\s+href|nav-item/gi) || []).length;
            if (navItems > 7)
                this.issues.push(`[Hick's Law] ${filename}: ${navItems} nav items (Max 7)`);
            if (/height:\s*([0-3]\d)px/.test(content) || /h-[1-9]\b|h-10\b/.test(content))
                this.warnings.push(`[Fitts' Law] ${filename}: Small targets (< 44px)`);
            if (complexElements > 7 && !/step|wizard|stage/i.test(content))
                this.warnings.push(`[Miller's Law] ${filename}: Complex form (${complexElements} fields)`);
            if (lowerC.includes('button') && !/primary|bg-primary|Button.*primary|variant=["']primary/i.test(content))
                this.warnings.push(`[Von Restorff] ${filename}: No primary CTA`);
            if (navItems > 3) {
                const navContent = [...content.matchAll(/<NavLink|<Link|<a\s+href[^>]*>([^<]+)<\/a>/gi)];
                if (navContent.length > 2) {
                    const last = navContent[navContent.length - 1][1].toLowerCase();
                    if (!['contact', 'login', 'sign', 'get started', 'cta', 'button'].some(x => last.includes(x))) {
                        this.warnings.push(`[Serial Position] ${filename}: Last nav item may not be important.`);
                    }
                }
            }
            const hasHero = /hero|<h1|banner/i.test(content);
            if (hasHero) {
                const hasVis = /gradient|linear-gradient|radial-gradient|@keyframes|transition:|animate-/.test(content);
                if (!hasVis && !/background:|bg-/.test(content)) {
                    this.warnings.push(`[Visceral] ${filename}: Hero section lacks visual appeal.`);
                }
            }
            if (/onClick|@click|onclick/i.test(content)) {
                if (!/transition|animate|hover:|focus:|disabled|loading|spinner|setState|useState/i.test(content)) {
                    this.warnings.push(`[Behavioral] ${filename}: Interactive elements lack immediate feedback.`);
                }
            }
            if (hasLongText && !/about|story|mission|values|why we|our journey|testimonials/i.test(content)) {
                this.warnings.push(`[Reflective] ${filename}: Long-form content without brand story/values.`);
            }
            if (hasForm) {
                if (!/ssl|secure|encrypt|lock|padlock|https/i.test(content) && !/checkout|payment/i.test(content)) {
                    this.warnings.push(`[Trust] ${filename}: Form without security indicators.`);
                }
                if (!/<label|placeholder|aria-label/i.test(content)) {
                    this.issues.push(`[Cognitive Load] ${filename}: Form inputs without labels.`);
                }
                const radioInputs = (content.match(/type=["']radio/gi) || []).length;
                if (radioInputs > 0 && !/checked|selected|default|value=["'].*["']/i.test(content)) {
                    this.warnings.push(`[Persuasion] ${filename}: Radio buttons without default selection.`);
                }
            }
            const socialProof = content.match(/review|testimonial|rating|star|trust|trusted by|customer|logo/gi) || [];
            if (socialProof.length > 0)
                this.passed_count++;
            else if (hasLongText)
                this.warnings.push(`[Trust] ${filename}: No social proof detected.`);
            if (/footer|<footer/i.test(content) && !/certif|award|media|press|featured|as seen in/i.test(content)) {
                this.warnings.push(`[Trust] ${filename}: Footer lacks authority signals.`);
            }
            if (complexElements > 5 && !/step|wizard|stage|accordion|collapsible|tab|more\.\.\.|advanced|show more/i.test(content)) {
                this.warnings.push(`[Cognitive Load] ${filename}: Many form elements without progressive disclosure.`);
            }
            const manyColors = (content.match(/#[0-9a-fA-F]{3,6}|rgb|hsl/g) || []).length > 15;
            const manyBorders = (content.match(/border:|border-/g) || []).length > 10;
            if (manyColors && manyBorders)
                this.warnings.push(`[Cognitive Load] ${filename}: High visual noise detected.`);
            if (/price|pricing|cost|\$\d+/i.test(content) && !/original|was|strike|del|save \d+%/i.test(content)) {
                this.warnings.push(`[Persuasion] ${filename}: Prices without anchoring.`);
            }
            if (/join|subscriber|member|user/i.test(content) && !/\d+[+kmb]|\d+,\d+/.test(content)) {
                this.warnings.push(`[Persuasion] ${filename}: Social proof without specific numbers.`);
            }
            if (hasForm && complexElements > 5 && !/progress|step \d+|complete|%|bar/i.test(content)) {
                this.warnings.push(`[Persuasion] ${filename}: Long form without progress indicator.`);
            }
            // Typography
            const googleFonts = [...content.matchAll(/fonts\.googleapis\.com[^"']*family=([^"&]+)/gi)];
            if (googleFonts.length > 3)
                this.issues.push(`[Typography] ${filename}: >3 font families detected.`);
            if (hasLongText && !/max-w-(?:prose|[\[\\]?\d+ch[\]\\]?)|max-width:\s*\d+ch/.test(content)) {
                this.warnings.push(`[Typography] ${filename}: No line length constraint (45-75ch).`);
            }
            if (/<h[1-6]|text-(?:xl|2xl|3xl|4xl|5xl|6xl)/i.test(content)) {
                const lhMatches = [...content.matchAll(/(?:leading-|line-height:\s*)([\d.]+)/g)];
                for (const m of lhMatches) {
                    if (parseFloat(m[1]) > 1.5)
                        this.warnings.push(`[Typography] ${filename}: Heading has line-height > 1.3.`);
                }
            }
            if (/uppercase|text-transform:\s*uppercase/i.test(content) && !/tracking-|letter-spacing:/.test(content)) {
                this.warnings.push(`[Typography] ${filename}: Uppercase text without tracking.`);
            }
            if (/text-(?:4xl|5xl|6xl|7xl|8xl|9xl)|font-size:\s*[3-9]\dpx/.test(content) && !/tracking-tight|letter-spacing:\s*-[0-9]/.test(content)) {
                this.warnings.push(`[Typography] ${filename}: Large display text without tracking-tight.`);
            }
            if (/font-size:|text-(?:xs|sm|base|lg|xl|2xl)/.test(content) && !/clamp\(|responsive:/.test(content)) {
                this.warnings.push(`[Typography] ${filename}: Fixed font sizes without clamp().`);
            }
            const headings = [...content.matchAll(/<h([1-6])/gi)];
            if (headings.length > 0) {
                for (let i = 0; i < headings.length - 1; i++) {
                    if (parseInt(headings[i + 1][1]) > parseInt(headings[i][1]) + 1) {
                        this.warnings.push(`[Typography] ${filename}: Skipped heading level.`);
                    }
                }
                if (!headings.some(h => h[1] === '1') && hasLongText) {
                    this.warnings.push(`[Typography] ${filename}: No h1 found.`);
                }
            }
            // Visual Effects
            if (/backdrop-filter|blur\(/.test(content) && !/background:\s*rgba|bg-opacity|bg-[a-z0-9]+\/\d+/.test(content)) {
                this.warnings.push(`[Visual] ${filename}: Blur used without semi-transparent background`);
            }
            if (/@keyframes|transition:/.test(content) && /width|height|top|left|right|bottom|margin|padding/.test(content)) {
                this.warnings.push(`[Performance] ${filename}: Animating expensive properties. Use transform/opacity.`);
                if (!/prefers-reduced-motion/.test(content))
                    this.warnings.push(`[Accessibility] ${filename}: Animations found without prefers-reduced-motion check`);
            }
            const neoShadows = [...content.matchAll(/box-shadow:\s*([^;]+)/g)];
            for (const s of neoShadows) {
                if (s[1].includes(',') && s[1].includes('-') && s[1].includes('inset')) {
                    this.warnings.push(`[Visual] ${filename}: Neomorphism inset detected. Ensure adequate contrast.`);
                }
            }
            const gradients = (content.match(/gradient/gi) || []).length;
            if (gradients > 5)
                this.warnings.push(`[Visual] ${filename}: Many gradients detected (${gradients}).`);
            else if (hasHero && !/background:|bg-/.test(content))
                this.warnings.push(`[Visual] ${filename}: Hero section without visual interest.`);
            if ((content.match(/border:/g) || []).length > 8)
                this.warnings.push(`[Visual] ${filename}: Many border declarations`);
            // colors
            const purples = ['#8B5CF6', '#A855F7', '#9333EA', '#7C3AED', '#6D28D9', 'purple', 'violet', 'fuchsia', 'magenta', 'lavender'];
            for (const p of purples) {
                if (lowerC.includes(p.toLowerCase())) {
                    this.issues.push(`[Color] ${filename}: PURPLE DETECTED ('${p}'). Banned by Maestro rules.`);
                    break;
                }
            }
            if (/color:\s*#000000|#000\b/.test(content))
                this.warnings.push(`[Color] ${filename}: Pure black (#000000) detected.`);
            // animation & UX
            const durations = [...content.matchAll(/(?:duration|animation-duration|transition-duration):\s*([\d.]+)(s|ms)/g)];
            for (const d of durations) {
                const ms = parseFloat(d[1]) * (d[2] === 's' ? 1000 : 1);
                if (ms < 50)
                    this.warnings.push(`[Animation] ${filename}: Very fast animation (${d[1]}${d[2]}).`);
                else if (ms > 1000 && lowerC.includes('transition'))
                    this.warnings.push(`[Animation] ${filename}: Long transition.`);
            }
            if (/ease-in\s+.*entry|fade-in.*ease-in/.test(content))
                this.warnings.push(`[Animation] ${filename}: Entry animation with ease-in.`);
            if (/ease-out\s+.*exit|fade-out.*ease-out/.test(content))
                this.warnings.push(`[Animation] ${filename}: Exit animation with ease-out.`);
            const interactiveCount = (content.match(/<button|<a\s+href|onClick|@click/g) || []).length;
            if (interactiveCount > 2 && !/hover:|focus:|:hover|:focus/.test(content)) {
                this.warnings.push(`[Animation] ${filename}: Interactive elements without hover/focus states.`);
            }
            // accessibility basics
            if (/<img(?![^>]*alt=)[^>]*>/.test(content))
                this.issues.push(`[Accessibility] ${filename}: Missing img alt text`);
        }
        catch { }
    }
    async auditDirectory(dir) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item.name))
                    continue;
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await this.auditDirectory(fullPath);
                }
                else if (/\.(tsx|jsx|html|vue|svelte|css)$/.test(item.name)) {
                    await this.auditFile(fullPath);
                }
            }
        }
        catch { }
    }
    getReport() {
        return {
            files_checked: this.files_checked,
            issues: this.issues,
            warnings: this.warnings,
            passed_checks: this.passed_count,
            compliant: this.issues.length === 0
        };
    }
}
export async function runUxAudit(projectPath = ".") {
    const root = path.resolve(projectPath);
    const auditor = new UXAuditor();
    await auditor.auditDirectory(root);
    const res = auditor.getReport();
    let report = `\n[UX AUDIT] ${res.files_checked} files checked\n`;
    report += `--------------------------------------------------\n`;
    if (res.issues.length > 0) {
        report += `[!] ISSUES (${res.issues.length}):\n`;
        for (const i of res.issues.slice(0, 10))
            report += `  - ${i}\n`;
    }
    if (res.warnings.length > 0) {
        report += `[*] WARNINGS (${res.warnings.length}):\n`;
        for (const w of res.warnings.slice(0, 15))
            report += `  - ${w}\n`;
    }
    report += `[+] PASSED CHECKS: ${res.passed_checks}\n`;
    report += `STATUS: ${res.compliant ? 'PASS' : 'FAIL'}\n`;
    return { passed: res.compliant, report };
}
