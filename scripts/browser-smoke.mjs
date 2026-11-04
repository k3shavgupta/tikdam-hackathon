// Run with locally installed Chrome. Uses only the manual workflow and fictional inputs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const origin = process.argv[2];
if (!['https://tikdam.xyz', 'https://tikdam-v1-staging.k3shavgupta.workers.dev'].includes(origin)) {
  throw Error('Choose the staging or production origin.');
}
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors = [];
    const paid = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/api\/(chat|extract)(?:$|\?)/, route => {
      paid.push(new URL(route.request().url()).pathname);
      return route.abort();
    });
    await page.goto(origin);
    if (width < 700) {
      await page.getByRole('button',{name:'Open menu'}).click();
      await page.getByRole('button',{name:'Close menu'}).click();
    }
    const example = page.locator('.case-button[aria-pressed="false"]').first();
    const title = await example.innerText();
    await example.click();
    assert.equal(await page.locator('.case-button[aria-pressed="true"]').innerText(),title);
    await page.locator('a[href="/app"]:visible').first().click();
    await page.locator('.chat-context').waitFor();
    await page.getByLabel('What would you like help with?').selectOption('purchase');
    await page.getByLabel('Purchase country').selectOption('FR');
    await page.getByLabel('Business country').selectOption('GB');
    assert.match(await page.locator('.conversation-receipt').innerText(),/France/);
    assert.match(await page.locator('.conversation-receipt').innerText(),/United Kingdom/);
    await page.getByRole('button',{name:'Coverage & sources'}).click();
    await page.getByRole('button',{name:'Back to my check'}).click();
    assert.equal(await page.getByLabel('Purchase country').inputValue(),'FR');
    const draft = page.getByRole('textbox',{name:'Your question'});
    if (await draft.count()) {
      await draft.fill('Which invoice details should I ask for?');
      await page.getByRole('button',{name:'Your data'}).click();
      assert.equal(await draft.isVisible(),false);
      await page.getByRole('button',{name:'Back to my check'}).click();
      assert.equal(await draft.inputValue(),'Which invoice details should I ask for?');
    }
    await page.getByLabel('What would you like help with?').selectOption('before');
    await page.getByRole('button',{name:'Build my buying checklist'}).click();
    await page.locator('.result-main').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true);
    await page.getByRole('button',{name:'Clear session'}).click();
    await page.locator('.chat-context').waitFor();
    assert.deepEqual(errors,[]);
    assert.deepEqual(paid,[]);
    console.log(`${width}px passed menu or desktop navigation, example selection, app entry, chat context, checklist and clear.`);
    await page.close();
  }
} finally {
  await browser.close();
}
