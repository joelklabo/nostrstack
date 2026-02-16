import { chromium } from 'playwright';
const css = `body{margin:0}.ns-content__image{display:block;width:100%;max-width:100%;}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
await page.setContent(`<style>${css}</style><img id='a' class='ns-content__image' width='16' height='9'>`);
const out = await page.evaluate(()=>{
  const img = document.querySelector('#a');
  const c = getComputedStyle(img);
  return {width:c.width,maxWidth:c.maxWidth,computedWidth:img.style.width, attr:img.getAttribute('width')};
});
console.log(out);
await browser.close();
