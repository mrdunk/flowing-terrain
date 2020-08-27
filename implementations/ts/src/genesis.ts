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

import {SortedSet} from "./ordered_set"


export interface Coordinate {
  x: number;
  y: number;
}

/* Convert Coordinate into something that can be used as a key in a Set(). */
function coord_to_str(coord: Coordinate): string {
  return `${coord.x},${coord.y}`;
}

/* Generate coordinates of neighbouring tiles. */
function get_neighbours(coordinate: Coordinate): Array<Coordinate> {
  const neighbours: Array<Coordinate> = [];

  neighbours.push({x: coordinate.x - 2, y: coordinate.y - 2});
  neighbours.push({x: coordinate.x - 2, y: coordinate.y});
  neighbours.push({x: coordinate.x - 2, y: coordinate.y + 2});
  neighbours.push({x: coordinate.x + 2, y: coordinate.y - 2});
  neighbours.push({x: coordinate.x + 2, y: coordinate.y});
  neighbours.push({x: coordinate.x + 2, y: coordinate.y + 2});
  neighbours.push({x: coordinate.x, y: coordinate.y - 2});
  neighbours.push({x: coordinate.x, y: coordinate.y + 2});

  return neighbours;
}

class Flood {
  coordinate: Coordinate;
  value: number;

  constructor(coordinate: Coordinate, value: number) {
    this.coordinate = coordinate;
    this.value = value;
  }
}

function compare_floods(a: Flood, b: Flood): number {
  if(a.value !== b.value) {
    return a.value - b.value;
  }
  if(a.coordinate.x !== b.coordinate.x) {
    return a.coordinate.x - b.coordinate.x;
  }
  return a.coordinate.y - b.coordinate.y;
}

/* Function to generate an area of the seabed from which to generate height.
 * Areas not in the returned set will never be above the base seabed height. */
export function seed_points(tile_count: number): Set<string> {
  const sea: Set<string> = new Set();
  const open: SortedSet = new SortedSet([], compare_floods);

  for(let x = 0; x < tile_count; x += 2){
    let dx = Math.abs(x - tile_count / 2);
    let dy = tile_count / 2;
    let dist_from_center = dx * dx + dy * dy;

    let y = 0;
    open.push(new Flood({x, y}, dist_from_center));

    y = tile_count -2;
    open.push(new Flood({x, y}, dist_from_center));
  }
  for(let y = 0; y < tile_count; y += 2){
    let dx = tile_count / 2;
    let dy = Math.abs(y - tile_count / 2);
    let dist_from_center = dx * dx + dy * dy;

    let x = 0;
    open.push(new Flood({x, y}, dist_from_center));
    
    x = tile_count -2;
    open.push(new Flood({x, y}, dist_from_center));
  }

  while(open.length > 0) {
    const tile = open.pop();
    sea.add(coord_to_str(tile.coordinate));

    get_neighbours(tile.coordinate).forEach((neighbour) => {
      if(neighbour.x >= 0 && neighbour.x < tile_count &&
         neighbour.y >= 0 && neighbour.y < tile_count) {
        if(Math.random() < 0.21) {
          if(! sea.has(coord_to_str(neighbour))) {
            open.push(new Flood(neighbour, tile.value));
          }
        }
      }
    });
  }

  // Display the seed area in the console.
  let line = "   ";
  for(let i = 0; i < tile_count; i += 2) {
    if(i % 10 == 0) {
      line += "" + i;
      if(i < 10) {
        line += " ";
      }
    } else {
      line += "  ";
    }
  }
  console.log(line);
  for(let y = 0; y < tile_count; y += 2) {
    line = `${y} `;
    if(y < 10) {
      line += " ";
    }
    for(let x = tile_count - 2; x >= 0; x -= 2) {
      const key = coord_to_str({x, y});
      if(sea.has(key)) {
        line += "~ ";
      } else {
        line += "# ";
      }
    }
    console.log(line);
  }
  return sea;
}


