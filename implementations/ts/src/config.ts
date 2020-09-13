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

/* A class that can be used to store configuration that can be passed via URL. */

type Callback = (keys: string, value: any) => void;

export class Config {
  content: Map<string, any> = new Map();
  callbacks: Map<string, any> = new Map();
  url = new URL(window.location.href);

  constructor() {
    for (const [key, value] of this.url.searchParams) {
      if(key === "config") {
        this.content = this.from_json(decodeURIComponent(value));
        break;
      }
    }

    console.dirxml(this.content);
  }

  get(keys: string, warn: boolean=true): any {
    let valid = true;
    let pointer = this.content;
    keys.split(".").forEach((key) => {
      if(pointer && pointer.has(key) && valid) {
        pointer = pointer.get(key);
      } else {
        valid = false;
        pointer = null;
      }
    });
    if(pointer === null && warn) {
      console.warn(`Could not get stored value for: ${keys}`);
    }
    return pointer;
  }

  set_if_null(keys: string, value: any): void {
    if(this.get(keys, false) === null) {
      this.set(keys, value);
    }
  }

  set(keys: string, value: any, do_callback: boolean = true): void {
    let pointer = this.content;
    let last_pointer: Map<string, any> = null;
    let last_key: string = "";
    keys.split(".").forEach((key) => {
      last_pointer = pointer;
      last_key = key;
      if(! pointer.has(key)) {
        pointer.set(key, new Map());
      }
      pointer = pointer.get(key);
    });
    last_pointer.set(last_key, value);
    this.url.searchParams.set("config", encodeURIComponent(this.to_json()));

    if(do_callback) {
      this.callback(keys, value);
    }
  }

  set_callback(keys: string, value: any): void {
    let pointer = this.callbacks;
    let last_pointer: Map<string, any> = null;
    let last_key: string = "";
    keys.split(".").forEach((key) => {
      last_pointer = pointer;
      last_key = key;
      if(! pointer.has(key)) {
        pointer.set(key, new Map());
      }
      pointer = pointer.get(key);
    });
    last_pointer.set(last_key, value);
  }

  callback(keys: string, value: any): void {
    let valid = true;
    let pointer = this.callbacks;
    keys.split(".").forEach((key) => {
      if(pointer && pointer.has(key) && valid) {
        pointer = pointer.get(key);
      } else {
        valid = false;
        pointer = null;
      }
    });
    if(pointer !== null) {
      // Convert to "unknown" type first as TypeScript objects to converting
      // Map<...> to Callback.
      const tmp: unknown = pointer;
      const callback: Callback = tmp as Callback;
      callback(keys, value);
    }
  }

  goto_url(): void {
    console.log(this.url);
    history.pushState(null, null, "?" + this.url.searchParams.toString());
  }

  to_json(map: Map<string, any> = null): string {
    if(map === null) {
      map = this.content;
    }
    let ret_val = "{";
    for(const [key, value] of map) {
      if(value instanceof Map) {
        ret_val += `"${key}":${this.to_json(value)},`;
      } else if(typeof value === "string") {
        ret_val += `"${key}":"${value}",`;
      } else {
        ret_val += `"${key}":${value},`;
      }
    }

    if(ret_val[ret_val.length - 1] === ",") {
      ret_val = ret_val.slice(0, -1);
    }
    ret_val += "}";

    return ret_val;
  }

  from_json(json: string, map: Map<string, any> = null, obj: object = null): Map<string, any> {
    if(map === null) {
      obj = JSON.parse(json);
      map = this.content;
    }

    for (const [key, value] of Object.entries(obj)) {
      if(typeof value === "string") {
        map.set(key, value);
      } else if(typeof value === "number") {
        map.set(key, value);
      } else if(typeof value === "boolean") {
        map.set(key, value);
      } else {
        map.set(key, new Map());
        this.from_json("", map.get(key), value);
      }
    }

    return map;
  }
}
