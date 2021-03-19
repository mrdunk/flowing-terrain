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

/* An algorithm for generating procedurally generated terrain where there is
 * always a downhill path to the sea from any tile.
 * See https://github.com/mrdunk/flowing-terrain for more information. */

import {SortedSet} from "./ordered_set"
import {draw_2d} from "./2d_view"
import {Config} from "./config"
import {Noise} from "./genesis";

export interface Coordinate {
  x: number;
  y: number;
}

// State to be shared between all classes.
export class Enviroment {
  highest_point: number = 0;
  //sealevel: number = 1;
  dampest: number = 0;
  wind_strength: number = 10;
  wind_direction: number = 5;
}

// A single point on the map.
export class Tile {
  pos: Coordinate = {x: -1, y: -1};
  height: number = null;
  dampness: number = 1;
  lowest_neighbour: Tile = null;
  enviroment: Enviroment;
  wave_height: number = 0;

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
  tiles: Tile[][] = [];
  open_set_sorted: SortedSet = new SortedSet([], this.compare_tiles);
  tile_count: number;
  enviroment: Enviroment;
  seed_points: Set<string>;
  noise: Noise;
  private generator_start_time: number;

  constructor(public config: Config) {
    this.tile_count = this.config.get("enviroment.tile_count");
  }

  // Calculate the terrain.
  * terraform(
    enviroment: Enviroment, seed_points: Set<string>, noise: Noise
  ): Generator<null, void, boolean> {
    this.enviroment = enviroment;
    this.seed_points = seed_points;
    this.noise = noise;

    this.enviroment.highest_point = 0;
    this.enviroment.dampest = 0;

    // Clear existing geography.
    this.tiles = [];
    this.open_set_sorted.clear();

    // Populate tile array with un-configured Tile elements.
    for(let x = 0; x < this.tile_count; x++) {
      const row: Tile[] = [];
      for(let y = 0; y < this.tile_count; y++) {
        const tile: Tile = new Tile({x, y}, this.enviroment);
        row.push(tile);
      }
      this.tiles.push(row);
    }

    this.generator_start_time = window.performance.now();
    const tasks = [this.starting_points, this.heights_algorithm, this.drainage_algorithm];
    for(const task of tasks) {
      const generator = task.bind(this)();
      while(generator && "next" in generator && !generator.next().done) {
        // If the callback is actually a yielding generator, yield here.
        yield;
      }
    }
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
    for(const coord of this.seed_points) {
      const [x_str, y_str] = coord.split(",");
      const x = parseInt(x_str, 10);
      const y = parseInt(y_str, 10);
      const tile = this.get_tile({x, y});
      console.assert(tile !== null, {x, y, tile});
      tile.height = 0;
      this.open_set_sorted.push(tile);
    }
  }

