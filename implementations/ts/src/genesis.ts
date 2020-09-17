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
function get_neighbours(coordinate: Coordinate): Coordinate[] {
  const neighbours: Coordinate[] = [];

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
  tile_count: number, sea: Set<string>): number[][] {
    const sea_array = [];
    for(let x = 0; x < tile_count; x++) {
      const row: number[] = [];
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
    const dx = x - tile_count / 2;
    const dy = tile_count / 2;
    const dist_from_center = dx * dx + dy * dy;

    let y = 0;
    open.push(new Flood({x, y}, dist_from_center));

    y = tile_count - 1;
    open.push(new Flood({x, y}, dist_from_center));
  }
  for(let y = 0; y < tile_count; y++){
    const dx = tile_count / 2;
    const dy = y - tile_count / 2;
    const dist_from_center = dx * dx + dy * dy;

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
        if(random() < config.get("seed_points.threshold")) {
          if(! seabed.has(coord_to_str(neighbour))) {
            open.push(new Flood(neighbour, tile.value));
          }
        }
      }
    });
  }

  return seabed;
}

export class Noise {
  config: Config;

  coefficients_low: number[][];
  coefficients_mid: number[][];
  coefficients_high: number[][];

  data_low: number[][];
  data_mid: number[][];
  data_high: number[][];
  data_combined: number[][];

  constructor(config: Config) {
    this.config = config;
  }

  set_octave(octave: string) {
    const tile_count = this.config.get("enviroment.tile_count");
    let scale: number = 1;
    let coefficients: number[][] = null;
    let coefficients_x: number[] = null;
    let coefficients_y: number[] = null;
    let random: seedrandom.prng = null;

    switch (octave) {
      case "low":
        scale = 20 / tile_count;
        this.coefficients_low = [];
        coefficients = this.coefficients_low;
        random = seedrandom(this.config.get("noise.random_seed_low"));
        break;
      case "mid":
        scale = 100 / tile_count;
        this.coefficients_mid = [];
        coefficients = this.coefficients_mid;
        random = seedrandom(this.config.get("noise.random_seed_mid"));
        break;
      case "high":
        scale = 10;
        this.coefficients_high = [];
        coefficients = this.coefficients_high;
        random = seedrandom(this.config.get("noise.random_seed_high"));
        break;
      default:
        console.trace();
    }

    // Get ranges of octaves to use from config.
    const octave_count = this.config.get(`noise.${octave}_octave`);

    for(let i = 0; i < octave_count; i++) {
      coefficients.push([random() * scale - scale / 2,
                         random() * scale - scale / 2]);
    }
  }

  generate_octave(octave: string): void {
    const tile_count = this.config.get("enviroment.tile_count");

    let weight: number = 1;
    let coefficients: number[][] = null;
    let coefficients_x: number[] = null;
    let coefficients_y: number[] = null;
    let data: number[][] = null;

    switch (octave) {
      case "low":
        weight = this.config.get("noise.low_octave_weight");
        coefficients = this.coefficients_low;
        this.data_low = [];
        data = this.data_low;
        break;
      case "mid":
        weight = this.config.get("noise.mid_octave_weight");
        coefficients = this.coefficients_mid;
        this.data_mid = [];
        data = this.data_mid;
        break;
      case "high":
        weight = this.config.get("noise.high_octave_weight");
        coefficients = this.coefficients_high;
        this.data_high = [];
        data = this.data_high;
        break;
      default:
        console.trace();
    }

    for(let y = 0; y < tile_count; y++){
      const row: number[] = [];
      for(let x = 0; x < tile_count; x++){
        let val = 0;
        coefficients.forEach((both) => {
          const coef_x = both[0];
          const coef_y = both[1];
          val += Math.sin(coef_x * x + coef_y * y);
        });
        if(coefficients.length > 0) {
          // Normalize output.
          val /= Math.sqrt(coefficients.length);
        }
        val *= weight;
        row.push(val);
      }
      data.push(row);
    }
  }

  combine_octaves(): void {
    const tile_count = this.config.get("enviroment.tile_count");
    this.data_combined = [];

    for(let y = 0; y < tile_count; y++){
      const row: number[] = [];
      for(let x = 0; x < tile_count; x++){
        const val = (this.data_low[y][x] + this.data_mid[y][x] + this.data_high[y][x]) / 3;
        row.push(val);
      }
      this.data_combined.push(row);
    }
  }

  generate(regenerate: boolean = false) {
    if(regenerate) {
      // Do not use same values again.
      this.config.set("noise.random_seed_low", `low ${(new Date()).getTime()}`);
      this.config.set("noise.random_seed_mid", `mid ${(new Date()).getTime()}`);
      this.config.set("noise.random_seed_high", `high ${(new Date()).getTime()}`);
    }

    // TODO: Calculate what needs updating and do just that.
    let octave = "all";

    switch (octave) {
      case "low":
      case "mid":
      case "high":
        this.set_octave(octave);
        this.generate_octave(octave);
        break;
      case "all":
        this.set_octave("low");
        this.set_octave("mid");
        this.set_octave("high");
        this.generate_octave("low");
        this.generate_octave("mid");
        this.generate_octave("high");
        break;
      default:
        console.trace();
    }
    this.combine_octaves();
  }

  text(element: HTMLElement): void {
    const line = (weight: number, x: number, y: number): string => {
      x = Math.round(x * 100) / 100;
      y = Math.round(y * 100) / 100;
      const formula = `${weight} * sin(${x}x + ${y}y)`;
      return `<code class="text-dark">&nbsp;&nbsp;+ ${formula}</code><br>`;
    };

    let coefficients_x: number[] = null;
    let coefficients_y: number[] = null;
    let text: string = "<code class='text-dark'>height =</code><br>";
    let weight: number = 0;

    weight = this.config.get("noise.low_octave_weight");
    if(weight > 0) {
      text += "<code class='text-info'>// low frequency</code><br>";
      this.coefficients_low.forEach((both) => {
        text += line(weight, both[0], both[1]);
      });
    }

    weight = this.config.get("noise.mid_octave_weight");
    if(weight > 0) {
      text += "<code class='text-info'>// mid frequency</code><br>";
      this.coefficients_mid.forEach((both) => {
        text += line(weight, both[0], both[1]);
      });
    }

    weight = this.config.get("noise.high_octave_weight");
    if(weight > 0) {
      text += "<code class='text-info'>// high frequency</code><br>";
      this.coefficients_high.forEach((both) => {
        text += line(weight, both[0], both[1]);
      });
    }

    element.innerHTML = text;
  }
}
