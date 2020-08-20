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

class Enviroment {
  highest_point: number = 0;
  sealevel: number = 0;
  dampest: number = 0;
  tile_count: number = 100;
}

export class Tile {
  pos: Coordinate = {x: -1, y: -1};
  height: number = -1;
  dampness: number = 1;
  enviroment: Enviroment;

  constructor(pos: Coordinate, enviroment: Enviroment) {
    this.pos = pos;
    this.enviroment = enviroment;
  }

  toString(): string {
    return `x: ${this.pos.x} y: ${this.pos.y}, height: ${this.height}`;
  }
}

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
  }

  compare_tiles(a: any, b: any): number {
    let diff = a.height - b.height;
    if(diff != 0) {
      return diff;
    }
    diff = a.pos.x - b.pos.x;
    if(diff != 0) {
      return diff;
    }
    diff = a.pos.y - b.pos.y;
    return diff;
  }

  // Set seed heights on map to start the height generation algorithm at.
  starting_points(): void {
    for(let x = 0; x < this.enviroment.tile_count; x++) {
      let top = this.get_tile({x, y: 0});
      top.height = 0;
      this.open_set_sorted.push(top);

      let bottom = this.get_tile({x, y: (this.enviroment.tile_count - 1)});
      bottom.height = 0;
      this.open_set_sorted.push(bottom);
    }
    for(let y = 0; y < this.enviroment.tile_count; y++) {
      let top = this.get_tile({x: 0, y});
      top.height = 0;
      this.open_set_sorted.push(top);

      let bottom = this.get_tile({x: (this.enviroment.tile_count - 1), y});
      bottom.height = 0;
      this.open_set_sorted.push(bottom);
    }

    let random_low_points = Math.round(Math.random() * this.enviroment.tile_count / 2);
    for(let count = 0; count < random_low_points; count++){
      let tile = this.get_tile({
        x: Math.round(Math.random() * (this.enviroment.tile_count - 1)),
        y: Math.round(Math.random() * (this.enviroment.tile_count - 1))});
      tile.height = 0;
      this.open_set_sorted.push(tile);
    }
  }

  // Populate all tiles with height data. Also set the sealevel.
  heights_algorithm(): void {
    while(this.open_set_sorted.length) {
      let tile = this.open_set_sorted.shift();
      this.get_neighbours(tile).forEach((neighbour) => {
        if(neighbour.height < 0) {
          neighbour.height = tile.height + 0.01 + Math.random() * 3;
          this.open_set_sorted.push(neighbour);
        }
        if(neighbour.height > this.enviroment.highest_point) {
          this.enviroment.highest_point = neighbour.height;
        }
      });
    }

    this.enviroment.sealevel = this.enviroment.highest_point / (1 + Math.random() * 4);

    for(let y = 0; y < this.enviroment.tile_count; y++) {
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        let tile = this.get_tile({x, y});
        tile.height -= this.enviroment.sealevel;
        //console.log(tile.toString());
      }
    }
    this.enviroment.highest_point -= this.enviroment.sealevel;
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

  get_neighbours(tile: Tile): Array<Tile> {
    let neighbours = [
      this.get_tile({x: tile.pos.x - 1, y: tile.pos.y - 1}),
      this.get_tile({x: tile.pos.x - 1, y: tile.pos.y}),
      this.get_tile({x: tile.pos.x - 1, y: tile.pos.y + 1}),
      this.get_tile({x: tile.pos.x, y: tile.pos.y - 1}),
      this.get_tile({x: tile.pos.x, y: tile.pos.y + 1}),
      this.get_tile({x: tile.pos.x + 1, y: tile.pos.y - 1}),
      this.get_tile({x: tile.pos.x + 1, y: tile.pos.y}),
      this.get_tile({x: tile.pos.x + 1, y: tile.pos.y + 1}),
    ];

    return neighbours.filter((neighbour) => neighbour !== null);
  }
}

export class Display {
  geography: Geography;
  enviroment: Enviroment;

  constructor(geography: Geography) {
    this.geography = geography;
    this.enviroment = geography.enviroment;
  }
  
  draw(): void {
    this.draw_start();
    for(let y = 0; y < this.enviroment.tile_count; y++) {
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        this.draw_tile({x, y});
      }
    }
    this.draw_end();
  }

  draw_start(): void {
  }

  draw_end(): void {
  }

  draw_tile(coordinate: Coordinate) {
    let tile = this.geography.get_tile(coordinate);
    console.log(tile);
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
      } else if(comp == 0) {
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
      } else if(comp == 0) {
        // Value matches one in set.
        return mid;
      } else {
        right = mid;
      }
    }
    return NaN;
  }

  has(value: any): boolean {
    return this.get_index(value) != NaN;
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
}

