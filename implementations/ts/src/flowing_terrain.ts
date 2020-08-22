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
  tile_count: number = 200;
}

// A single point on the map.
export class Tile {
  pos: Coordinate = {x: -1, y: -1};
  height: number = -1;
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
}

// Data for a procedurally generated map.
export class Geography {
  tiles: Array<Array<Tile>> = [];
  enviroment: Enviroment = new Enviroment();
  open_set_sorted: SortedSet = new SortedSet([], this.compare_tiles);

  constructor() {
    // Populate tile array with un-configured Tile elements.
    for(let y = 0; y < this.enviroment.tile_count; y++) {
      let row: Array<Tile> = [];
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        row.push(new Tile({x, y}, this.enviroment));
      }
      this.tiles.push(row);
    }

    this.starting_points();
    this.heights_algorithm();
    this.diamond();
    this.square();
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
        if(neighbour.height < 0) {
          neighbour.height = tile.height + 0.01 + Math.random() * 3;
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
        if(tile.height > this.enviroment.sealevel) {
          this.open_set_sorted.push(tile);
        }
      }
    }

    this.enviroment.dampest = 0;
    while(this.open_set_sorted.length > 0) {
      const tile = this.open_set_sorted.shift();
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

      if(lowest_neighbour.dampness > this.enviroment.dampest) {
        this.enviroment.dampest = lowest_neighbour.dampness;
      }
    }
  }

  // Use Diamond-Square algorithm to fill intermediate heights to aid in 3D
  // tiling. https://en.wikipedia.org/wiki/Diamond-square_algorithm
  diamond(): void {
    for(let y = 1; y < this.enviroment.tile_count; y += 2) {
      for(let x = 1; x < this.enviroment.tile_count; x += 2) {
        const tile = this.get_tile({x, y});
        if(tile !== null) {
          console.assert(
            tile.height === -1,
            { errorMsg:"Tile already configured.", tile: tile.toString()});

          const tile00 = this.get_tile({x: x - 1, y: y - 1});
          const tile10 = this.get_tile({x: x + 1, y: y - 1});
          const tile01 = this.get_tile({x: x - 1, y: y + 1});
          const tile11 = this.get_tile({x: x + 1, y: y + 1});

          let average_height = 0;
          let count = 0;
          let lowest = this.enviroment.highest_point;
          if(tile00 !== null) {
            console.assert(
              tile00.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile00.toString()});
            average_height += tile00.height;
            count++;
          }
          if(tile10 !== null) {
            console.assert(
              tile10.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile10.toString()});
            average_height += tile10.height;
            count++;
          }
          if(tile01 !== null) {
            console.assert(
              tile01.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile01.toString()});
            average_height += tile01.height;
            count++;
          }
          if(tile11 !== null) {
            console.assert(
              tile11.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile11.toString()});
            average_height += tile11.height;
            count++;
          }
          tile.height = average_height / count;
        }
      }
    }
  }

  // Use Diamond-Square algorithm to fill intermediate heights to aid in 3D
  // tiling. https://en.wikipedia.org/wiki/Diamond-square_algorithm
  square(): void {
    for(let y = 0; y < this.enviroment.tile_count; y += 2) {
      for(let x = 0; x < this.enviroment.tile_count; x += 2) {
        // Already configured tiles to be averaged.
        const tile11 = this.get_tile({x, y});
        const tile20 = this.get_tile({x: x + 1, y: y - 1});
        const tile22 = this.get_tile({x: x + 1, y: y + 1});
        const tile31 = this.get_tile({x: x + 2, y: y + 0});
        const tile02 = this.get_tile({x: x - 1, y: y + 1});
        const tile13 = this.get_tile({x: x + 0, y: y + 2});

        // Un-configured tiles to be updated.
        const tile21 = this.get_tile({x: x + 1, y: y + 0});
        const tile12 = this.get_tile({x: x + 0, y: y + 1});

        let average_height = 0;
        let count = 0;

        if(tile21 !== null) {
          console.assert(
            tile21.height === -1,
            { errorMsg:"Tile already configured.", tile: tile21.toString()});

          if(tile11 !== null) {
            console.assert(
              tile11.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile11.toString()});
            average_height += tile11.height;
            count++;
          }
          if(tile20 !== null) {
            console.assert(
              tile20.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile20.toString()});
            average_height += tile20.height;
            count++;
          }
          if(tile22 !== null) {
            console.assert(
              tile22.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile22.toString()});
            average_height += tile22.height;
            count++;
          }
          if(tile31 !== null) {
            console.assert(
              tile31.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile31.toString()});
            average_height += tile31.height;
            count++;
          }

          tile21.height = average_height / count;
        }

        if(tile12 !== null) {
          console.assert(
            tile12.height === -1,
            { errorMsg:"Tile already configured.", tile: tile12.toString()});

          if(tile11 !== null) {
            console.assert(
              tile11.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile11.toString()});
            average_height += tile11.height;
            count++;
          }
          if(tile02 !== null) {
            console.assert(
              tile02.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile02.toString()});
            average_height += tile02.height;
            count++;
          }
          if(tile22 !== null) {
            console.assert(
              tile22.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile22.toString()});
            average_height += tile22.height;
            count++;
          }
          if(tile13 !== null) {
            console.assert(
              tile13.height !== -1,
              { errorMsg:"Tile not configured.", tile: tile13.toString()});
            average_height += tile13.height;
            count++;
          }

          tile12.height = average_height / count;
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

// 
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

