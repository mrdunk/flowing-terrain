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

export const enum PlantType {
  Pine,
  Deciduous,
  Thicket,
  Shrub,
}

export class Plant {
  type_: PlantType;
  height: number;
  positionBase: BABYLON.Vector3;
  position: BABYLON.Vector3;

  constructor(position: BABYLON.Vector3, random: seedrandom.prng) {
    this.positionBase = position;
    this.height = random() * 0.1 + 0.05;

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
  readonly treesPerTile: number = 5;
  geography: Geography;
  config: Config;
  noise: number[][];
  locations: Map<number, Map<number, Plant[]>>;
  countByType: number[];
  count: number;

  constructor(geography: Geography,
              config: Config,
              noise: number[][]) {
    this.geography = geography;
    this.config = config;
    this.noise = noise;
    this.countByType = [0, 0, 0, 0];
    this.locations = new Map();

    this.populate();
  }

  populate(): void {
    this.countByType = [0, 0, 0, 0];
    this.count = 0;
    for(let x = 0; x < this.noise.length; x++) {
      const row = this.noise[x];
      for(let y = 0; y < row.length; y++) {
        for(let i = 0; i < this.treesPerTile; i++) {
          this.set(x, y, this.createPlant(x, y));
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

  createPlant(keyX: number, keyY: number): BABYLON.Nullable<Plant> {
    const sealevel = this.config.get("geography.sealevel");
    const tileCount = this.config.get("enviroment.tile_count");

    if(keyX >= tileCount - 1 || keyY >= tileCount - 1){
      return null;
    }

    const tile00 = this.geography.tiles[keyX][keyY];
    const tile10 = this.geography.tiles[keyX + 1][keyY];
    const tile01 = this.geography.tiles[keyX][keyY + 1];
    const tile11 = this.geography.tiles[keyX + 1][keyY + 1];

    if(
        tile00.height < sealevel ||
        tile10.height < sealevel ||
        tile01.height < sealevel ||
        tile11.height < sealevel) {
      return null;
    }
    const noiseVal = this.noise[keyX][keyY];
    if(noiseVal < 0.05) {
      return null;
    }

    let random: seedrandom.prng = seedrandom(`${noiseVal} ${this.count}`);
    const plant = new Plant(new BABYLON.Vector3(keyX, tile00.height, keyY), random);
    this.countByType[plant.type_]++;
    this.count++;

    return plant;
  }
}

