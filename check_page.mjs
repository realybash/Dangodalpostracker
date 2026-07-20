import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  // wait 3 seconds
  await new Promise(r => setTimeout(r, 3000));
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log("HTML length:", html.length);
  if (html.length < 1000) {
     console.log("Body:", html);
  } else {
     console.log("Body start:", html.substring(0, 1000));
  }
  
  await browser.close();
})();
