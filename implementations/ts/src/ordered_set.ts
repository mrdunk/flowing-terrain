/*
# MIT License
#
# Copyright (c) 2020 duncan law
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
*/


/* A Set implementation that allows highest and lowest values to be retrieved.
 * Adding to the Set takes O(n) time.
 * Querying the Set takes O(log n) time.
 * Retrieving an element from either end takes O(1) time.
 * Retrieving the highest or lowest value takes constant time.
 * A comparison function must be provided to determine whether 2 stored values
 * are greater, equal or less than each other.
 */
export class SortedSet {
  compare: (a: any, b: any) => number;
  values: any[] = [];
  length: number;

  constructor(values: any[], compare: (a: any, b: any) => number) {
    this.compare = compare;
    values.forEach((v) => this.push(v));
  }

  push(value: any) {
    // O(n) time.
    let left = 0;
    let right = this.length;
    while(right > left) {
      const mid = Math.round((left + right - 1) / 2);
      const comp = this.compare(value, this.values[mid]);
      if(comp > 0) {
        left = mid + 1;
      } else if(comp === 0) {
        // Value matches one in set.
        this.values.splice(mid, 1, value);
        return;
      } else {
        right = mid;
      }
    }
    // This splice takes O(n) time.
    this.values.splice(left, 0, value);
    this.length = this.values.length;
  }

  get_index(value: any): number {
    // O(log n) time.
    let left = 0;
    let right = this.length;
    while(right > left) {
      const mid = Math.round((left + right - 1) / 2);
      const comp = this.compare(value, this.values[mid]);
      if(comp > 0) {
        left = mid + 1;
      } else if(comp === 0) {
        // Value matches one in set.
        return mid;
      } else {
        right = mid;
      }
    }
    return NaN;
  }

  has(value: any): boolean {
    // O(log n) time.
    return ! isNaN(this.get_index(value));
  }

  pop() {
    // Return highest value.
    // Constant time.
    const val = this.values.pop();
    this.length = this.values.length;
    return val;
  }

  shift() {
    // Return lowest value.
    // Constant time.
    const val = this.values.shift();
    this.length = this.values.length;
    return val;
  }

  clear() {
    this.values = [];
    this.length = 0;
  }
}