  // Populate all tiles with height data. Also set the sealevel.
  // While with the right implementation of an ordered set it wold be possible
  // to achieve O(n log n) here, my simple SortedSet is actually O(n) for
  // inserts. This makes this method is theoretically O(n^2) time complexity.
  // In practice though this makes little difference as the SortedSet is getting
  // drained as it is being populated so we typically never see anything like
  // "n" entries in it. Also many attempted inserts into SortedSet are
  // duplicates and are dealt with in o(log n) time.
  * heights_algorithm(): Generator<null, void, boolean> {
    const height_constant = this.config.get("terrain.height_constant");
    const noise_height_weight = this.config.get("terrain.noise_height_weight");
    const noise_height_polarize = this.config.get("terrain.noise_height_polarize");
    const noise_gradient_weight = this.config.get("terrain.noise_gradient_weight");
    const noise_gradient_polarize = this.config.get("terrain.noise_gradient_polarize");

    while(this.open_set_sorted.length) {
      if(window.performance.now() - this.generator_start_time > 10) {
        yield;
        this.generator_start_time = window.performance.now();
      }

      const tile = this.open_set_sorted.shift();
      this.get_neighbours(tile).forEach((neighbour) => {
        if(neighbour.height === null) {

          const x = tile.pos.x;
          const y = tile.pos.y;
          const nx = neighbour.pos.x;
          const ny = neighbour.pos.y;

          // Diagonal neighbours are further away so they should be affected more.
          const orientation_mod = (x !== nx && y !== ny) ? 1.414 : 1;

          // Basic value of the point on the noise map.
          const height_diff = noise_height_weight * Math.max(this.noise.get_value(x, y), 0);
          // Gradient of the slope between point and the one the algorithm is flooding out to.
          const unevenness = ( noise_gradient_weight * 2 *
            Math.max((this.noise.get_value(x, y) - this.noise.get_value(nx, ny)) + 0.03, 0));

          neighbour.height = tile.height + height_constant;
          neighbour.height += orientation_mod * Math.pow(height_diff, noise_height_polarize);
          neighbour.height += orientation_mod * Math.pow(unevenness, noise_gradient_polarize);

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
  * drainage_algorithm(): Generator<null, void, boolean> {
    this.open_set_sorted.clear();
    for(let y = 0; y < this.tile_count; y++) {
      for(let x = 0; x < this.tile_count; x++) {
        const tile = this.get_tile({x, y});
        this.open_set_sorted.push(tile);
      }
    }

    // Work through all tiles from the highest on the map downwards.
    this.enviroment.dampest = 0;
    while(this.open_set_sorted.length > 0) {
      if(window.performance.now() - this.generator_start_time > 10) {
        yield;
        this.generator_start_time = window.performance.now();
      }

      const tile = this.open_set_sorted.pop();
      if(tile.height === 0) {
        continue;
      }
      let lowest_neighbours: Tile[] = [];
      this.get_neighbours(tile).forEach((neighbour) => {
        if(neighbour !== null && neighbour.height < tile.height) {
          if(lowest_neighbours.length === 0) {
            lowest_neighbours = [neighbour];
          } else if(neighbour.height < lowest_neighbours[0].height) {
            lowest_neighbours = [neighbour];
          } else if(neighbour.height === lowest_neighbours[0].height) {
            lowest_neighbours.push(neighbour);
          }
        }
      });
      console.assert(lowest_neighbours.length !== 0);
      tile.lowest_neighbour = lowest_neighbours[lowest_neighbours.length -1];
      tile.lowest_neighbour.dampness += tile.dampness;

      if(tile.lowest_neighbour.dampness > this.enviroment.dampest &&
         tile.lowest_neighbour.height > 0) {
        this.enviroment.dampest = tile.lowest_neighbour.dampness;
      }
      console.assert(tile.lowest_neighbour.dampness > tile.dampness);
    }
  }

  get_tile(coordinate: Coordinate): Tile {
    if(coordinate.x < 0 ||
       coordinate.y < 0 ||
       coordinate.x >= this.tile_count ||
       coordinate.y >= this.tile_count) {
      return null;
    }
    return this.tiles[coordinate.x][coordinate.y];
  }

  get_neighbours(tile: Tile, filter: Boolean=true): Tile[] {
    const neighbours = [
      this.get_tile({x: tile.pos.x - 1, y: tile.pos.y - 1}),
      this.get_tile({x: tile.pos.x - 1, y: tile.pos.y}),
      this.get_tile({x: tile.pos.x - 1, y: tile.pos.y + 1}),
      this.get_tile({x: tile.pos.x, y: tile.pos.y - 1}),
      this.get_tile({x: tile.pos.x, y: tile.pos.y + 1}),
      this.get_tile({x: tile.pos.x + 1, y: tile.pos.y - 1}),
      this.get_tile({x: tile.pos.x + 1, y: tile.pos.y}),
      this.get_tile({x: tile.pos.x + 1, y: tile.pos.y + 1}),
    ];

    if (filter) {
      return neighbours.filter((neighbour) => neighbour !== null);
    }
    return neighbours;
  }

  // Distance from the center of a river.
  // This method presumes rivers do not strictly follow the correct lowest path
  // across the terrain but instead cut corners. Although this means they may
  // run uphill slightly where they cut a corner, the visual effect overall is
  // looks more realistic.
  distance_to_river(
    coordinate: Coordinate,
    river_width_mod: number,
    min_dampness: number
  ): number {
    function dist(a: Coordinate, b: Coordinate) {
      const dx = (a.x - b.x);
      const dy = (a.y - b.y);
      return Math.sqrt(dx * dx + dy * dy);
    }

    function dot(a: Coordinate, b: Coordinate): number {
      return a.x * b.x + a.y * b.y;
    }

    // For explanation of distance from line segment:
    // https://www.youtube.com/watch?v=PMltMdi1Wzg
    function dist_to_line(a: Coordinate, b: Coordinate, p: Coordinate): number {
      const len = dist(b, a);
      const pa = {x: p.x - a.x, y: p.y - a.y};
      const ba = {x: b.x - a.x, y: b.y - a.y};
      const h = Math.min(1, Math.max(0, dot(pa, ba) / (len * len)));
      return dist({x: 0, y: 0},
                  {x: pa.x - h * ba.x, y: pa.y - h * ba.y});
    }

    const c: Coordinate = {x: Math.floor(coordinate.x), y: Math.floor(coordinate.y)};
    const c00 = this.get_tile(c);
    const c01 = this.get_tile({x: c.x, y: c.y + 1});
    const c10 = this.get_tile({x: c.x + 1, y: c.y});
    const c11 = this.get_tile({x: c.x + 1, y: c.y + 1});

    let closest: number = 9999999999;
    let dampness: number = 0;

    const corners = [c00, c01, c10, c11];
    corners.forEach((corner) => {
      if (corner.dampness <= min_dampness) {
        return;
      }

      if (corner.lowest_neighbour === null) {
        return;
      }

      const p0: Coordinate = {x: corner.pos.x * 0.25 + corner.lowest_neighbour.pos.x * 0.75,
        y: corner.pos.y * 0.25 + corner.lowest_neighbour.pos.y * 0.75};
      const p1: Coordinate = {x: corner.pos.x * 0.75 + corner.lowest_neighbour.pos.x * 0.25,
        y: corner.pos.y * 0.75 + corner.lowest_neighbour.pos.y * 0.25};

      let d_sq = dist_to_line(p0, p1, coordinate);
      if (d_sq < closest) {
        closest = d_sq;
        dampness = corner.dampness;
      }

      this.get_neighbours(corner).forEach((higher_neighbour) => {
        if (higher_neighbour.lowest_neighbour !== corner) {
          return;
        }
        if (higher_neighbour.dampness <= min_dampness) {
          return;
        }

        const p2: Coordinate = {x: corner.pos.x * 0.75 + higher_neighbour.pos.x * 0.25,
          y: corner.pos.y * 0.75 + higher_neighbour.pos.y * 0.25};
        const p3: Coordinate = {x: corner.pos.x * 0.25 + higher_neighbour.pos.x * 0.75,
          y: corner.pos.y * 0.25 + higher_neighbour.pos.y * 0.75};
        d_sq = dist_to_line(p1, p2, coordinate);
        if (d_sq < closest) {
          closest = d_sq;
          dampness = higher_neighbour.dampness;
        }
        d_sq = dist_to_line(p2, p3, coordinate);
        if (d_sq < closest) {
          closest = d_sq;
          dampness = higher_neighbour.dampness;
        }
      });
    });

    // "5000" is the same constant we use in land.fragment.ts.
    const river_width = Math.sqrt(dampness) * river_width_mod / 5000;

    return closest - river_width;
  }

  set_wave_height(
    tile: Tile, to_windward: Tile[], wind_direction: number, sealevel: number
  ): void {
    if (to_windward[0] === null) {
      // Upwind edge of map.
      tile.wave_height = this.enviroment.wind_strength;
      return;
    }

    tile.wave_height = 0;
    for(let more of to_windward) {
      if(more === null) {
        tile.wave_height += this.enviroment.wind_strength;
      } else if(more.height <= sealevel) {
        tile.wave_height += more.wave_height;
      }
    }
    tile.wave_height /= to_windward.length;

    // Gain more waves the further down wind from land.
    tile.wave_height += (this.enviroment.wind_strength - tile.wave_height) / 32;
  }

  get_tiles_windward(wind_direction: number, tile: Tile) {
    const neighbours = this.get_neighbours(tile, false);
    let more: Tile[];
    let less: Tile;
    const same: Tile[] = [];
    switch (wind_direction) {
      case 0:  // N
        less = neighbours[4];
        more = [neighbours[3], neighbours[0], neighbours[5]];
        if(neighbours[1]) {
          same.push(neighbours[1]);
        }
        if(neighbours[6]) {
          same.push(neighbours[6]);
        }
        break;
      case 1:  // NE
        less = neighbours[7];
        more = [neighbours[0], neighbours[1], neighbours[3]];
        if(neighbours[2]) {
          same.push(neighbours[2]);
        }
        if(neighbours[5]) {
          same.push(neighbours[5]);
        }
        break;
      case 2:  // E
        less = neighbours[6];
        more = [neighbours[1], neighbours[0], neighbours[2]];
        if(neighbours[3]) {
          same.push(neighbours[3]);
        }
        if(neighbours[4]) {
          same.push(neighbours[4]);
        }
        break;
      case 3:  // SE
        less = neighbours[5];
        more = [neighbours[2], neighbours[1], neighbours[4]];
        if(neighbours[0]) {
          same.push(neighbours[0]);
        }
        if(neighbours[7]) {
          same.push(neighbours[7]);
        }
        break;
      case 4:  // S
        less = neighbours[3];
        more = [neighbours[4], neighbours[2], neighbours[7]];
        if(neighbours[1]) {
          same.push(neighbours[1]);
        }
        if(neighbours[6]) {
          same.push(neighbours[6]);
        }
        break;
      case 5:  // SW
        less = neighbours[0];
        more = [neighbours[7], neighbours[4], neighbours[6]];
        if(neighbours[2]) {
          same.push(neighbours[2]);
        }
        if(neighbours[5]) {
          same.push(neighbours[5]);
        }
        break;
      case 6:  // W
        less = neighbours[1];
        more = [neighbours[6], neighbours[5], neighbours[7]];
        if(neighbours[3]) {
          same.push(neighbours[3]);
        }
        if(neighbours[4]) {
          same.push(neighbours[4]);
        }
        break;
      case 7:  // NW
        less = neighbours[2];
        more = [neighbours[5], neighbours[3], neighbours[6]];
        if(neighbours[7]) {
          same.push(neighbours[7]);
        }
        if(neighbours[0]) {
          same.push(neighbours[0]);
        }
        break;
      default:
        console.assert(false, "Invalid wind direction");
    }
    return {same, more, less};
  }

  blow_wind(): void {
    const sealevel = this.config.get("geography.sealevel");
    console.log(this.enviroment.wind_direction);
    const open: Tile[] = [];
    let next_down_wind: Tile[] = [];
    const closed = new Set();

    // Get an up-wind starting point to start generating waves from.
    let x, y;
    switch (this.enviroment.wind_direction) {
      case 0:
      case 1:
        x = 0;
        y = 0;
        break;
      case 2:
      case 3:
        x = 0;
        y = this.tile_count - 1;
        break;
      case 4:
      case 5:
        x = this.tile_count - 1;
        y = this.tile_count - 1;
        break;
      case 6:
      case 7:
        x = this.tile_count - 1;
        y = 0;
        break;
      default:
        console.assert(false, "Invalid wind direction");
    }

    open.push(this.get_tile({x, y}));
    let tile: Tile;
    while(open.length > 0) {
      // Calculate tiles at same distance down wind.
      while(open.length > 0) {
        tile = open.pop();
        const windward = this.get_tiles_windward(this.enviroment.wind_direction, tile);
        this.set_wave_height(tile, windward.more, this.enviroment.wind_direction, sealevel);
        closed.add(tile);
        for(let same of windward.same) {
          if(!closed.has(same)) {
            open.push(same);
          }
        }
        if(windward.less !== null) {
          console.assert(!closed.has(windward.less));
          next_down_wind.push(windward.less);
        }
      }

      // Get any tile further down wind.
      while(next_down_wind.length > 0) {
        let t = next_down_wind.pop();
        const windward = this.get_tiles_windward(this.enviroment.wind_direction, t);
        if(windward.more[1] !== null && !closed.has(windward.more[1])) {
          open.push(windward.more[1]);
        }
        if(windward.more[2] !== null && !closed.has(windward.more[2])) {
          open.push(windward.more[2]);
        }
        if(open.length > 0) {
          break;
        }
        if(!closed.has(t)) {
          open.push(t);
          break;
        }
      }
    }

    console.assert(open.length === 0);
    closed.clear();


    if(false) {
      // Debug to console
      let line;
      for(let y = 0; y < 25; y++) {
        line = `${y} `.padStart(3, " ");
        //for(let x = this.tile_count - 1; x >= this.tile_count - 26; x--) {
        for(let x = 26; x >= 0; x--) {
          if(this.get_tile({x, y}).height >= sealevel) {
            line += "  #";
          } else {
            line += "   ";
          }
        }
        console.log(line);
      }

      console.log("");

      for(let y = 0; y < 25; y++) {
        line = `${y} `.padStart(3, " ");
        //for(let x = this.tile_count - 1; x >= this.tile_count - 26; x--) {
        for(let x = 26; x >= 0; x--) {
          const height = Math.round(this.get_tile({x, y}).wave_height);
          if(height > 0) {
            line += `${height}`.padStart(3, " ");
          } else {
            line += "   ";
          }
        }
        console.log(line);
      }
    }
  }
}

// Example to iterate over a Geography object.
export class DisplayBase {
  protected config: Config;
  protected generator_start_time: number;
  tile_count: number;

  constructor(protected geography: Geography) {
    this.config = this.geography.config;
    this.tile_count = this.config.get("enviroment.tile_count");
  }

  // Access all points in Geography and call `draw_tile(...)` method on each.
  * draw(): Generator<null, void, boolean> {
    this.generator_start_time = window.performance.now();

    let generator = this.draw_start();
    while(!generator.next().done) {
      // If the callback is actually a yielding generator, yield here.
      yield;
    }

    for(let y = 0; y < this.tile_count; y += 1) {
      for(let x = 0; x < this.tile_count; x += 1) {
        if(window.performance.now() - this.generator_start_time > 10) {
          yield;
          this.generator_start_time = window.performance.now()
        }

        const tile = this.geography.get_tile({x, y});
        this.draw_tile(tile);
      }
    }

    yield;
    this.generator_start_time = window.performance.now()

    generator = this.draw_end();
    while(!generator.next().done) {
      // If the callback is actually a yielding generator, yield here.
      yield;
    }
  }

  // Called before iteration through map's points.
  * draw_start(): Generator<null, void, boolean> {
    // Override this method with display set-up related code.
  }

  // Called after iteration through map's points.
  * draw_end(): Generator<null, void, boolean> {
    // Override this method with code to draw whole map and cleanup.
  }

  // Called once per point on the map.
  draw_tile(tile: Tile): void {
    // Override this method with code to draw one point on the map.
    console.info(tile);
  }
}

