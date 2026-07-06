import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('--- Login Screen Loaded ---');
    
    // Register Account
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const regBtn = btns.find(b => b.innerText.includes('Register Account'));
        if (regBtn) regBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Switch to Manager role if possible
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const mgrBtn = btns.find(b => b.innerText.includes('Manager'));
        if (mgrBtn) mgrBtn.click();
    });
    
    // Fill the registration form
    await page.type('input[type="text"]', 'Dan Godal');
    await page.type('input[type="password"], input[placeholder*="PIN"]', '1234');
    
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.innerText.includes('Create') && b.innerText.includes('Account'));
        if (createBtn) createBtn.click();
    });
    console.log('--- Account Created ---');
    await new Promise(r => setTimeout(r, 2500));
    
    // Fill login
    const inputs = await page.$$('input');
    await inputs[0].type('Dan Godal');
    await inputs[1].type('1234');
    
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const loginBtn = btns.find(b => b.innerText.includes('LOG IN'));
        if (loginBtn) loginBtn.click();
    });
    console.log('--- Logging In ---');
    await new Promise(r => setTimeout(r, 2000));
    
    const text = await page.evaluate(() => document.body.innerText);
    console.log('PAGE TEXT AFTER LOGIN:', text.substring(0, 500));
  } catch (e) {
    console.error('Nav error', e);
  }
  await browser.close();
})();
