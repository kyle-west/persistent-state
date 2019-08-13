(() => {
  const name = 'this-is-a-custom-wc'

  class CustomInputComponent extends HTMLElement {
    // when this is updated by persistent-state, this web component will update it's internals 
    set customValue (value) { 
      this.textInput.value = value || '';
    }

    connectedCallback () {
      this.attachShadow({mode: 'open'}); // this will hide the input from <persistent-state>
      this.shadowRoot.innerHTML = `
        <h6>This is a custom Web Component with custom events to make it hard to use with persistent state</h6>
      `
      this.textInput = document.createElement('input');
      this.shadowRoot.appendChild(this.textInput);

      this.textInput.addEventListener('input', (e) => {
        this.dispatchEvent(new CustomEvent(`${name}::input`, { 
          bubbles: true, 
          composed: true, 
          detail: { internalInputValue: e.currentTarget.value }
        }))
      })
    }
  }
  
  if ('customElements' in window) {
    customElements.define(name, CustomInputComponent);
  } else {
    document.registerElement(name, {prototype: Object.create(CustomInputComponent.prototype)});
  }
})()