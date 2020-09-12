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

import * as seedrandom from 'seedrandom';
import {SortedSet} from "./ordered_set"
import {Config} from "./config"


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

  neighbours.push({x: coordinate.x - 1, y: coordinate.y - 1});
  neighbours.push({x: coordinate.x - 1, y: coordinate.y});
  neighbours.push({x: coordinate.x - 1, y: coordinate.y + 1});
  neighbours.push({x: coordinate.x + 1, y: coordinate.y - 1});
  neighbours.push({x: coordinate.x + 1, y: coordinate.y});
  neighbours.push({x: coordinate.x + 1, y: coordinate.y + 1});
  neighbours.push({x: coordinate.x, y: coordinate.y - 1});
  neighbours.push({x: coordinate.x, y: coordinate.y + 1});

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

export function seed_points_to_array(
  tile_count: number, sea: Set<string>): Array<Array<number>> {
    let sea_array = [];
    for(let x = 0; x < tile_count; x++) {
      let row: Array<number> = [];
      for(let y = 0; y < tile_count; y++) {
        row.push(sea.has(coord_to_str({x, y}))? 1 : 0);
      }
      sea_array.push(row);
    }

    return sea_array;
}

/* Function to generate an area of seabed from which to generate land.
 * The points in the returned set will be the lowest points on the map.
 * ie: height===0.
 * This area of seabed will flood in from the edges of the map so will never
 * leave "lakes" surrounded by higher areas. */
export function seed_points(config: Config, tile_count: number): Set<string> {
  const seabed: Set<string> = new Set();
  const open: SortedSet = new SortedSet([], compare_floods);
  const random = seedrandom(config.get("seed_points.random_seed"));

  // Edge tiles on map should always be seed points.
  for(let x = 0; x < tile_count; x++){
    let dx = x - tile_count / 2;
    let dy = tile_count / 2;
    let dist_from_center = dx * dx + dy * dy;

    let y = 0;
    open.push(new Flood({x, y}, dist_from_center));

    y = tile_count - 1;
    open.push(new Flood({x, y}, dist_from_center));
  }
  for(let y = 0; y < tile_count; y++){
    let dx = tile_count / 2;
    let dy = y - tile_count / 2;
    let dist_from_center = dx * dx + dy * dy;

    let x = 0;
    open.push(new Flood({x, y}, dist_from_center));

    x = tile_count - 1;
    open.push(new Flood({x, y}, dist_from_center));
  }

  while(open.length > 0) {
    const tile = open.pop();
    seabed.add(coord_to_str(tile.coordinate));

    get_neighbours(tile.coordinate).forEach((neighbour) => {
      if(neighbour.x >= 0 && neighbour.x < tile_count &&
         neighbour.y >= 0 && neighbour.y < tile_count) {
        if(random() < config.get("seed_points.seed_threshold")) {
          if(! seabed.has(coord_to_str(neighbour))) {
            open.push(new Flood(neighbour, tile.value));
          }
        }
      }
    });
  }

  return seabed;
}

export function get_noise(config: Config, tile_count: number): Array<Array<number>> {
  const random = seedrandom(config.get("noise.random_seed"));
  let seed: Array<number> = [];
  for(let i = 0; i < 0xFF; i++) {
    seed.push(Math.sin(i * Math.PI / 0x7F));
  }

  let pass_x: Array<number> = [];
  let pass_y: Array<number> = [];
  let multiplier: Array<number> = [];

  let coefficient = 1000 / tile_count;
  for(let i = 0; i < Math.round(random() * 5); i++) {
    pass_x.push(random() * coefficient - coefficient / 2);
    pass_y.push(random() * coefficient - coefficient / 2);
    multiplier.push(1);
  }

  coefficient = 8000 / tile_count;
  for(let i = 0; i < Math.round(random() * 5); i++) {
    pass_x.push(random() * coefficient - coefficient / 2);
    pass_y.push(random() * coefficient - coefficient / 2);
    multiplier.push(0.5);
  }

  coefficient = 800;
  for(let i = 0; i < 10; i++) {
    pass_x.push(random() * coefficient - coefficient / 2);
    pass_y.push(random() * coefficient - coefficient / 2);
    multiplier.push(0.2);
  }

  let data: Array<Array<number>> = [];
  let min = 99999999999;
  let max = -99999999999;
  for(let y = 0; y < tile_count; y++){
    let row: Array<number> = [];
    for(let x = 0; x < tile_count; x++){
      let val = 0;
      pass_x.forEach((mod, index) => {
        val += multiplier[index] * seed[Math.round(mod * x + pass_y[index] * y) & 0xff - 1];
      });
      row.push(val);

      if(val > max) {
        max = val;
      } else if(val < min) {
        min = val;
      }
    }
    data.push(row);
  }

  // Normalize data.
  const range = max - min;
  for(let x = 0; x < tile_count; x++){
    for(let y = 0; y < tile_count; y++){
      data[x][y] -= min;
      data[x][y] /= range;
    }
  }

  return data;
}
