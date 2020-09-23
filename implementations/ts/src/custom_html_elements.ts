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
  content_inner_wrapper: HTMLElement;
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

    if(!this.hasAttribute("group")) {
      this.setAttribute("group", "default");
    }

    // Apply external styles to the shadow DOM.
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "./bootstrap.css");
    this.shadow.appendChild(linkElem);

    const linkElem2 = document.createElement("link");
    linkElem2.setAttribute("rel", "stylesheet");
    linkElem2.setAttribute("href", "./collapsable_menu.css");
    this.shadow.appendChild(linkElem2);

    // Open button.
    this.button_wrapper = document.createElement("div");
    this.button_wrapper.setAttribute("class", "button-wrapper wrapper");
    this.open_button = document.createElement("button");
    this.open_button.setAttribute("class", "btn btn-primary");
    if(this.hasAttribute("img")) {
      const button_content = document.createElement("img");
      button_content.src = this.getAttribute("img");
      button_content.width = 30;
      button_content.height = 30;
      this.open_button.appendChild(button_content);
    } else if(this.hasAttribute("label")) {
      this.open_button.textContent = this.getAttribute("label");
    }
    this.button_wrapper.appendChild(this.open_button);
    this.shadow.appendChild(this.button_wrapper);

    // Content
    this.content_wrapper = document.createElement("div");
    this.content_wrapper.setAttribute(
      "class", "content-wrapper wrapper transparent card card-body border radius");

    this.close_button = document.createElement("button");
    this.close_button.setAttribute("class", "close");
    this.close_button.innerHTML = "&times;";
    this.content_wrapper.appendChild(this.close_button);

    this.content_inner_wrapper = document.createElement("div");
    this.content_inner_wrapper.setAttribute(
      "class", "content-inner-wrapper");
    this.content_wrapper.appendChild(this.content_inner_wrapper);

    const content = document.createElement("slot");
    this.content_inner_wrapper.appendChild(content);

    this.shadow.appendChild(this.content_wrapper);

    this.set_callbacks();
    this.attributeChangedCallback("active", "", this.getAttribute("active"));
    this.hide_same_group();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
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
    if(!this.hasAttribute("active") ||
        this.getAttribute("active").toLowerCase() !== "true") {
      return;
    }
    const elements = document.getElementsByTagName("collapsable-menu");
    for(const element of elements) {
      if(element !== this &&
          element.getAttribute("group") === this.getAttribute("group")) {
        element.setAttribute("active", "false");
      }
    }
  }

  show(): void {
    this.setAttribute("active", "true");
    this.hide_same_group();
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


let id_counter: number = 0;

/* A slider element with feedback window. */
export class FeedbackSlider extends HTMLElement {
  shadow: ShadowRoot;
  wrapper: HTMLElement;
  slider: HTMLInputElement;
  label: HTMLElement;
  output: HTMLElement;
  value: string;

  // Specify observed attributes so that attributeChangedCallback will work
  static get observedAttributes() {
    return ["value"];
  }

  constructor() {
    super();

    if(!this.id) {
      this.id = `autoGenId${id_counter}`;
      id_counter += 1;
    }

    this.shadow = this.attachShadow({mode: "open"});

    // Apply external styles to the shadow DOM.
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "./feedback_slider.css");
    this.shadow.appendChild(linkElem);

    const min = this.getAttribute("min") || "0";
    const max = this.getAttribute("max") || "100";
    const step = this.getAttribute("step") || "1";
    const value = this.getAttribute("value") || "50";
    const title = this.getAttribute("title") || "";

    this.wrapper = document.createElement("div");
    this.wrapper.setAttribute("class", "form-group range-wrap input-wrap");
    this.wrapper.setAttribute("title", title);

    this.slider = document.createElement("input");
    this.slider.setAttribute("class", "form-control-range range input");
    this.slider.setAttribute("type", "range");
    this.slider.setAttribute("id", `${this.id}--slider`);
    this.slider.setAttribute("min", min);
    this.slider.setAttribute("max", max);
    this.slider.setAttribute("step", step);
    this.slider.setAttribute("value", value);

    this.label = document.createElement("label");
    this.label.setAttribute("class", "label");
    this.label.setAttribute("for", this.slider.id);

    const content = document.createElement("slot");
    this.label.appendChild(content);

    this.output = document.createElement("output");
    this.label.appendChild(this.output);

    this.wrapper.appendChild(this.label);
    this.wrapper.appendChild(this.slider);
    this.shadow.appendChild(this.wrapper);

    this.onSlider(null);
    this.attributeChangedCallback("value", "", this.getAttribute("value"));
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    if(name.toLowerCase() === "value" && oldValue !== newValue) {
      this.value = newValue;
      this.slider.value = newValue;
      this.output.innerHTML = `: ${this.value}`;
    }
  }

  onSlider(event: Event): void {
    this.value = this.slider.value;
    this.output.innerHTML = `: ${this.value}`;
  }

  connectedCallback() {
    this.slider.addEventListener("input", this.onSlider.bind(this));
  }
}

customElements.define("feedback-slider", FeedbackSlider);

