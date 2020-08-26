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

export interface Coordinate {
  x: number;
  y: number;
}

// State to be shared between all classes.
class Enviroment {
  highest_point: number = 0;
  sealevel: number = 0;
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
    this.diamond();
    this.square();

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
  starting_points(): void {
    for(let x = 0; x < this.enviroment.tile_count; x += 2) {
      const top = this.get_tile({x, y: 0});
      top.height = 0;
      this.open_set_sorted.push(top);

      const bottom = this.get_tile({x, y: (this.enviroment.tile_count - 2)});
      bottom.height = 0;
      this.open_set_sorted.push(bottom);
    }
    for(let y = 0; y < this.enviroment.tile_count; y += 2) {
      const top = this.get_tile({x: 0, y});
      top.height = 0;
      this.open_set_sorted.push(top);

      const bottom = this.get_tile({x: (this.enviroment.tile_count - 2), y});
      bottom.height = 0;
      this.open_set_sorted.push(bottom);
    }

    let random_low_points = Math.round(Math.random() * this.enviroment.tile_count / 2);
    for(let count = 0; count < random_low_points; count++){
      const x = Math.round(Math.round(Math.random() * (this.enviroment.tile_count - 2)) / 2) * 2;
      const y = Math.round(Math.round(Math.random() * (this.enviroment.tile_count - 2)) / 2) * 2;
      console.assert(x % 2 === 0);
      console.assert(y % 2 === 0);
      const tile = this.get_tile({x, y});
      console.assert(tile !== null, {x, y});
      tile.height = 0;
      this.open_set_sorted.push(tile);
    }
  }

  // Populate all tiles with height data. Also set the sealevel.
  heights_algorithm(): void {
    while(this.open_set_sorted.length) {
      let tile = this.open_set_sorted.shift();
      this.get_neighbours(tile, 2).forEach((neighbour) => {
        if(neighbour.height === null) {
          neighbour.height = tile.height + 0.1 + Math.random() * 1;
          this.open_set_sorted.push(neighbour);
        }
        if(neighbour.height > this.enviroment.highest_point) {
          this.enviroment.highest_point = neighbour.height;
        }
      });
    }

    this.enviroment.sealevel = this.enviroment.highest_point / (1.5 + Math.random() * 4);

    for(let y = 0; y < this.enviroment.tile_count; y += 2) {
      for(let x = 0; x < this.enviroment.tile_count; x += 2) {
        let tile = this.get_tile({x, y});
        tile.height -= this.enviroment.sealevel;
        //console.log(tile.toString());
      }
    }
    this.enviroment.highest_point -= this.enviroment.sealevel;
  }

  // Calculate the number of uphill tiles draining into each tile on the
  // map. High tile.dampness values indicate a river runs through that tile.
  drainage_algorithm(): void {
    this.open_set_sorted.clear();
    for(let y = 0; y < this.enviroment.tile_count; y += 2) {
      for(let x = 0; x < this.enviroment.tile_count; x += 2) {
        const tile = this.get_tile({x, y});
        // If we don't consider the heights below sealevel we get isolated pools
        // along the coastline when drawing 3D views due to the averaging of
        // heights at the meeting points of tiles in the `diamond()` method.
        if(tile.height > -this.enviroment.sealevel) {
          this.open_set_sorted.push(tile);
        }
      }
    }

    // Work through all tiles from the highest on the map downwards.
    this.enviroment.dampest = 0;
    while(this.open_set_sorted.length > 0) {
      const tile = this.open_set_sorted.pop();
      let lowest_neighbour: Tile = null;
      this.get_neighbours(tile, 2).forEach((neighbour) => {
        if(neighbour !== null && neighbour.height < tile.height) {
          if(lowest_neighbour === null || neighbour.height < lowest_neighbour.height) {
            lowest_neighbour = neighbour;
          }
        }
      });
      console.assert(lowest_neighbour !== null);
      lowest_neighbour.dampness += tile.dampness;
      tile.lowest_neighbour = lowest_neighbour;

      if(lowest_neighbour.dampness > this.enviroment.dampest &&
         lowest_neighbour.height > 0) {
        this.enviroment.dampest = lowest_neighbour.dampness;
      }
      console.assert(lowest_neighbour.dampness> tile.dampness);
    }
  }

