/*
 * MIT License
 *
 * Copyright (c) 2020 duncan law
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* A custom collapsible menu. */

export class CollapsibleMenu extends HTMLElement {
  shadow: ShadowRoot;
  button_wrapper: HTMLElement;
  content_wrapper: HTMLElement;
  open_button: HTMLElement;
  close_button: HTMLElement;
  open_callbacks: any[] = [];
  close_callbacks: any[] = [];

  // Specify observed attributes so that attributeChangedCallback will work
  static get observedAttributes() {
    return ["active"];
  }

  constructor() {
    super();

    this.shadow = this.attachShadow({mode: "open"});

    const inline_style = document.createElement('style');
    inline_style.textContent = "";
    inline_style.textContent += ".wrapper {";
    inline_style.textContent += "  -webkit-transition-property: ";
    inline_style.textContent += "    max-height max-width visibility padding;";
    inline_style.textContent += "  -webkit-transition-duration: 0.3s;";
    inline_style.textContent += "  -webkit-transition-timing-function: ease;";
    inline_style.textContent += "  transition-property: ";
    inline_style.textContent += "    max-height max-width visibility padding;";
    inline_style.textContent += "  transition-duration: 0.5s;";
    inline_style.textContent += "  transition-timing-function: ease;";
    inline_style.textContent += "}";
    inline_style.textContent += ".show { ";
    inline_style.textContent += "  visibility: visible;";
    inline_style.textContent += "  max-height: 800px;";
    inline_style.textContent += "  max-width: 800px;";
    inline_style.textContent += "  padding: 1px;";
    inline_style.textContent +=  "}";
    inline_style.textContent += ".button-wrapper:not(.show) {";
    inline_style.textContent += "  visibility: hidden;";
    inline_style.textContent += "  max-height: 0;";
    inline_style.textContent += "  max-width: 0;";
    inline_style.textContent += "  padding: 0;";
    inline_style.textContent += "}";
    inline_style.textContent += ".content-wrapper:not(.show) {";
    inline_style.textContent += "  visibility: hidden;";
    inline_style.textContent += "  max-height: 0;";
    inline_style.textContent += "  max-width: 0;";
    inline_style.textContent += "  padding: 0;";
    inline_style.textContent += "}";
    this.shadow.appendChild(inline_style);


    if(!this.hasAttribute("group")) {
      this.setAttribute("group", "default");
    }

    // Apply external styles to the shadow DOM.
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "./bootstrap.css");
    this.shadow.appendChild(linkElem);

    // Open button.
    this.button_wrapper = document.createElement("div");
    this.button_wrapper.setAttribute("class", "button-wrapper wrapper");
    this.open_button = document.createElement("button");
    this.open_button.setAttribute("class", "btn btn-primary");
    if(this.hasAttribute("img")) {
      const button_content = document.createElement("img");
      button_content.src = this.getAttribute("img");
      this.open_button.appendChild(button_content);
    } else if(this.hasAttribute("label")) {
      this.open_button.textContent = this.getAttribute("label");
    }
    this.button_wrapper.appendChild(this.open_button);
    this.shadow.appendChild(this.button_wrapper);

    // Content
    this.content_wrapper = document.createElement("div");
    this.content_wrapper.setAttribute(
      "class", "content-wrapper wrapper card card-body");

    this.close_button = document.createElement("button");
    this.close_button.setAttribute("class", "close");
    this.close_button.textContent = "X";
    this.content_wrapper.appendChild(this.close_button);

    const content = document.createElement("slot");
    this.content_wrapper.appendChild(content);

    this.shadow.appendChild(this.content_wrapper);

    this.set_callbacks();
    this.hide_same_group();
    this.attributeChangedCallback("active", "", this.getAttribute("active"));
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    console.log(this.id, name, oldValue, newValue);
    if(name.toLowerCase() === "active" && oldValue !== newValue) {
      if(newValue !== null && newValue.toLowerCase() === "true") {
        this.content_wrapper.classList.add("show");
        this.button_wrapper.classList.remove("show");
      } else {
        this.content_wrapper.classList.remove("show");
        this.button_wrapper.classList.add("show");
      }
    }
  }

  hide_same_group(): void {
    const elements = document.getElementsByTagName("collapsable-menu");
    for(const element of elements) {
      if(element !== this &&
          element.getAttribute("group") === this.getAttribute("group")) {
        element.setAttribute("active", "false");
      }
    }
  }

  show(): void {
    this.hide_same_group();
    this.setAttribute("active", "true");
  }

  hide(): void {
    this.setAttribute("active", "false");
  }

  set_callbacks(): void {
    this.set_close_callback(this.hide);
    this.set_open_callback(this.show);
  }

  set_open_callback(callback: any): void {
    this.open_button.addEventListener("click", callback.bind(this));
    this.open_callbacks.push(callback);
  }

  set_close_callback(callback: any): void {
    this.close_button.addEventListener("click", callback.bind(this));
    this.close_callbacks.push(callback);
  }
}

customElements.define("collapsable-menu", CollapsibleMenu);
