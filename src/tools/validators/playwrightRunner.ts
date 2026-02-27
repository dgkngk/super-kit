import { chromium } from 'playwright';
import * as os from 'os';
import * as path from 'path';

export async function runPlaywrightTest(url: string, takeScreenshot: boolean = false): Promise<any> {
    const result: any = {
        url,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        });

        const page = await context.newPage();

        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);

        result.page = {
            title: await page.title().catch(() => ''),
            url: page.url(),
            status_code: response ? response.status() : null
        };

        result.health = {
            loaded: response ? response.ok() : false,
            has_title: !!result.page.title,
            has_h1: (await page.locator('h1').count()) > 0,
            has_links: (await page.locator('a').count()) > 0,
            has_images: (await page.locator('img').count()) > 0
        };

        const timingStr = await page.evaluate(() => JSON.stringify({
            dom_content_loaded: window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart,
            load_complete: window.performance.timing.loadEventEnd - window.performance.timing.navigationStart
        }));
        result.performance = JSON.parse(timingStr);

        if (takeScreenshot) {
            const screenshotDir = path.join(os.tmpdir(), "maestro_screenshots");
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(screenshotDir, `screenshot_${timestamp}.png`);

            // Note: mkdirs internally handled by playwright or Node requires `fs.mkdir`
            await page.screenshot({ path: screenshotPath, fullPage: true });
            result.screenshot = screenshotPath;
            result.screenshot_note = "Saved to temp directory (auto-cleaned by OS)";
        }

        result.elements = {
            links: await page.locator('a').count(),
            buttons: await page.locator('button').count(),
            inputs: await page.locator('input').count(),
            images: await page.locator('img').count(),
            forms: await page.locator('form').count()
        };

        result.status = result.health.loaded ? 'success' : 'failed';
        result.summary = result.status === 'success' ? '[OK] Page loaded successfully' : '[X] Page failed to load';

    } catch (e: any) {
        result.status = 'error';
        result.error = e.message;
        result.summary = `[X] Error: ${e.message.substring(0, 100)}`;
    } finally {
        if (browser) await browser.close().catch(() => { });
    }

    return result;
}

export async function runPlaywrightA11y(url: string): Promise<any> {
    const result: any = { url, accessibility: {} };

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        result.accessibility = {
            images_with_alt: await page.locator('img[alt]').count(),
            images_without_alt: await page.locator('img:not([alt])').count(),
            buttons_with_label: (await page.locator('button[aria-label]').count()) + (await page.locator('button:has-text("")').count()),
            links_with_text: await page.locator('a:has-text("")').count(),
            form_labels: await page.locator('label').count(),
            headings: {
                h1: await page.locator('h1').count(),
                h2: await page.locator('h2').count(),
                h3: await page.locator('h3').count()
            }
        };

        result.status = 'success';
    } catch (e: any) {
        result.status = 'error';
        result.error = e.message;
    } finally {
        if (browser) await browser.close().catch(() => { });
    }

    return result;
}
