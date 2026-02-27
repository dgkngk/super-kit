import * as fs from 'fs/promises';
import * as path from 'path';
class MobileAuditor {
    issues = [];
    warnings = [];
    passed_count = 0;
    files_checked = 0;
    async auditFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const isReactNative = /react-native|@react-navigation|React\.Native/.test(content);
            const isFlutter = /import 'package:flutter|MaterialApp|Widget\.build/.test(content);
            if (!isReactNative && !isFlutter)
                return;
            this.files_checked++;
            const filename = path.basename(filePath);
            // Touch Psychology
            const smallSizes = [...content.matchAll(/(?:width|height|size):\s*([0-3]\d)/g)];
            for (const match of smallSizes) {
                if (parseInt(match[1]) < 44)
                    this.issues.push(`[Touch Target] ${filename}: size ${match[1]}px < 44px`);
            }
            const smallGaps = [...content.matchAll(/(?:margin|gap):\s*([0-7])\s*(?:px|dp)/g)];
            for (const match of smallGaps) {
                if (parseInt(match[1]) < 8)
                    this.warnings.push(`[Touch Spacing] ${filename}: gap ${match[1]}px < 8px`);
            }
            const hasPrimaryBtn = /(?:testID|id):\s*["'](?:.*(?:primary|cta|submit|confirm)[^"']*)["']/i.test(content);
            const hasBottomObj = /position:\s*["']?absolute["']?|bottom:\s*\d+|style.*bottom|justifyContent:\s*["']?flex-end/.test(content);
            if (hasPrimaryBtn && !hasBottomObj)
                this.warnings.push(`[Thumb Zone] ${filename}: Primary CTA may not be at bottom`);
            if (/Swipeable|onSwipe|PanGestureHandler|swipe/.test(content) && !/Button.*(?:delete|archive|more)|TouchableOpacity|Pressable/.test(content)) {
                this.warnings.push(`[Gestures] ${filename}: Swipe without visible button alternative`);
            }
            if (/(?:onPress|onSubmit|delete|remove|confirm|purchase)/.test(content) && !/Haptics|Vibration|react-native-haptic-feedback|FeedbackManager/.test(content)) {
                this.warnings.push(`[Haptics] ${filename}: Important action without haptics`);
            }
            if (isReactNative && /Pressable|TouchableOpacity/.test(content) && !/pressed|style.*opacity|underlay/.test(content)) {
                this.warnings.push(`[Touch Feedback] ${filename}: Pressable without visual feedback state`);
            }
            // Performance
            if (/<ScrollView|ScrollView\./.test(content) && /ScrollView.*\.map\(|ScrollView.*\{.*\.map/s.test(content)) {
                this.issues.push(`[Performance CRITICAL] ${filename}: ScrollView with .map() detected. Use FlatList.`);
            }
            if (isReactNative && /FlatList|FlashList|SectionList/.test(content) && !/React\.memo|memo\(/.test(content)) {
                this.warnings.push(`[Performance] ${filename}: List without React.memo`);
            }
            if (isReactNative && /FlatList|FlashList/.test(content) && !/useCallback/.test(content)) {
                this.warnings.push(`[Performance] ${filename}: FlatList renderItem without useCallback`);
            }
            if (isReactNative && /FlatList/.test(content)) {
                if (!/keyExtractor/.test(content))
                    this.issues.push(`[Performance CRITICAL] ${filename}: FlatList without keyExtractor`);
                if (/key=\{.*index.*?\}|key:\s*index/.test(content))
                    this.issues.push(`[Performance CRITICAL] ${filename}: Using index as key`);
            }
            if (isReactNative && /Animated\./.test(content)) {
                if (/useNativeDriver:\s*false/.test(content))
                    this.warnings.push(`[Performance] ${filename}: Animation.useNativeDriver is false`);
                if (!/useNativeDriver/.test(content))
                    this.warnings.push(`[Performance] ${filename}: Animated without useNativeDriver`);
            }
            if (isReactNative && /useEffect/.test(content) && /addEventListener|subscribe|\.focus\(\)|\.off\(/.test(content) && !/return\s*\(\)\s*=>|return\s+function/.test(content)) {
                this.issues.push(`[Memory Leak] ${filename}: useEffect subscription without cleanup`);
            }
            const consoleCount = (content.match(/console\.(log|warn|error|debug)/g) || []).length;
            if (consoleCount > 5)
                this.warnings.push(`[Performance] ${filename}: ${consoleCount} console statements logs`);
            if (isReactNative) {
                const inlines = (content.match(/(?:onPress|onPressIn|onPressOut|renderItem):\s*\([^)]*\)\s*=>/g) || []).length;
                if (inlines > 3)
                    this.warnings.push(`[Performance] ${filename}: ${inlines} inline functions in props`);
            }
            if (/Animated\.timing.*(?:width|height|margin|padding)/.test(content)) {
                this.issues.push(`[Performance] ${filename}: Animating layout properties instead of transform/opacity`);
            }
            // Navigation
            const tabs = (content.match(/Tab\.Screen|createBottomTabNavigator|BottomTab/g) || []).length;
            if (tabs > 5)
                this.warnings.push(`[Navigation] ${filename}: ${tabs} tab items (max 5)`);
            if (/createBottomTabNavigator|Tab\.Navigator/.test(content) && !/lazy:\s*false/.test(content)) {
                this.warnings.push(`[Navigation] ${filename}: Tab bar without lazy: false`);
            }
            if (/(onBackPress|handleBackPress)/.test(content) && !/(BackHandler|useFocusEffect|navigation\.addListener)/.test(content)) {
                this.warnings.push(`[Navigation] ${filename}: Custom back handling without BackHandler listnener`);
            }
            const hasLinkConfig = /apollo-link|react-native-screens|navigation\.link/.test(content);
            if (/Linking\.|Linking\.openURL|deepLink|universalLink/.test(content) && !hasLinkConfig) {
                this.warnings.push(`[Navigation] ${filename}: Deep linking detected but lacks configuration.`);
            }
            else if (!hasLinkConfig) {
                this.passed_count++;
            }
            // Typography
            if (isReactNative) {
                if (/fontFamily:\s*["'][^"']+/.test(content) && !/fontFamily:\s*["']?(?:System|San Francisco|Roboto|-apple-system)/.test(content)) {
                    this.warnings.push(`[Typography] ${filename}: Custom font detected instead of system fonts`);
                }
                if (/fontSize:/.test(content) && !/allowFontScaling:\s*true|responsiveFontSize|useWindowDimensions/.test(content)) {
                    this.warnings.push(`[Typography] ${filename}: Fixed font sizes without scaling support`);
                }
            }
            const lineHeights = [...content.matchAll(/lineHeight:\s*([\d.]+)/g)];
            for (const lh of lineHeights) {
                if (parseFloat(lh[1]) > 1.8)
                    this.warnings.push(`[Typography] ${filename}: lineHeight > 1.8`);
            }
            const fontSizes = [...content.matchAll(/fontSize:\s*([\d.]+)/g)];
            for (const fs of fontSizes) {
                const size = parseFloat(fs[1]);
                if (size < 12)
                    this.warnings.push(`[Typography] ${filename}: fontSize < 12px`);
                else if (size > 32)
                    this.warnings.push(`[Typography] ${filename}: fontSize > 32px`);
            }
            // Colors
            if (/#000000|color:\s*black|backgroundColor:\s*["']?black/.test(content)) {
                this.warnings.push(`[Color] ${filename}: Pure black #000000 detected`);
            }
            if (!/useColorScheme|colorScheme|appearance:\s*["']?dark/.test(content) && !/\\\?.*dark|style:\s*.*dark|isDark/.test(content)) {
                this.warnings.push(`[Color] ${filename}: No dark mode support detected`);
            }
            // Backend rules
            if (/(token|jwt|auth.*storage)/i.test(content) && /AsyncStorage|@react-native-async-storage/.test(content) && !/SecureStore|Keychain|EncryptedSharedPreferences/.test(content)) {
                this.issues.push(`[Security] ${filename}: Storing auth token in AsyncStorage`);
            }
            if (/fetch|axios|netinfo|@react-native-community\/netinfo/.test(content) && !/offline|isConnected|netInfo|cache.*offline/.test(content)) {
                this.warnings.push(`[Offline] ${filename}: Network request without offline handling`);
            }
            if (/Notifications|pushNotification|Firebase\.messaging|PushNotificationIOS/.test(content) && !/onNotification|addNotificationListener|notification\.open/.test(content)) {
                this.warnings.push(`[Push] ${filename}: Push notifications without handler`);
            }
            // OLED & visibility
            if (/backgroundColor:\s*["']?#[0-9A-Fa-f]{6}/.test(content) && !/#121212|#1A1A1A|#0D0D0D|#000000/.test(content)) {
                this.warnings.push(`[Mobile Color] ${filename}: Consider OLED-optimized dark backgrounds`);
            }
            if (/(dark:\s*|isDark|useColorScheme|colorScheme:\s*["']?dark)/.test(content) && /(color:\s*["']?#ffffff|#fff["']?\}|textColor:\s*["']?white)/.test(content)) {
                this.warnings.push(`[Mobile Color] ${filename}: Pure white text in dark mode`);
            }
        }
        catch { }
    }
    async auditDirectory(dir) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (['node_modules', '.git', 'dist', 'build', '.next', 'ios', 'android', '.idea'].includes(item.name))
                    continue;
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await this.auditDirectory(fullPath);
                }
                else if (/\.(tsx|ts|jsx|js|dart)$/.test(item.name)) {
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
export async function runMobileAudit(projectPath = ".") {
    const root = path.resolve(projectPath);
    const auditor = new MobileAuditor();
    await auditor.auditDirectory(root);
    const res = auditor.getReport();
    let report = `\n[MOBILE AUDIT] ${res.files_checked} mobile files checked\n`;
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
