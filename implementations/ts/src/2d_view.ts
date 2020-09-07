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

export function draw_2d(id: string, data: Array<Array<number>>, size:number=2): void {
  const canvas = document.getElementById(id) as HTMLCanvasElement;
  console.assert(canvas !== undefined, `Can't find canvas element: ${id}`);
  const ctx = canvas.getContext('2d');

  console.assert(data.length > 0, "Invalid data");
  let y_len: number = data[0].length;
  ctx.canvas.width = y_len * size;
  ctx.canvas.height = data.length * size;

  for(let x = 0; x < data.length; x++) {
    console.assert(y_len === data[x].length, "Mismatched data lengths");
    for(let y = 0; y < data[x].length; y++) {
      const val = data[x][y] * 255;
      ctx.fillStyle = `rgba(${val}, ${val}, ${val}, 1`;
      ctx.fillRect((data.length - x - 1) * size, y * size, size, size);
    }
  }
}
