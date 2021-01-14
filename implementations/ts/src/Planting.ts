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

    if(random() < 0.2) {
      this.type_ = PlantType.Pine;
    } else {
      this.type_ = PlantType.Deciduous;
    }

    this.position = new BABYLON.Vector3(
      random() + this.positionBase.x, 0, random() + this.positionBase.z);
  }
}

export class Planting {
  readonly treesPerTile: number = 10;
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
    this.update();
  }

  noise_update(regenerate: boolean = false): void {
    console.time("Planting.noise_update");
    if(this.noise === undefined) {
      console.log("new Noise.");
      this.noise = new Noise("vegetation", this.config);
    } else {
      this.noise.generate(regenerate);
    }
    console.timeEnd("Planting.noise_update");
  }

  update(): void {
    console.time("Planting.update");
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
    for(let x = 0; x < this.noise.length; x++) {
      for(let y = 0; y < this.noise.length; y++) {
        for(let i = 0; i < this.treesPerTile; i++) {
          const plant = this.createPlant(x, y, river_width_mod, river_likelihood);
          if (plant) {
            this.set(x, y, plant);
          }
        }
      }
    }
    console.timeEnd("Planting.update");
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

  createPlant(
    keyX: number, keyY: number,
    river_width_mod: number, river_likelihood: number
  ): BABYLON.Nullable<Plant> {
    if(keyX >= this.tileCount - 1 || keyY >= this.tileCount - 1){
      return null;
    }

    const tile00 = this.geography.tiles[keyX][keyY];
    const tile10 = this.geography.tiles[keyX + 1][keyY];
    const tile01 = this.geography.tiles[keyX][keyY + 1];
    const tile11 = this.geography.tiles[keyX + 1][keyY + 1];

    // No trees under water.
    if(
        tile00.height < this.sealevel + this.shoreline ||
        tile10.height < this.sealevel + this.shoreline ||
        tile01.height < this.sealevel + this.shoreline ||
        tile11.height < this.sealevel + this.shoreline) {
      return null;
    }

    // Have both noise-map and drainage affect likelihood of trees growing.
    const noiseVal = (this.noise.get_value(keyX, keyY) * this.noise_effect * 5) +
    (Math.sqrt(Math.sqrt(
      tile00.dampness * tile01.dampness * tile10.dampness * tile11.dampness)) *
      this.dampness_effect / 10);
    if (noiseVal < 1) {
      return null;
    }

    let random: seedrandom.prng = seedrandom(`${noiseVal} ${this.count}`);
    const plant = new Plant(new BABYLON.Vector3(keyX, tile00.height, keyY), random);
    this.countByType[plant.type_]++;
    this.count++;

    const d = this.geography.distance_to_river(
      {x: plant.position.x, y: plant.position.z}, river_width_mod, river_likelihood);
    if ( d <= 0.0) {
      return null;
    }

    return plant;
  }
}

