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

/* An algorithm for generating procedurally generated terrain where there is
 * always a downhill path to the sea from any tile.
 * See https://github.com/mrdunk/flowing-terrain for more information. */

import {SortedSet} from "./ordered_set"
import {seed_points} from "./genesis"

export interface Coordinate {
  x: number;
  y: number;
}

// State to be shared between all classes.
export class Enviroment {
  highest_point: number = 0;
  sealevel: number = 1;
  dampest: number = 0;
  tile_count: number = 100;
}

// A single point on the map.
export class Tile {
  pos: Coordinate = {x: -1, y: -1};
  height: number = null;
  dampness: number = 1;
  lowest_neighbour: Tile = null;
  enviroment: Enviroment;

  constructor(pos: Coordinate, enviroment: Enviroment) {
    this.pos = pos;
    this.enviroment = enviroment;
  }

  toString(): string {
    return `x: ${this.pos.x} y: ${this.pos.y}, height: ${this.height}`;
  }

  key(): string {
    return `${this.pos.x},${this.pos.y}`
  }
}

// Data for a procedurally generated map.
export class Geography {
  tiles: Array<Array<Tile>> = [];
  enviroment: Enviroment = new Enviroment();
  open_set_sorted: SortedSet = new SortedSet([], this.compare_tiles);

  constructor() {
    const t0 = performance.now();
    // Populate tile array with un-configured Tile elements.
    for(let y = 0; y < this.enviroment.tile_count; y++) {
      let row: Array<Tile> = [];
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        const tile: Tile = new Tile({x, y}, this.enviroment);
        row.push(tile);
      }
      this.tiles.push(row);
    }

    this.starting_points();
    this.heights_algorithm();
    this.drainage_algorithm();

    const t1 = performance.now();
    console.log(`Generating Geography took: ${t1 - t0}ms`);
  }

  // Used for sorting tiles according to height.
  compare_tiles(a: any, b: any): number {
    let diff = a.height - b.height;
    if(diff !== 0) {
      return diff;
    }
    diff = a.pos.x - b.pos.x;
    if(diff !== 0) {
      return diff;
    }
    diff = a.pos.y - b.pos.y;
    return diff;
  }

  // Set seed heights on map to start the height generation algorithm at.
  // These points will be at height===0.
  starting_points(): void {
    const sea = seed_points(this.enviroment.tile_count);
    for(let coord of sea) {
      const [x_str, y_str] = coord.split(",");
      const x = parseInt(x_str);
      const y = parseInt(y_str);
      const tile = this.get_tile({x, y});
      console.assert(tile !== null, {x, y, tile});
      tile.height = 0;
      this.open_set_sorted.push(tile);
    }
  }

  // Populate all tiles with height data. Also set the sealevel.
  heights_algorithm(): void {
    while(this.open_set_sorted.length) {
      let tile = this.open_set_sorted.shift();
      this.get_neighbours(tile, 1).forEach((neighbour) => {
        if(neighbour.height === null) {
          neighbour.height = tile.height + 0.1 + Math.random() * 1;
          this.open_set_sorted.push(neighbour);
        }
        if(neighbour.height > this.enviroment.highest_point) {
          this.enviroment.highest_point = neighbour.height;
        }
      });
    }
  }

  // Calculate the number of uphill tiles draining into each tile on the
  // map. High tile.dampness values indicate a river runs through that tile.
  drainage_algorithm(): void {
    this.open_set_sorted.clear();
    for(let y = 0; y < this.enviroment.tile_count; y++) {
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        const tile = this.get_tile({x, y});
        this.open_set_sorted.push(tile);
      }
    }

    // Work through all tiles from the highest on the map downwards.
    this.enviroment.dampest = 0;
    while(this.open_set_sorted.length > 0) {
      const tile = this.open_set_sorted.pop();
      if(tile.height === 0) {
        continue;
      }
      let lowest_neighbour: Tile = null;
      this.get_neighbours(tile, 1).forEach((neighbour) => {
        if(neighbour !== null && neighbour.height < tile.height) {
          if(lowest_neighbour === null || neighbour.height < lowest_neighbour.height) {
            lowest_neighbour = neighbour;
          }
        }
      });
      console.assert(lowest_neighbour !== null );
      lowest_neighbour.dampness += tile.dampness;
      tile.lowest_neighbour = lowest_neighbour;

      if(lowest_neighbour.dampness > this.enviroment.dampest &&
         lowest_neighbour.height > 0) {
        this.enviroment.dampest = lowest_neighbour.dampness;
      }
      console.assert(lowest_neighbour.dampness > tile.dampness);
    }
  }

  get_tile(coordinate: Coordinate): Tile {
    if(coordinate.x < 0 ||
       coordinate.y < 0 ||
       coordinate.x >= this.enviroment.tile_count ||
       coordinate.y >= this.enviroment.tile_count) {
      return null;
    }
    return this.tiles[coordinate.y][coordinate.x];
  }

  get_neighbours(tile: Tile, offset: number): Array<Tile> {
    let neighbours = [
      this.get_tile({x: tile.pos.x - offset, y: tile.pos.y - offset}),
      this.get_tile({x: tile.pos.x - offset, y: tile.pos.y}),
      this.get_tile({x: tile.pos.x - offset, y: tile.pos.y + offset}),
      this.get_tile({x: tile.pos.x, y: tile.pos.y - offset}),
      this.get_tile({x: tile.pos.x, y: tile.pos.y + offset}),
      this.get_tile({x: tile.pos.x + offset, y: tile.pos.y - offset}),
      this.get_tile({x: tile.pos.x + offset, y: tile.pos.y}),
      this.get_tile({x: tile.pos.x + offset, y: tile.pos.y + offset}),
    ];

    return neighbours.filter((neighbour) => neighbour !== null);
  }
}

// Example to iterate over a Geography object.
export class DisplayBase {
  geography: Geography;
  enviroment: Enviroment;

  constructor() {
  }

  // Access all points in Geography and call `draw_tile(...)` method on each.
  draw(): void {
    this.geography = new Geography();
    this.enviroment = this.geography.enviroment;

    this.draw_start();
    for(let y = 0; y < this.enviroment.tile_count; y += 1) {
      for(let x = 0; x < this.enviroment.tile_count; x += 1) {
        const tile = this.geography.get_tile({x, y});
        this.draw_tile(tile);
        //this.draw_river(tile, tile.lowest_neighbour);
      }
    }
    this.draw_end();
  }

  // Called before iteration through map's points.
  draw_start(): void {
    // Override this method with display set-up related code.
  }

  // Called after iteration through map's points.
  draw_end(): void {
    // Override this method with code to draw whole map and cleanup.
  }

  // Called once per point on the map.
  draw_tile(tile: Tile): void {
    // Override this method with code to draw one point on the map.
    console.log(tile);
  }

  draw_river(a: Tile, b: Tile): void {
  }
}

