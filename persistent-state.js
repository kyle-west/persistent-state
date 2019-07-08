window.PersistentStateRegistry = (() => {
  let instance;

  class PersistentStateRegistry {
    constructor () {
      if (instance) return instance;
      this.supportedTags = ["input", "textarea"];
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

    get (key, type="default", id="GLOBAL", defaultValue) {
      let value = this.getStorage(type).getItem(this.generateStorageKey(key, id));
      if (value === undefined) value = defaultValue;
      return value;
    }

    set (key, value, type="default", id="GLOBAL") {
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
      let tagSupported = (instance.supportedTags.includes(tagName));
      if (tagSupported) {
        if (tagName === 'input') {
          return instance.supportedInputTypes.includes(elem.type);
        }
        return true;
      }
      return false;
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
    this._elements = this.storage.supportedTags.map(e=>[...this.querySelectorAll(e)]).reduce((a,c)=>a.concat(c), []);
    this._elements.forEach(this.init.bind(this));
    document.addEventListener("DOMContentLoaded", () => {
      this._elements = this.storage.supportedTags.map(e=>[...this.querySelectorAll(e)]).reduce((a,c)=>a.concat(c), []);
      this._elements.forEach(this.init.bind(this));
    });
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
    if ('radio' === elem.type) {
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
    if ('radio' === elem.type) {
      let checkedItem = this.storage.get(key, this.type, this._storageId, null);
      if (checkedItem && checkedItem === elem.value) { 
        elem.checked = true;
      }
    } else if ('checkbox' === elem.type) {
      elem.checked = (this.storage.get(key, this.type, this._storageId, false) === 'true');
    } else {
      elem.value = elem.value || this.storage.get(key, this.type, this._storageId, "");
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

customElements.define('persistent-state', PersistentState);
