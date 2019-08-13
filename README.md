# `<persistent-state>`

[![Build Status](https://travis-ci.com/kyle-west/persistent-state.svg?branch=master)](https://travis-ci.com/kyle-west/persistent-state) [![Latest Version](https://img.shields.io/github/release/kyle-west/persistent-state.svg)](https://github.com/kyle-west/persistent-state/releases/latest) [![Licence](https://img.shields.io/github/license/kyle-west/persistent-state.svg)](https://github.com/kyle-west/persistent-state/blob/master/LICENSE) ![Size](https://img.shields.io/github/size/kyle-west/persistent-state/persistent-state.js.svg)

A native web component that holds onto the state of input elements during a
session and/or between sessions.

![Visual Example](./demo/example.gif)

# Installation

Any of the following commands will install `persistent-state`. Just pick your
package manager.

```sh
bower install persistent-state --save

# OR

yarn add kyle-west/persistent-state

# OR

npm install kyle-west/persistent-state --save
```

# Usage

Simply import the `persistent-state.html` file to begin using. A `persistent-state.js`
file is also available if you wish to use script:src sourcing instead of HTML imports.

```html
<link rel="import" href="/path/to/persistent-state.html">

<!-- OR -->

<script src="/path/to/persistent-state.js"></script>
```

Wrap your elements in a `<persistent-state>` tag to activate. The default case
uses `localStorage` to store state which will persist information between sessions.
If you wish to only store information for a session, add the `type="session"`
attribute. For the best experience, please provide each element with an `id`.

If you have many `<persistent-state>` elements in a DOM, it is recommended that
you provide an `id` for each `<persistent-state>` to avoid name collisions.

```html
<persistent-state>
  <input id="always-persistent" type="text">
</persistent-state>

<persistent-state type="session">
  <input id="persistent-for-session-only" type="text">
</persistent-state>
```

## Custom Storage Keys

Adding the `key` attribute will allow the input elements to have their values
each stored under a key computed from the given `key` and `id` attributes.

```html
<persistent-state key="customKey">
  <input id="has-custom-key" type="text">
</persistent-state>
```

## Supported Elements

Currently, the only supported elements are `<input>`, `<select>`, and `<textarea>` tags.
If you have a custom element you wish to add support to, you can register it
manually with the following:

```js
new PersistentStateRegistry().registerCustomElement({
  // the tag name of your custom web component
  name: 'my-custom-input-element',
  
  // this is the property that <persistent-state> will initialize on your component with any stored values
  updateProperty: 'customValue',

  // this is the name of the event your component fires when it's internal input value changes
  changeEvent: 'my-custom-input-element::input-event-name',

  // This is a callback for the PersistentStateRegistry to manage changes from your element.
  // The return value from this callback will be what is stored/loaded from memory
  onChange: (customEvent) => {
    return customEvent.detail.customValue
  }
});
```

In this example, `<persistent-state>` will initialize `<my-custom-input-element>`'s `customValue` property with data from the storage when it loads, and store the value returned from the `onChange` callback when the `my-custom-input-element::input-event-name` event fires on the element. 

<details>
<summary><strong>Here is an exhaustive list of all the support <code>input</code> types</strong></summary>

- `checkbox`
- `color`
- `date`
- `datetime-local`
- `email`
- `hidden`
- `month`
- `number`
- `password`
- `radio`
- `range`
- `search`
- `tel`
- `text`
- `time`
- `url`
- `week`

</details>

### `<input type="radio">`

Note that with `radio` buttons the name has to be consistent between the elements:
```html
<persistent-state>
  <input type="radio" name="some-unique-name" id="o1" value="this"><label for="o1">This</label>
  <input type="radio" name="some-unique-name" id="o2" value="that"><label for="o2">That</label>
  <input type="radio" name="some-unique-name" id="o3" value="the other"><label for="o3">Or the Other</label>
</persistent-state>
```

## Events

The `PersistentState::ElementInitialized` event is fired when `PersistentState` updates
the value of an element.

```js
document.addEventListener('PersistentState::ElementInitialized', (e) => {
  const { elem } = e.detail;
  // handle updated state
});
```

## Resetting Data

If you wish to remove the data stored in the browser for a specific `<persistent-state>` form,
simply query for the web component and call the `reset()` method.

```js
let psForm = document.querySelector('persistent-state');
psForm.reset()
```

Additionally, if you wish to remove all data stored by this package, use the `PersistentStateRegistry`.

```js
// class is a singleton
new PersistentStateRegistry().resetAll();
```
