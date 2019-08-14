window.PersistentStateRegistry = (() => {
  let instance;

  class PersistentStateRegistry {
    constructor () {
      if (instance) return instance;
      this.supportedTags = ["input", "select", "textarea"];
      this.customElementTags = [];
      this.customElementConfigs = {};
      this.supportedInputTypes = [
        "checkbox",
        "color",
        "date",
        "datetime-local",
        "email",
        "hidden",
        "month",
        "number",
        "password",
        "radio",
        "range",
        "search",
        "tel",
        "text",
        "time",
        "url",
        "week"
      ];
      instance = this;
    }

    generateStorageKey (key, id) {
      return `PersistentStateRegistry::[${id}]::${key}`;
    }

    getStorage(type) {
      switch (type) {
        case "session": return window.sessionStorage;
        default: return window.localStorage;
      }
    }

    get (key, type="default", id="GLOBAL", defaultValue, treatAsJSON = false) {
      let value = this.getStorage(type).getItem(this.generateStorageKey(key, id));
      if (value === undefined) value = defaultValue;

      if (treatAsJSON) {
        try {
          value = JSON.parse(value);
        } catch(err) {
          console.warn('PersistentStateRegistry::get : Could not parse value as JSON', value, err)
        }
      }

      return value;
    }

    set (key, value, type="default", id="GLOBAL", treatAsJSON = false) {
      if (treatAsJSON) {
        try {
          value = JSON.stringify(value);
        } catch(err) {
          console.warn('PersistentStateRegistry::set : Could not stringify. Expected JSON object. Recieved:', value, err)
        }
      }
      this.getStorage(type).setItem(this.generateStorageKey(key, id), value);
    }

    reset (type="default", key, id) {
      this.getStorage(type).removeItem(this.generateStorageKey(key, id));
    }

    resetAll () {
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('PersistentStateRegistry::')) {
          sessionStorage.removeItem(key);
        }
      });
      Object.keys(localStorage).forEach(key => {
        if (key.includes('PersistentStateRegistry::')) {
          localStorage.removeItem(key);
        }
      });
    }

    static supported(elem) {
      if (!instance) new PersistentStateRegistry();
      let tagName = elem.tagName.toLowerCase();
      let tagSupported = (instance.supportedTags.includes(tagName) || instance.customElementTags.includes(tagName));
      if (tagSupported) {
        if (tagName === 'input') {
          return instance.supportedInputTypes.includes(elem.type);
        }
        return true;
      }
      return false;
    }

    registerCustomElement(config) {
      let name = config.name.toLowerCase();
      config.isJSON = !!config.isJSON;
      this.customElementTags.push(name);
      this.customElementConfigs[name] = config;
    }
  }

  return PersistentStateRegistry;
})();


class PersistentState extends HTMLElement {
  constructor (...args) {
    super(...args);
    this.storage = new PersistentStateRegistry();
  }

  static get observedAttributes() { return ["key"]; }

  connectedCallback () {
    this.type = this.getAttribute("type") || "default";
    this.observers = [];
    this._resetCallbacks = []
    
    this._setupElementsList()
    document.addEventListener("DOMContentLoaded", () => {
      this._setupElementsList()
    });
  }
  
  _setupElementsList () {
    this._elements = this.storage.supportedTags.map(e=>[...this.querySelectorAll(e)]).reduce((a,c)=>a.concat(c), []);
    this._elements = [...this._elements, ...this.storage.customElementTags.map(e=>[...this.querySelectorAll(e)]).reduce((a,c)=>a.concat(c), [])];
    this._elements.forEach(this.init.bind(this));
  }

  get _storageId () {
    return this.getAttribute("key") || this.id || "GLOBAL";
  }

  attributeChangedCallback () {
    this._elements && this._elements.forEach((elem, idx) => {
      let key = this.getKey(elem, idx);
      this.initializeValue(key, elem);
    });
  }

  init (elem, idx) {
    if (elem.__persistent_state__initialized) return;
    if (!PersistentStateRegistry.supported(elem)) return;

    let key = this.getKey(elem, idx);

    this.initializeValue(key, elem);
    this.setupObservers(key, elem);

    elem.__persistent_state__initialized = true;
    elem.dispatchEvent(new CustomEvent('PersistentState::ElementInitialized', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: {elem}
    }))
  }

  setupObservers (key, elem) {
    const tagName = elem.tagName.toLowerCase()
    if ('radio' === elem.type || 'select' === tagName) {
      elem.addEventListener('change', (e) => {
        this.storage.set(key, e.currentTarget.value, this.type, this._storageId)
      });
      this._resetCallbacks.push(() => {
        this.storage.reset(this.type, key, this._storageId)
      })
    } else if ('checkbox' === elem.type) {
      elem.addEventListener('change', (e) => {
        this.storage.set(key, e.currentTarget.checked, this.type, this._storageId)
      });
      this._resetCallbacks.push(() => {
        this.storage.reset(this.type, key, this._storageId)
      })
    } else if ('hidden' === elem.type) {
      let observer = new MutationObserver((mutationsList, observer) => {
        for(var mutation of mutationsList) {
          if (mutation.attributeName == 'value') {
            this.storage.set(key, mutation.target.value, this.type, this._storageId)
          }
        }
      });
      this.observers.push(observer);
      observer.observe(elem, {attributes: true});
      this._resetCallbacks.push(() => {
        this.storage.reset(this.type, key, this._storageId)
      })
    } else if (this.storage.customElementTags.includes(tagName)) {
      let config = this.storage.customElementConfigs[tagName]
      elem.addEventListener(config.changeEvent, (e) => {
        let value = config.onChange(e);
        this.storage.set(key, value, this.type, this._storageId, config.isJSON)
      });
      this._resetCallbacks.push(() => {
        this.storage.reset(this.type, key, this._storageId)
      })
    } else {
      elem.addEventListener('input', (e) => {
        this.storage.set(key, e.currentTarget.value, this.type, this._storageId)
      });
      this._resetCallbacks.push(() => {
        this.storage.reset(this.type, key, this._storageId)
      })
    }
  }

  initializeValue (key, elem) {
    const tagName = elem.tagName.toLowerCase();
    if ('radio' === elem.type) {
      let checkedItem = this.storage.get(key, this.type, this._storageId, null);
      if (checkedItem && checkedItem === elem.value) { 
        elem.checked = true;
      }
    } else if ('checkbox' === elem.type) {
      elem.checked = (this.storage.get(key, this.type, this._storageId, false) === 'true');
    } else if (this.storage.customElementTags.includes(tagName)) {
      let config = this.storage.customElementConfigs[tagName];
      let value = (this.storage.get(key, this.type, this._storageId, '', config.isJSON) || '');
      elem[config.updateProperty] = value || elem[config.updateProperty];
    } else {
      elem.value = (this.storage.get(key, this.type, this._storageId, '') || '') || elem.value;
    }
  }

  getKey (elem, idx) {
    if ('radio' === elem.type) {
      return elem.tagName + "[name=" + elem.name + "]"; 
    } else {
      return elem.tagName + "#" + (elem.id || idx); 
    }
  }

  reset () {
    this._resetCallbacks.forEach(cb => cb())
  }
}


if ('customElements' in window) {
  customElements.define('persistent-state', PersistentState);
} else {
  document.registerElement('persistent-state', {prototype: Object.create(PersistentState.prototype)});
}