  // Use Diamond-Square algorithm to fill intermediate heights for corners of
  // map tiles when drawing in 3D.
  // https://en.wikipedia.org/wiki/Diamond-square_algorithm
  diamond(): void {
    for(let y = 1; y < this.enviroment.tile_count; y += 2) {
      for(let x = 1; x < this.enviroment.tile_count; x += 2) {
        const tile = this.get_tile({x, y});
        if(tile === null) {
          continue;
        }

        // Diagonal neighbours.
        const tile00 = this.get_tile({x: x - 1, y: y - 1});
        const tile10 = this.get_tile({x: x + 1, y: y - 1});
        const tile01 = this.get_tile({x: x - 1, y: y + 1});
        const tile11 = this.get_tile({x: x + 1, y: y + 1});
        const tiles = [];
        if(tile00 !== null) {
          tiles.push(tile00);
        }
        if(tile10 !== null) {
          tiles.push(tile10);
        }
        if(tile01 !== null) {
          tiles.push(tile01);
        }
        if(tile11 !== null) {
          tiles.push(tile11);
        }

        const tiles_set = new Set(tiles);
        const drain_from: Array<Tile> = [];
        let drain_to: Tile = null;
        let highest = -this.enviroment.sealevel;
        let lowest = this.enviroment.highest_point;
        let lowest_drain_from = this.enviroment.highest_point;

        tiles.forEach((tile_from) => {
          if(tile_from.lowest_neighbour !== null) {
            if(tiles_set.has(tile_from.lowest_neighbour)) {
              drain_from.push(tile_from);

              console.assert(drain_to === null || drain_to === tile_from.lowest_neighbour);
              drain_to = tile_from.lowest_neighbour;

              if(tile_from.height < lowest_drain_from) {
                lowest_drain_from = tile_from.height;
              }
            }
          }
          if(tile_from.height > highest) {
            highest = tile_from.height;
          }
          if(tile_from.height < lowest) {
            lowest = tile_from.height;
          }
        });

        if(drain_from.length <= 0) {
          // No complicated rivers to worry about. Set height to whatever we
          // want (as long as it doesn't create a depression).
          tile.height = Math.random() * (highest - lowest) + lowest;
        } else {
          console.assert(lowest_drain_from >= lowest);
          tile.height = Math.random() * (lowest_drain_from - lowest) + lowest;
          //tile.height = lowest;
        }
      }
    }
  }

  // Use Diamond-Square algorithm to fill intermediate heights to aid in 3D
  // tiling. https://en.wikipedia.org/wiki/Diamond-square_algorithm
  // This is not the "classic" square stage as we only need to consider
  // the original heights, not those calculated in the "diamond" stage.
  square(): void {
    for(let y = 0; y <= this.enviroment.tile_count; y += 2) {
      for(let x = 0; x <= this.enviroment.tile_count; x += 2) {
        // Already configured tiles to be averaged.
        const tile00 = this.get_tile({x: x + 0, y: y + 0});
        const tile20 = this.get_tile({x: x + 2, y: y + 0});
        const tile02 = this.get_tile({x: x + 0, y: y + 2});

        // Un-configured tiles to be updated.
        const tile10 = this.get_tile({x: x + 1, y: y + 0});
        const tile01 = this.get_tile({x: x + 0, y: y + 1});

        if(tile00 === null) {
          continue;
        }

        if(tile20 !== null) {
          tile10.height = (tile00.height + tile20.height) / 2;
        } else {
          tile10.height = tile00.height;
        }

        if(tile02 !== null) {
          tile01.height = (tile00.height + tile02.height) / 2;
        } else {
          tile01.height = tile00.height;
        }
      }
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

  constructor(geography: Geography) {
    this.geography = geography;
    this.enviroment = geography.enviroment;
  }

  // Access all points in Geography and call `draw_tile(...)` method on each.
  draw(): void {
    this.draw_start();
    for(let y = 0; y < this.enviroment.tile_count; y += 2) {
      for(let x = 0; x < this.enviroment.tile_count; x += 2) {
        const tile = this.geography.get_tile({x, y});
        this.draw_tile(tile);
        this.draw_river(tile, tile.lowest_neighbour);
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

class SortedSet {
  compare: (a: any, b: any) => number;
  values: Array<any> = [];
  length: number;

  constructor(values: Array<any>, compare: (a: any, b: any) => number) {
    this.compare = compare;
    //this.values = values.sort(this.compare);
    values.forEach((v) => this.push(v));
  }

  push(value: any) {
    let left = 0;
    let right = this.length;
    while(right > left) {
      let mid = Math.round((left + right - 1) / 2);
      let comp = this.compare(value, this.values[mid]);
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
    this.values.splice(left, 0, value);
    this.length = this.values.length;
  }

  get_index(value: any): number {
    let left = 0;
    let right = this.length;
    while(right > left) {
      let mid = Math.round((left + right - 1) / 2);
      let comp = this.compare(value, this.values[mid]);
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
    return this.get_index(value) !== NaN;
  }

  pop() {
    // Return highest value.
    let val = this.values.pop();
    this.length = this.values.length;
    return val;
  }

  shift() {
    // Return lowest value.
    let val = this.values.shift();
    this.length = this.values.length;
    return val;
  }

  clear() {
    this.values = [];
    this.length = 0;
  }
}

