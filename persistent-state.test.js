//////////////////////////////////////////////////////////////////////////////////////////////////////////
// SET UP SERVER AND CLIENT HOOKS
//////////////////////////////////////////////////////////////////////////////////////////////////////////

const puppeteer = require('puppeteer')
const express = require('express')
const port = 8888
let server = null;

beforeAll((done) => {
  const testApp = express()
  
  // allow specific static files to be accessed only
  testApp.use('/test', express.static('test'))
  testApp.use('/persistent-state.js', (req, res) => res.sendFile(__dirname + '/persistent-state.js'))
  
  server = testApp.listen(port, done)
});

let loadTestPage = new Promise((resolve) => {
  setTimeout(() => { // give time for the server to load up before we begin the tests
    (async () => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(`http://localhost:${port}/test/persistent-state_test.html`, {waitUntil : ['load', 'domcontentloaded']});
      resolve({browser, page})
    })();
  }, 50)
})

afterAll(async (done) => {
  await loadTestPage.then(({browser}) => browser.close())
  server.close(done)
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// RUN TESTS
//////////////////////////////////////////////////////////////////////////////////////////////////////////

test(`The WC loads on the page`, () => {
  return loadTestPage.then(async ({ page }) => {
    const { element, PersistentStateRegistry } = await page.evaluate(() => ({
      element: document.querySelector('persistent-state#test-1'),
      PersistentStateRegistry: window.PersistentStateRegistry
    }))
    expect(element).toBeDefined();
    expect(PersistentStateRegistry).toBeDefined();
  })
});

test(`data is saved to the localStorage when type=""`, () => {
  return loadTestPage.then(async ({ page }) => {
    const KEY = 'PersistentStateRegistry::[test-2]::INPUT#0'
    const VALUE = 'this was written in test 2';
    
    let { element, localBefore } = await page.evaluate(() => ({
      element: document.querySelector('persistent-state#test-2 input'),
      localBefore: Object.entries(window.localStorage)
    }))

    expect(element.__persistent_state__initialized).toBe(true);
    expect(localBefore).toStrictEqual([])

    await page.waitFor('persistent-state#test-2 input');
    await page.type('persistent-state#test-2 input', VALUE);

    let { localAfter } = await page.evaluate(() => ({
      localAfter: Object.entries(window.localStorage),
    }))

    expect(localAfter).toStrictEqual([[KEY, VALUE]])
  })
});

test(`data is saved to the sessionStorage when type="session"`, () => {
  return loadTestPage.then(async ({ page }) => {
    const KEY = 'PersistentStateRegistry::[test-3]::INPUT#0'
    const VALUE = 'this was written in test 3';
    
    let { element, sessionBefore } = await page.evaluate(() => ({
      element: document.querySelector('persistent-state#test-3 input'),
      sessionBefore: Object.entries(window.sessionStorage)
    }))

    expect(element.__persistent_state__initialized).toBe(true);
    expect(sessionBefore).toStrictEqual([])

    await page.waitFor('persistent-state#test-3 input');
    await page.type('persistent-state#test-3 input', VALUE);

    let { sessionAfter } = await page.evaluate(() => ({
      sessionAfter: Object.entries(window.sessionStorage)
    }))

    expect(sessionAfter).toStrictEqual([[KEY, VALUE]])
  })
});

test(`data is saved under a computed key between the key="" attr and the input id`, () => {
  return loadTestPage.then(async ({ page }) => {
    const TEST3_KEY = 'PersistentStateRegistry::[test-3]::INPUT#0'
    const TEST3_VALUE = 'this was written in test 3';
    const KEY = 'PersistentStateRegistry::[test-key-attribute]::INPUT#the-input-tag-id'
    const VALUE = 'this was written in test 4';
    
    let { element, sessionBefore } = await page.evaluate(() => ({
      element: document.querySelector('persistent-state#test-many input'),
      sessionBefore: Object.entries(window.sessionStorage)
    }))

    expect(element.__persistent_state__initialized).toBe(true);
    expect(sessionBefore).toStrictEqual([[TEST3_KEY, TEST3_VALUE]])

    await page.waitFor('persistent-state#test-many input');
    await page.type('persistent-state#test-many input', VALUE);

    let { sessionAfter } = await page.evaluate(() => ({
      sessionAfter: Object.entries(window.sessionStorage)
    }))

    expect(sessionAfter).toStrictEqual([[TEST3_KEY, TEST3_VALUE], [KEY, VALUE]])
  })
});

test(`data is loaded from sessionStorage by the WC when initialized`, () => {
  return loadTestPage.then(async ({ page }) => {
    const KEY = 'PersistentStateRegistry::[test-key-attribute]::INPUT#the-input-tag-id'
    
    await page.evaluate(() => {
      document.getElementById('root').innerHTML = '';
    })
    
    let { beforeInit } = await page.evaluate(() => ({
      beforeInit: document.querySelector('persistent-state#test-many input')
    }))
    
    expect(beforeInit).toBe(null);
    
    await page.evaluate(() => {
      document.getElementById('root').innerHTML = `
        <persistent-state id="test-many" key="test-key-attribute" type="session">
          <input type="text" id="the-input-tag-id"/>
        </persistent-state>
      `;
    })

    let { afterInitValue } = await page.evaluate(() => ({
      afterInitValue: document.querySelector('persistent-state#test-many input').value
    }))
    
    expect(afterInitValue).toBe('this was written in test 4');
  })
});