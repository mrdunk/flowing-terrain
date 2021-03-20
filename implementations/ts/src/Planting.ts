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
import {Config} from "./config";
import {Geography, Tile} from "./flowing_terrain";
import {Noise} from "./genesis";

export const enum PlantType {
  Pine,
  Deciduous,
  // Thicket,
  // Shrub,
}

export class Plant {
  readonly heightMultiplier: number = 0.05;
  type_: PlantType;
  height: number;
  positionBase: BABYLON.Vector3;
  position: BABYLON.Vector3;

  constructor(position: BABYLON.Vector3, random: seedrandom.prng) {
    this.positionBase = position;
    this.height = (random() + 0.5 ) * this.heightMultiplier;

    if(position.y / 5 + random() > 1) {
      this.type_ = PlantType.Pine;
    } else {
      this.type_ = PlantType.Deciduous;
    }

    this.position = new BABYLON.Vector3(
      random() + position.x, 0, random() + position.z);
  }
}

export class Planting {
  readonly treesPerTile: number = 7;
  locations: Map<number, Map<number, Plant[]>>;
  countByType: [number, number, number, number];
  count: number;
  sealevel: number;
  shoreline: number;
  tileCount: number;
  noise_effect: number;
  dampness_effect: number;
  noise: Noise;

  constructor(private geography: Geography,
              private config: Config
  ) {
    console.assert(this.geography !== null);
    console.assert(this.config !== null);

    this.noise_update(true);
  }

  noise_update(regenerate: boolean = false): void {
    if(this.noise === undefined) {
      this.noise = new Noise("vegetation", this.config);
    } else {
      this.noise.generate(regenerate);
    }
  }

  average_tile(x: number, y: number): [boolean, number, number] {
    const tile00 = this.geography.tiles[x][y];
    const tile10 = this.geography.tiles[x + 1][y];
    const tile01 = this.geography.tiles[x][y + 1];
    const tile11 = this.geography.tiles[x + 1][y + 1];

    // This shore height does not take noise into account.
    // We will populate a few trees on or below the beach which will need culled
    // when we do the 3d render.
    // We wait until then because only the 3d render code knows the exact shape
    // of the shoreline.
    const shore_height = Math.max(this.shoreline + this.sealevel, this.sealevel);

    // Whole tile below water.
    const below_water = (
      tile00.height < shore_height &&
      tile10.height < shore_height &&
      tile01.height < shore_height &&
      tile11.height < shore_height);

    const dampness = ( tile00.dampness + tile10.dampness + tile01.dampness + tile11.dampness);

    const altitude = tile00.height;

    return [below_water, dampness, altitude];
  }

  * update(): Generator<null, void, boolean> {
    let generator_start_time = window.performance.now();

    this.sealevel = this.config.get("geography.sealevel");
    this.shoreline = this.config.get("geography.shoreline");
    this.tileCount = this.config.get("enviroment.tile_count");
    this.noise_effect = this.config.get("vegetation.noise_effect");
    this.dampness_effect = this.config.get("vegetation.dampness_effect");
    const river_width_mod = this.config.get("geography.riverWidth");
    const river_likelihood = this.config.get("geography.riverLikelihood");

    this.locations = new Map();
    this.countByType = [0, 0, 0, 0];
    this.count = 0;
    for(let x = 0; x < this.noise.length - 1; x++) {
      for(let y = 0; y < this.noise.length - 1; y++) {
        if(window.performance.now() - generator_start_time > 10) {
          yield;
          generator_start_time = window.performance.now()
        }

        const [below_water, dampness, altitude] = this.average_tile(x, y);
        if(below_water) {
          // Don't calculate the tree if the whole tile is below water.
          // This will add some trees lower than required which we cull when we
          // come to render the scene.
          continue;
        }

        // Have both noise-map and drainage affect likelihood of trees growing.
        const dampnessVal = this.dampness_effect *
          Math.min(10, Math.sqrt(dampness) - 10) / 20;
        const noiseVal = (this.noise.get_value(x, y) * this.noise_effect);

        for(let i = 0; i < Math.floor(this.treesPerTile * (1 + noiseVal + dampnessVal)); i++) {
          const plant = this.createPlant(x, y, altitude);

          const d = this.geography.distance_to_river(
            {x: plant.position.x, y: plant.position.z}, river_width_mod, river_likelihood);
          if ( d > 0.0) {
            // Not in river.
            this.set(x, y, plant);
          }
        }
      }
    }
  }

  set(keyX: number, keyY: number, value: BABYLON.Nullable<Plant>): void {
    let row: Map<number, Plant[]>;

    if(this.locations.has(keyX)) {
      row = this.locations.get(keyX);
    } else if(value !== null) {
      row = new Map<number, Plant[]>();
      this.locations.set(keyX, row);
    } else {
      return;
    }

    if(value === null) {
      row.delete(keyY);
    } else {
      let plants: Plant[] = [];
      if(row.has(keyY)) {
        plants = row.get(keyY);
      } else {
        row.set(keyY, plants);
      }
      if(value !== null) {
        plants.push(value);
      }
    }
  }

  get(keyX: number, keyY: number): Plant[] {
    if(! this.locations.has(keyX)) {
      return [];
    }

    let row = this.locations.get(keyX);

    if(! row.has(keyY)) {
      return [];
    }

    return row.get(keyY);
  }

  createPlant(x: number, y: number, altitude: number): BABYLON.Nullable<Plant> {

    const random: seedrandom.prng = seedrandom(`${x} ${y} ${this.count}`);
    const plant = new Plant(new BABYLON.Vector3(x, altitude, y), random);

    this.countByType[plant.type_]++;
    this.count++;

    return plant;
  }
}

