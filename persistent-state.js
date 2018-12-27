window.PersistentStateRegistry = (() => {
  let instance;

  class PersistentStateRegistry {
    constructor () {
      if (instance) return instance;
      this.supportedTags = ["input", "textarea"];
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
      return (instance.supportedTags.includes(elem.tagName.toLowerCase()))
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
    this._elements = [...this.children];
    this._elements.forEach(this.init.bind(this));
  }

  init (elem, idx) {
    if (!PersistentStateRegistry.supported(elem)) return;
    let key = elem.tagName + "#" + (elem.id || idx); 
    let id = this.id || "GLOBAL";
    elem.value = this.storage.get(key, this.type, id, "")
    elem.addEventListener('input', (e) => {
      this.storage.set(key, e.currentTarget.value, this.type, id)
    });
  }
}

customElements.define('persistent-state', PersistentState);
