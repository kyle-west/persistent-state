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

    reset () {
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

  connectedCallback () {
    this.type = this.getAttribute("type") || "default";
    this._elements = this.storage.supportedTags.map(e=>[...this.querySelectorAll(e)]).reduce((a,c)=>a.concat(c), []);
    this._elements.forEach(this.init.bind(this));
    document.addEventListener("DOMContentLoaded", () => {
      this._elements = this.storage.supportedTags.map(e=>[...this.querySelectorAll(e)]).reduce((a,c)=>a.concat(c), []);
      this._elements.forEach(this.init.bind(this));
    });
  }

  init (elem, idx) {
    if (!PersistentStateRegistry.supported(elem)) return;
    let id = this.id || "GLOBAL";
    
    if ('radio' === elem.type) {
      let key = elem.tagName + "[name=" + elem.name + "]"; 
      let checkedItem = this.storage.get(key, this.type, id, null);
      if (checkedItem && checkedItem === elem.value) { 
        elem.checked = true;
      }
      elem.addEventListener('change', (e) => {
        this.storage.set(key, e.currentTarget.value, this.type, id)
      });
    } else if ('checkbox' === elem.type) {
      let key = elem.tagName + "#" + (elem.id || idx);
      elem.checked = (this.storage.get(key, this.type, id, false) === 'true');
      elem.addEventListener('change', (e) => {
        this.storage.set(key, e.currentTarget.checked, this.type, id)
      });
    } else {
      let key = elem.tagName + "#" + (elem.id || idx); 
      elem.value = this.storage.get(key, this.type, id, "")
      elem.addEventListener('input', (e) => {
        this.storage.set(key, e.currentTarget.value, this.type, id)
      });
    }
  }
}

customElements.define('persistent-state', PersistentState);
