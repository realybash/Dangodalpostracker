import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Login Screen loaded.');
    // Let's try to register an account
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const regBtn = btns.find(b => b.innerText.includes('Register Account'));
        if (regBtn) regBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Register Account clicked.');
    
    // Fill the registration form
    await page.type('input[placeholder="e.g. John Doe"]', 'Test Manager');
    await page.type('input[placeholder="4-Digit PIN"]', '1234');
    
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.innerText.includes('Create') && b.innerText.includes('Account'));
        if (createBtn) createBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    console.log('Account created.');
    
    // Fill login
    await page.type('input[type="tel"]', 'Test Manager');
    await page.type('input[type="password"]', '1234');
    
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const loginBtn = btns.find(b => b.innerText.includes('LOG IN'));
        if (loginBtn) loginBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    const text = await page.evaluate(() => document.body.innerText);
    console.log('PAGE TEXT AFTER LOGIN:', text.substring(0, 300));
  } catch (e) {
    console.error('Nav error', e);
  }
  await browser.close();
})();
