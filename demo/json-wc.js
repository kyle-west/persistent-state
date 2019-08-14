(() => {
  const name = 'json-wc'

  class JSONWebComponent extends HTMLElement {
    constructor (...args) {
      super(...args);

      if (!this._state) {
        this._state = {
          clickCount: 0,
          loadedFromMemory: false
        }
      }
    }

    set state (value) {
      if (!value) return;
      this._state = value;
      if (this.code) this.code.innerHTML = JSON.stringify(this._state);
    }

    connectedCallback () {
      this.attachShadow({mode: 'open'}); // this will hide the button from <persistent-state>
      this.shadowRoot.innerHTML = `
        <h6>This is a custom Web Component, which stores data as a json object:</h6>
      `
      this.button = document.createElement('button');
      this.button.innerHTML = 'Click Me To increment internal counter!'

      this.code = document.createElement('code');
      this.code.innerHTML = JSON.stringify(this._state);

      this.shadowRoot.appendChild(this.button);
      this.shadowRoot.appendChild(this.code);

      this.button.addEventListener('click', (e) => {
        this._state.clickCount++;
        this.code.innerHTML = JSON.stringify(this._state);
        this.dispatchEvent(new CustomEvent(`${name}::click`, { 
          bubbles: true, 
          composed: true, 
          detail: { state: this._state }
        }))
      })
    }
  }
  
  if ('customElements' in window) {
    customElements.define(name, JSONWebComponent);
  } else {
    document.registerElement(name, {prototype: Object.create(JSONWebComponent.prototype)});
  }
})()