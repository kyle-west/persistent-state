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
  testApp.use('/demo/custom-webcomponent.js', (req, res) => res.sendFile(__dirname + '/demo/custom-webcomponent.js'))
  testApp.use('/demo/json-wc.js', (req, res) => res.sendFile(__dirname + '/demo/json-wc.js'))

  server = testApp.listen(port, done)
});

const openBrowsers = [];

function getNewPage(config) {
  return new Promise((resolve) => {
    setTimeout(() => { // give time for the server to load up before we begin the tests
      (async () => {
        const browser = await puppeteer.launch(config);
        const page = await browser.newPage();
        await page.goto(`http://localhost:${port}/test/persistent-state_test.html`, {waitUntil : ['load', 'domcontentloaded']});
        openBrowsers.push(browser)
        resolve({browser, page})
      })();
    }, 50)
  })
}

let loadTestPage = getNewPage();

afterAll(async (done) => {
  await Promise.all(openBrowsers.map(browser => browser.close()))
  server.close(done)
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// RUN TESTS
//////////////////////////////////////////////////////////////////////////////////////////////////////////

/************************************ Test storage functionality ************************************/

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

/************************************ Test support for elements ************************************/

test(`<select> elements are supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const selectElement = 'persistent-state#test-element-support select';

    await page.waitFor(selectElement);
    let selectedBefore = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support select').value
    })
    expect(selectedBefore).toBe('Banana')

    await page.waitFor(selectElement);
    await page.select(selectElement, 'Taco')
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(selectElement);
    let selectedAfter = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support select').value
    })
    expect(selectedAfter).toBe('Taco')
  })
});

test(`<textarea> elements are supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const textareaElement = 'persistent-state#test-element-support textarea';

    await page.waitFor(textareaElement);
    let textareaBefore = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support textarea').value
    })
    expect(textareaBefore).toBe('')

    await page.waitFor(textareaElement);
    await page.type(textareaElement, 'This was entered in by a test')
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(textareaElement);
    let textareaAfter = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support textarea').value
    })
    expect(textareaAfter).toBe('This was entered in by a test')
  })
});

// This also covers test for "type" in [color, date, datetime-local, email, month, number, password, range, search, tel, time, url, week]
// because they share the same API as type="text"
test(`<input type="text"> element is supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const inputElement = 'persistent-state#test-element-support input[type="text"]';

    await page.waitFor(inputElement);
    let inputBefore = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support input[type="text"]').value
    })
    expect(inputBefore).toBe('')

    await page.waitFor(inputElement);
    await page.type(inputElement, 'This was entered in by a test')
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(inputElement);
    let inputAfter = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support input[type="text"]').value
    })
    expect(inputAfter).toBe('This was entered in by a test')
  })
});

test(`<input type="checkbox"> element is supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const inputElement = 'persistent-state#test-element-support input[type="checkbox"]';

    await page.waitFor(inputElement);
    let inputBefore = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support input[type="checkbox"]').checked
    })
    expect(inputBefore).toBe(false)

    await page.waitFor(inputElement);
    await page.click(inputElement)
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(inputElement);
    let inputAfter = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support input[type="checkbox"]').checked
    })
    expect(inputAfter).toBe(true)
  })
});

test(`<input type="radio"> element is supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const inputElement = 'persistent-state#test-element-support input[type="radio"]';

    await page.waitFor(inputElement);
    let inputBefore = await page.evaluate(() => {
      new FormData(document.querySelector('persistent-state#test-element-support #radio-btns')).get('radio-btn-text')
    })
    expect(inputBefore).toBeFalsy()

    await page.waitFor(inputElement);
    await page.click('persistent-state#test-element-support #o2')
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(inputElement);
    let inputAfter = await page.evaluate(() => {
      return new FormData(document.querySelector('persistent-state#test-element-support #radio-btns')).get('radio-btn-text')
    })
    expect(inputAfter).toBe('middle item')
  })
});

test(`<input type="hidden"> element is supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const inputElement = 'persistent-state#test-element-support input[type="hidden"]';

    await page.waitFor(inputElement);
    let inputBefore = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support input[type="hidden"]').value
    })
    expect(inputBefore).toBe('')

    await page.evaluate(() => {
      document.querySelector('persistent-state#test-element-support input[type="hidden"]').value = 'This was entered in by a test'
    })
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(inputElement);
    let inputAfter = await page.evaluate(() => {
      return document.querySelector('persistent-state#test-element-support input[type="hidden"]').value
    })
    expect(inputAfter).toBe('This was entered in by a test')
  })
});

test(`custom web components are supported`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const webComponent = 'persistent-state#test-custom-wc-support this-is-a-custom-wc';

    await page.waitFor(webComponent);
    let inputBefore = await page.evaluate(() => {
      return document.querySelector("#test-custom-wc-support this-is-a-custom-wc").shadowRoot.querySelector('input').value
    })
    expect(inputBefore).toBe('')

    // get the input from the shadowRoot and type into it
    const input = await page.evaluateHandle(`document.querySelector("#test-custom-wc-support this-is-a-custom-wc").shadowRoot.querySelector('input')`);
    await input.focus();
    await input.type('This was entered in by a test');
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(webComponent);
    let inputAfter = await page.evaluate(() => {
      return document.querySelector("#test-custom-wc-support this-is-a-custom-wc").shadowRoot.querySelector('input').value
    })
    expect(inputAfter).toBe('This was entered in by a test')
  })
});

test(`custom web components API: isJSON`, () => {
  return getNewPage().then(async ({ browser, page }) => {
    const webComponent = 'persistent-state#test-wc-json-support json-wc';

    await page.waitFor(webComponent);
    let jsonBefore = await page.evaluate(() => {
      return document.querySelector("#test-wc-json-support json-wc")._state;
    })
    expect(jsonBefore).toEqual({ loadedFromMemory: false, clickCount: 0 })

    // get the input from the shadowRoot and type into it
    const input = await page.evaluateHandle(`document.querySelector("#test-wc-json-support json-wc").shadowRoot.querySelector('button')`);
    await input.focus();
    await input.click();
    await input.click();
    await input.click();
    
    // reload the page
    const navigationPromise = page.waitForNavigation()
    await page.evaluate(() => window.location.reload())
    await navigationPromise
    
    await page.waitFor(webComponent);
    let jsonAfter = await page.evaluate(() => {
      return document.querySelector("#test-wc-json-support json-wc")._state
    })
    expect(jsonAfter).toEqual({ loadedFromMemory: true, clickCount: 3 })
  })
});