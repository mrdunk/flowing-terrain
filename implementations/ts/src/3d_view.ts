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

/* A sample frontend for the algorithm described at
 * https://github.com/mrdunk/flowing-terrain */

import * as BABYLON from 'babylonjs';
import {Geography, Tile, DisplayBase, Coordinate} from "./flowing_terrain"


export class Display_3d extends DisplayBase {
  tile_size: number = 2;
  river_threshold = 3;
  positions: Array<number> = [];
  indices: Array<number> = [];
  normals: Array<number> = [];
  rivers: Array<Array<BABYLON.Vector3>> = [];
  sea_mesh: BABYLON.Mesh;
  rivers_mesh: BABYLON.Mesh;
  update_rivers_timer: ReturnType<typeof setTimeout> = 0;

  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.UniversalCamera;

  constructor(geography: Geography) {
    super(geography);

    const renderCanvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(renderCanvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.camera = new BABYLON.UniversalCamera(
      "UniversalCamera",
      new BABYLON.Vector3(0, 0, 0),
      this.scene);

    const mapsize = this.tile_size * this.geography.enviroment.tile_count;
    this.camera.position = new BABYLON.Vector3(-mapsize / 4, mapsize / 4, -mapsize / 4);
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new BABYLON.Vector3(0.5, 0.5, 0.5);
    this.camera.attachControl(renderCanvas);
    this.camera.updateUpVectorFromRotation = true;

    const light_1 = new BABYLON.HemisphericLight(
      "light_1",
      new BABYLON.Vector3(1, 0.5, 0),
      this.scene);
    light_1.diffuse = new BABYLON.Color3(1, 0, 1);
    light_1.specular = new BABYLON.Color3(0, 0, 0);

    const light_2 = new BABYLON.HemisphericLight(
      "light_2",
      new BABYLON.Vector3(0, 0.5, 1),
      this.scene);
    light_2.diffuse = new BABYLON.Color3(0, 1, 1);
    light_2.specular = new BABYLON.Color3(0.3, 0.3, 0.3);

    this.scene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    this.draw();

    // Hide the HTML loader.
    document.getElementById("loader").style.display = "none";
  }

  // Move camera to overhead view. Middle of map, looking straight down.
  overhead_view() {
    const mapsize = this.tile_size * this.enviroment.tile_count;
    const position = new BABYLON.Vector3(mapsize / 2, mapsize * 2, mapsize / 2);
    const rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI, 0.001);

    var ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

    BABYLON.Animation.CreateAndStartAnimation(
      "camPos", this.camera, "position", 10, 10, this.camera.position, position, 0, ease);
    BABYLON.Animation.CreateAndStartAnimation(
      "camRot", this.camera, "rotation", 10, 10, this.camera.rotation, rotation, 0, ease);
  }

  coordinate_to_index(coordinate: Coordinate): number {
    return (coordinate.y * this.enviroment.tile_count + coordinate.x);
  }

