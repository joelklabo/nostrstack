import { chromium } from 'playwright';
const validNsec='nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
const browser=await chromium.launch({headless:true, ignoreHTTPSErrors:true});
const context=await browser.newContext({ignoreHTTPSErrors:true});
const page=await context.newPage({viewport:{width:1280,height:720}});
await page.goto('https://localhost:4173');
await page.getByText('Enter nsec manually').click();
await page.getByPlaceholder('nsec1...').fill(validNsec);
await page.getByRole('button',{name:'Sign in'}).click();
await page.waitForTimeout(1500);
await page.fill('textarea[placeholder="Share something with the network..."]','Hello from Playwright E2E!');
await page.getByRole('button',{name:'Publish'}).click();
await page.waitForTimeout(1200);
const details=await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.zap-btn')).map((btn, idx) => {
    return {
      idx,
      text: btn.textContent,
      label: btn.getAttribute('aria-label'),
      rect: btn.getBoundingClientRect().toJSON ? btn.getBoundingClientRect() : null,
      html: btn.closest('article')?.getAttribute('class'),
      ancestors: (function() {
        const chain=[];
        let n = btn;
        while(n && chain.length < 8){
          chain.push({tag:n.tagName, className:n.className});
          n = n.parentElement;
        }
        return chain;
      })()
    };
  });
});
console.log(JSON.stringify(details,null,2));
await browser.close();
