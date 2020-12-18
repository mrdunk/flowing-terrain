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

export function draw_2d(
  id: string,
  size: number,
  data_container: any,
  data_accessor: (x: number, y: number, contaner: any) => number,
  scale: number
): void {
  const canvas = document.getElementById(id) as HTMLCanvasElement;
  console.assert(canvas !== undefined, `Can't find canvas element: ${id}`);
  const ctx = canvas.getContext('2d');

  ctx.canvas.width = size * scale;
  ctx.canvas.height = size * scale;

  for(let x = 0; x < size; x++) {
    for(let y = 0; y < size; y++) {
      const val = data_accessor(x, y, data_container) * 255;
      ctx.fillStyle = `rgba(${val}, ${val}, ${val}, 1`;
      ctx.fillRect((size - x - 1) * scale, y * scale, scale, scale);
    }
  }
}