  // Called before iteration through map's points.
  draw_start(): void {
    // Cleanup any existing meshes from previous draw.
    while(this.scene.meshes.length > 0) {
      let mesh = this.scene.meshes.pop();
      mesh.dispose();
    }

    this.positions = [];
    this.indices = [];
    this.rivers = [];

    for(let y = 0; y < this.enviroment.tile_count; y++) {
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        // TODO: Some of these positions are not actually used.
        // Tiles at the height of the seabed are not drawn.
        // Not populating these at this time would make calculating indexes into
        // the this.positions array much more challenging though.
        const tile = this.geography.get_tile({x, y});
        this.positions.push(tile.pos.x * this.tile_size);
        this.positions.push(tile.height);
        this.positions.push(tile.pos.y * this.tile_size);
      }
    }
  }

  // Called once per tile.
  draw_tile(tile: Tile): void {
    const x = tile.pos.x;
    const y = tile.pos.y;
    if( x < 0 || x >= this.enviroment.tile_count -1||
        y < 0 || y >= this.enviroment.tile_count -1) {
      return;
    }

    // All vertex position information has already been entered into
    // this.positions.
    // Here we create polygons to add to the main mesh from indexes into
    // this.positions.

    const offset00 = this.coordinate_to_index({x: x + 0, y: y + 0});
    const offset10 = this.coordinate_to_index({x: x + 1, y: y + 0});
    const offset01 = this.coordinate_to_index({x: x + 0, y: y + 1});
    const offset11 = this.coordinate_to_index({x: x + 1, y: y + 1});

    const height00 = this.positions[offset00 * 3 + 1];
    const height10 = this.positions[offset10 * 3 + 1];
    const height01 = this.positions[offset01 * 3 + 1];
    const height11 = this.positions[offset11 * 3 + 1];

    if(height00 === 0 && height10 === 0 && height01 === 0 && height11 === 0) {
      // The tile we are considering drawing is at the same height as the seabed.
      // More efficient to just draw a single "seabed" tile under the whole map.
      return;
    }

    const height_lowest = Math.min(Math.min(Math.min(height00, height10), height01), height11);

    // Each square on the map is tiled with 2 triangles. It is important to
    // orientate these triangles with any river we may draw.
    // Consider the points:
    // A B
    // C D
    //
    // A.height = 2
    // B.height = 2
    // C.height = 2
    // D.height = 1
    //
    // Note that:
    // Point "A" has the lowest neighbour "D".
    // Point "B" and "C" have the same height as "A".
    //
    // If we tile this section in 2 triangles: "ABC" and "BCD", the triangle "ABC"
    // will be a parallel to the horizontal plane and be at height === 2.
    // This will obscure any river drawn directly between "A" and "D".
    // Instead we should tile with triangles "ADC" and "ACB" so the edge of both
    // triangles is the same vertex as the river.
    if(height00 === height_lowest) {
      this.indices.push(offset00);
      this.indices.push(offset11);
      this.indices.push(offset01);
      this.indices.push(offset00);
      this.indices.push(offset10);
      this.indices.push(offset11);
    } else if(height10 === height_lowest) {
      this.indices.push(offset10);
      this.indices.push(offset01);
      this.indices.push(offset00);
      this.indices.push(offset10);
      this.indices.push(offset11);
      this.indices.push(offset01);
    } else if(height01 === height_lowest) {
      this.indices.push(offset01);
      this.indices.push(offset00);
      this.indices.push(offset10);
      this.indices.push(offset01);
      this.indices.push(offset10);
      this.indices.push(offset11);
    } else {
      this.indices.push(offset11);
      this.indices.push(offset00);
      this.indices.push(offset10);
      this.indices.push(offset11);
      this.indices.push(offset01);
      this.indices.push(offset00);
    }
  }

  // Draw river between 2 points.
  draw_river(highest: Tile, lowest: Tile): void {
    const sealevel = this.enviroment.sealevel;
    if(highest === null || lowest === null) {
      return;
    }
    if(highest.height < sealevel) {
      return;
    }
    if(highest.dampness <= this.river_threshold) {
      return;
    }

    // Offset to prevent height fighting during render.
    // Make rivers slightly above land.
    const offset = 0.01;

    console.assert( highest.height >= lowest.height, {errormessage: "river flows uphill"});

    const river: Array<BABYLON.Vector3> = [];

    // River section from highest to mid-point.
    river.push(new BABYLON.Vector3(
      highest.pos.x * this.tile_size, highest.height + offset, highest.pos.y * this.tile_size));
    if(lowest.height >= sealevel) {
      river.push(new BABYLON.Vector3(
        lowest.pos.x * this.tile_size, lowest.height + offset, lowest.pos.y * this.tile_size));
    } else {
      // Stop at shoreline.
      const ratio_x = (highest.pos.x - lowest.pos.x) /
                      (highest.height - lowest.height);
      const ratio_y = (highest.pos.y - lowest.pos.y) /
                      (highest.height - lowest.height);
      let x = highest.pos.x - ((highest.height - sealevel) * ratio_x);
      let y = highest.pos.y - ((highest.height - sealevel) * ratio_y);
      river.push(new BABYLON.Vector3(x * this.tile_size, sealevel + offset, y * this.tile_size));
    }

    this.rivers.push(river);
  }

  // Called as the last stage of the render.
  draw_end(): void {
    const land_material = new BABYLON.StandardMaterial("land_material", this.scene);
    land_material.diffuseColor = new BABYLON.Color3(0.3, 0.7, 0.2);
    land_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    //land_material.backFaceCulling = false;

    const seabed_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    seabed_material.diffuseColor = new BABYLON.Color3(0.3, 0.7, 0.2);
    seabed_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    //seabed_material.backFaceCulling = false;

    const sea_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    sea_material.diffuseColor = new BABYLON.Color3(0, 0.3, 1);
    sea_material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    //sea_material.alpha = 0.85;
    sea_material.alpha = 0.5;
    sea_material.backFaceCulling = false;

    // Finish computing land.
    BABYLON.VertexData.ComputeNormals(this.positions, this.indices, this.normals);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = this.positions;
    vertexData.indices = this.indices;
    vertexData.normals = this.normals;

    const land = new BABYLON.Mesh("land");
    land.material = land_material;
    vertexData.applyToMesh(land, true);
    land.checkCollisions = true;
    //land.convertToFlatShadedMesh();

    // Rivers
    this.schedule_update_rivers();

    // Generate seabed.
    const mapsize = this.tile_size * this.enviroment.tile_count;
    const seabed = BABYLON.MeshBuilder.CreateGround(
      "seabed", {width: mapsize * 2, height: mapsize * 2});
    seabed.position = new BABYLON.Vector3(
      mapsize / 2, -0.01, mapsize / 2);
    seabed.material = seabed_material;
    seabed.checkCollisions = true;

    // Generate sea.
    this.sea_mesh = BABYLON.MeshBuilder.CreateGround(
      "sea", {width: mapsize * 2, height: mapsize * 2});
    this.sea_mesh.material = sea_material;
    this.sea_mesh.checkCollisions = false;
    this.set_sealevel(this.enviroment.sealevel);

    this.camera.setTarget(new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2));
  }

  // Move the height of the sea mesh on the Z axis.
  set_sealevel(sealevel: number): void {
    console.log("sealevel: ", sealevel);
    this.enviroment.sealevel = sealevel;
    const mapsize = this.tile_size * this.enviroment.tile_count;
    this.sea_mesh.position = new BABYLON.Vector3(mapsize / 2, sealevel + 0.02, mapsize / 2);

    // Now recalculate the rivers as they now meet the sea at a different height
    // so length will be different.
    this.schedule_update_rivers();
  }

  // Set what Tile.dampness value to display rivers at and schedule a re-draw.
  set_rivers(value: number): void {
    this.river_threshold = value;
    console.log("set_rivers", value, this.geography.enviroment.dampest);
    this.schedule_update_rivers();
  }

  // Since the `update_rivers()` method is quite CPU intensive, let's not
  // run it for every small update.
  // Every ~100ms will be good enough.
  schedule_update_rivers(): void {
    if(this.update_rivers_timer === 0) {
      this.update_rivers_timer = setTimeout(() => {
        this.update_rivers();
      }, 100);
    }
  }

  // Delete existing rivers mesh and replace with one up to date for the current
  // river_threshold and sealevel values.
  update_rivers(): void {
    console.log("update_rivers", this.update_rivers_timer);
    this.update_rivers_timer = 0;
    if(this.rivers.length > 0) {
      this.rivers = [];
    }
    if(this.rivers_mesh !== undefined) {
      this.rivers_mesh.dispose();
    }

    for(let y = 0; y < this.enviroment.tile_count; y++) {
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        const tile = this.geography.get_tile({x, y});
        this.draw_river(tile, tile.lowest_neighbour);
      }
    }
    if(this.rivers.length > 0) {
      this.rivers_mesh = BABYLON.MeshBuilder.CreateLineSystem(
        "rivers", {lines: this.rivers}, this.scene);
    }
  }
}

