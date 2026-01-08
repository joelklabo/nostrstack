#!/usr/bin/env tsx
/**
 * Test script to verify cache features are working
 */
import { chromium } from 'playwright';

async function main() {
  console.log('🧪 Testing cache features...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  const logs: string[] = [];
  const errors: string[] = [];
  
  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[Cache]')) {
      console.log('  ✓', text);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    if (!error.message.includes('ResizeObserver')) {
      console.error('  ✗ Page error:', error.message);
    }
  });
  
  try {
    console.log('📍 Navigating to https://localhost:4173...');
    await page.goto('https://localhost:4173', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    // Check if IndexedDB is being used
    const hasDB = await page.evaluate(async () => {
      try {
        const dbs = await indexedDB.databases();
        return dbs.some(db => db.name === 'nostrstack-db');
      } catch {
        return false;
      }
    });
    
    console.log('\n📊 Test Results:');
    console.log(`  Database created: ${hasDB ? '✓' : '✗'}`);
    
    // Check for cache-related logs
    const cacheInitLogs = logs.filter(l => l.includes('[Cache]') || l.includes('Cache'));
    console.log(`  Cache logs found: ${cacheInitLogs.length > 0 ? '✓' : '✗'}`);
    
    // Take a screenshot
    await page.screenshot({ path: '/tmp/cache-test-screenshot.png', fullPage: true });
    console.log('  Screenshot saved: /tmp/cache-test-screenshot.png');
    
    // Check for critical errors (ignore ResizeObserver)
    const criticalErrors = errors.filter(e => !e.includes('ResizeObserver'));
    if (criticalErrors.length > 0) {
      console.log(`\n⚠️  Critical errors found (${criticalErrors.length}):`);
      criticalErrors.forEach(e => console.log(`    - ${e}`));
    }
    
    // Wait a bit more to see if cache manager starts
    console.log('\n⏳ Waiting for cache manager to initialize...');
    await page.waitForTimeout(5000);
    
    // Check console again
    const finalCacheLogs = logs.filter(l => l.includes('[Cache]')).slice(cacheInitLogs.length);
    if (finalCacheLogs.length > 0) {
      console.log('\n  Additional cache activity:');
      finalCacheLogs.forEach(log => console.log(`    ${log}`));
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
