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
import {Geography, Tile, DisplayBase, Coordinate} from "./flowing_terrain";
import {Noise} from "./genesis";
import {Config} from "./config";
import {FreeCameraPointersInput} from './freeCameraPointersInput';

export class Display3d extends DisplayBase {
  vegetation: Noise;
  config: Config = null;
  tile_size: number = 2;
  positions: number[] = [];
  indices: number[] = [];
  normals: number[] = [];
  tileIterator: number = 0;
  rivers: BABYLON.Vector3[][] = [];
  land_mesh: BABYLON.Mesh;
  trees: Tree;
  sea_mesh: BABYLON.Mesh;
  rivers_mesh: BABYLON.Mesh;
  update_rivers_timer: ReturnType<typeof setTimeout> = 0;

  canvas: HTMLCanvasElement;
  fpsMeter: HTMLElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.UniversalCamera;

  land_material: BABYLON.StandardMaterial;
  sea_material: BABYLON.StandardMaterial;
  seabed_material: BABYLON.StandardMaterial;

  constructor(geography: Geography, vegetation: Noise, config: Config) {
    super(geography);

    this.vegetation = vegetation;
    this.config = config;

    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.fpsMeter = document.getElementById("fps") as HTMLElement;
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    const mapsize = this.tile_size * config.get("enviroment.tile_count");

    this.scene.registerBeforeRender(this.updateFps.bind(this));

    this.camera = new BABYLON.UniversalCamera(
      "UniversalCamera",
      new BABYLON.Vector3(0, 0, 0),
      this.scene);
    
    this.camera.inputs.addMouseWheel();
    (this.camera.inputs.attached['mousewheel'] as BABYLON.FreeCameraMouseWheelInput).
      wheelYMoveScene = BABYLON.Coordinate.Y;
    (this.camera.inputs.attached['mousewheel'] as BABYLON.FreeCameraMouseWheelInput).
      wheelPrecisionY = -1;

    this.camera.inputs.removeMouse();
    this.camera.inputs.remove(this.camera.inputs.attached.touch);
    //this.camera.inputs.addPointers();
    let pointerInput = new FreeCameraPointersInput();
    pointerInput.panSensitivity = new BABYLON.Vector3(-0.02, -0.02, 0.02);
    pointerInput.angularSensitivity = new BABYLON.Vector3(0.001, 0.001, 0.001);
    this.camera.inputs.add(pointerInput);

    this.camera.position = new BABYLON.Vector3(-mapsize / 4, mapsize / 4, -mapsize / 4);
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new BABYLON.Vector3(0.5, 0.5, 0.5);
    this.camera.updateUpVectorFromRotation = true;

    // Higher the less sensitive.
    this.camera.touchMoveSensibility = 200;
    this.camera.touchAngularSensibility = 60000;

    this.camera.attachControl(this.canvas, true);
    const light_1 = new BABYLON.DirectionalLight(
      "light_1",
      new BABYLON.Vector3(-10, -10, 0),
      this.scene);
    light_1.position = new BABYLON.Vector3(100, 100, 100);
    light_1.diffuse = new BABYLON.Color3(1, 1, 1);
    light_1.specular = new BABYLON.Color3(0, 0, 0);
    light_1.intensity = 0.5;

    const light_2 = new BABYLON.DirectionalLight(
      "light_2",
      new BABYLON.Vector3(0, -10, 0),
      this.scene);
    light_2.diffuse = new BABYLON.Color3(1, 1, 1);
    light_2.specular = new BABYLON.Color3(0.3, 0.3, 0.3);
    light_2.intensity = 0.5;

    this.scene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    this.land_material = new BABYLON.StandardMaterial("land_material", this.scene);
    this.land_material.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2);
    this.land_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    // this.land_material.backFaceCulling = false;

    this.seabed_material = new BABYLON.StandardMaterial("seabed_material", this.scene);
    this.seabed_material.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2);
    this.seabed_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    // this.seabed_material.backFaceCulling = false;

    this.sea_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    this.sea_material.diffuseColor = new BABYLON.Color3(0.1, 0.2, 1.0);
    this.sea_material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    this.sea_material.alpha = config.get("display.sea_transparency");
    this.sea_material.backFaceCulling = false;

    this.draw();

    this.planting();

    const shadowGenerator = new BABYLON.ShadowGenerator(2048, light_1);
    shadowGenerator.addShadowCaster(this.trees.leaves, true);
    this.land_mesh.receiveShadows = true

    this.camera.setTarget(new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2));

    // Hide the HTML loader.
    document.getElementById("loader").style.display = "none";
  }

  updateFps(): void {
    this.fpsMeter.innerHTML = this.engine.getFps().toFixed() + " fps";
  }

  // Move camera to selected view.
  set_view(direction: string): void {
    const mapsize = this.tile_size * this.config.get("enviroment.tile_count");
    const map_center = new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2);
    const view_pos = 1.5 * mapsize
    const view_pos_diag =  mapsize + mapsize / 2.8
    const view_mid = mapsize / 2;
    const view_neg = - mapsize / 2
    const view_neg_diag = - mapsize / 2.8

    const ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

    let position = new BABYLON.Vector3(view_mid, mapsize * 2, view_mid);

    switch(direction) {
      case "down-right":
        position = new BABYLON.Vector3(view_pos_diag, view_mid, view_neg_diag);
        break;
      case "down":
        position = new BABYLON.Vector3(view_mid, view_mid, view_neg);
        break;
      case "down-left":
        position = new BABYLON.Vector3(view_neg_diag, view_mid, view_neg_diag);
        break;
      case "right":
        position = new BABYLON.Vector3(view_pos, view_mid, view_mid);
        break;
      case "overhead":
        position = new BABYLON.Vector3(view_mid, mapsize * 2, view_mid);
        break;
      case "left":
        position = new BABYLON.Vector3(view_neg, view_mid, view_mid);
        break;
      case "up-right":
        position = new BABYLON.Vector3(view_pos_diag, view_mid, view_pos_diag);
        break;
      case "up":
        position = new BABYLON.Vector3(view_mid, view_mid, view_pos);
        break;
      case "up-left":
        position = new BABYLON.Vector3(view_neg_diag, view_mid, view_pos_diag);
        break;
    }

    // To get the final rotation, let's temporarily move the camera to it's final
    // destination and then setTarget(map_center).
    // When there we'll copy the expected rotation before moving the camera back.
    // This all happens between frame draws so you don't see it.
    const pos_start = this.camera.position;
    const rot_start = this.camera.rotation.clone();

    this.camera.position = position;
    this.camera.setTarget(map_center);

    const rot_target = this.camera.rotation.clone();

    this.camera.rotation = rot_start;
    this.camera.position = pos_start;

    if(Math.abs(rot_start.y - rot_target.y) > Math.PI) {
      if(rot_start.y < 0) {
        rot_start.y += 2 * Math.PI;
      } else {
        rot_start.y -= 2 * Math.PI;
      }
    }

    BABYLON.Animation.CreateAndStartAnimation(
      "camRot", this.camera, "rotation", 10, 10,
      rot_start, rot_target, 0, ease);

    BABYLON.Animation.CreateAndStartAnimation(
      "camPos", this.camera, "position", 10, 10,
      pos_start, position, 0, ease);
  }

  coordinate_to_index(coordinate: Coordinate): number {
    return (coordinate.y * this.config.get("enviroment.tile_count") + coordinate.x);
  }

  // Called before iteration through map's points.
  draw_start(): void {
    // Cleanup any existing meshes from previous draw.
    while(this.scene.meshes.length > 0) {
      const mesh = this.scene.meshes.pop();
      mesh.dispose();
    }

    this.positions = [];
    this.indices = [];
    this.rivers = [];

    for(let y = 0; y < this.config.get("enviroment.tile_count"); y++) {
      for(let x = 0; x < this.config.get("enviroment.tile_count"); x++) {
        // TODO: Some of these positions are not actually used.
        // Tiles at the height of the seabed are not drawn.
        // Not populating these at this time would make calculating indexes into
        // the this.positions array much more challenging though.
        const tile = this.geography.get_tile({x, y});
        this.positions.push(tile.pos.x * this.tile_size);
        this.positions.push(tile.height * this.tile_size);
        this.positions.push(tile.pos.y * this.tile_size);
      }
    }
  }

  // Called once per tile.
  draw_tile(tile: Tile): void {
    const x = tile.pos.x;
    const y = tile.pos.y;
    if( x < 0 || x >= this.config.get("enviroment.tile_count") -1||
        y < 0 || y >= this.config.get("enviroment.tile_count") -1) {
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
      // return;
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
    const sealevel = this.config.get("geography.sealevel");
    if(highest === null || lowest === null) {
      return;
    }
    if(highest.height < sealevel) {
      return;
    }
    if(highest.dampness <= this.config.get("display.river_threshold")) {
      return;
    }

    // Offset to prevent height fighting during render.
    // Make rivers slightly above land.
    const offset = 0.01;

    console.assert( highest.height >= lowest.height, {errormessage: "river flows uphill"});

    const river: BABYLON.Vector3[] = [];

    // River section from highest to mid-point.
    river.push(new BABYLON.Vector3(
      highest.pos.x * this.tile_size,
      (highest.height + offset) * this.tile_size,
      highest.pos.y * this.tile_size));
    if(lowest.height >= sealevel) {
      river.push(new BABYLON.Vector3(
        lowest.pos.x * this.tile_size,
        (lowest.height + offset) * this.tile_size,
        lowest.pos.y * this.tile_size));
    } else {
      // Stop at shoreline.
      const ratio_x = (highest.pos.x - lowest.pos.x) /
                      (highest.height - lowest.height);
      const ratio_y = (highest.pos.y - lowest.pos.y) /
                      (highest.height - lowest.height);
      const x = highest.pos.x - ((highest.height - sealevel) * ratio_x);
      const y = highest.pos.y - ((highest.height - sealevel) * ratio_y);
      river.push(new BABYLON.Vector3(
        x * this.tile_size,
        (sealevel + offset) * this.tile_size,
        y * this.tile_size));
    }

    this.rivers.push(river);
  }

  // Called as the last stage of the render.
  draw_end(): void {
    // Finish computing land.
    BABYLON.VertexData.ComputeNormals(this.positions, this.indices, this.normals);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = this.positions;
    vertexData.indices = this.indices;
    vertexData.normals = this.normals;

    this.land_mesh = new BABYLON.Mesh("land");
    this.land_mesh.material = this.land_material;
    vertexData.applyToMesh(this.land_mesh, true);
    this.land_mesh.isPickable = false;
    this.land_mesh.checkCollisions = false;
    // this.land_mesh.convertToFlatShadedMesh();

    // Rivers
    this.schedule_update_rivers();

    // Generate seabed.
    const mapsize = this.tile_size * this.config.get("enviroment.tile_count");
    const seabed = BABYLON.MeshBuilder.CreateGround(
      "seabed", {width: mapsize * 2, height: mapsize * 2});
    seabed.position = new BABYLON.Vector3(
      mapsize / 2, -0.01, mapsize / 2);
    seabed.material = this.seabed_material;
    seabed.checkCollisions = true;

    // Generate sea.
    this.sea_mesh = BABYLON.MeshBuilder.CreateGround(
      "sea", {width: mapsize * 2, height: mapsize * 2});
    this.sea_mesh.material = this.sea_material;
    this.sea_mesh.checkCollisions = false;
    this.set_sealevel(this.config.get("geography.sealevel"));
  }

  // Move the height of the sea mesh on the Z axis.
  set_sealevel(sealevel: number): void {
    const mapsize = this.tile_size * this.config.get("enviroment.tile_count");
    this.sea_mesh.position = new BABYLON.Vector3(
      mapsize / 2, (sealevel + 0.02) * this.tile_size, mapsize / 2);

    // Now recalculate the rivers as they now meet the sea at a different height
    // so length will be different.
    this.schedule_update_rivers();
  }

  // Set what Tile.dampness value to display rivers at and schedule a re-draw.
  set_rivers(value: number): void {
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
    this.update_rivers_timer = 0;
    if(this.rivers.length > 0) {
      this.rivers = [];
    }
    if(this.rivers_mesh !== undefined) {
      this.rivers_mesh.dispose();
    }

    for(let y = 0; y < this.config.get("enviroment.tile_count"); y++) {
      for(let x = 0; x < this.config.get("enviroment.tile_count"); x++) {
        const tile = this.geography.get_tile({x, y});
        this.draw_river(tile, tile.lowest_neighbour);
      }
    }
    if(this.rivers.length > 0) {
      this.rivers_mesh = BABYLON.MeshBuilder.CreateLineSystem(
        "rivers",
        {
          lines: this.rivers,
          useVertexAlpha: false
        },
        this.scene);
      (<any>this.rivers_mesh).color = new BABYLON.Color3(0.3, 0.3, 1);
    }
  }

  getTile(corners: BABYLON.Vector3[]): boolean {
    const sealevel = this.config.get("geography.sealevel");
    do {
      const offset0 = this.indices[this.tileIterator * 3];
      const offset1 = this.indices[this.tileIterator * 3 + 1];
      const offset2 = this.indices[this.tileIterator * 3 + 2];

      corners[0].fromArray(this.positions, offset0 * 3);
      corners[1].fromArray(this.positions, offset1 * 3);
      corners[2].fromArray(this.positions, offset2 * 3);

      this.tileIterator++;
      if(this.tileIterator * 3 >= this.indices.length) {
        return false;
      }
    } while(corners[0].y < sealevel * this.tile_size ||
            corners[1].y < sealevel * this.tile_size ||
            corners[2].y < sealevel * this.tile_size);
    return true;
  }

  //Random point on the triangle.
  randomPoint(corners: BABYLON.Vector3[]): BABYLON.Vector3 {
    // point.x = s * corners[0].x + (t-s) * corners[1].x + (1-t) * corners[2].x;
    let s = Math.random();
    let t = Math.random();
    if (s > t) {
      const tmp = s;
      s = t;
      t = tmp;
    }
    let point = new BABYLON.Vector3;
    point.x = s * corners[0].x + (t-s) * corners[1].x + (1-t) * corners[2].x;
    point.y = s * corners[0].y + (t-s) * corners[1].y + (1-t) * corners[2].y;
    point.z = s * corners[0].z + (t-s) * corners[1].z + (1-t) * corners[2].z;

    return point;
  }

  planting(): void {
    this.trees = new Tree(this.scene);

    const points = [new BABYLON.Vector3(), new BABYLON.Vector3(), new BABYLON.Vector3()];

    const maxTreeCount = 10000;
    let treeCount = 0;
    this.tileIterator = 0;
    console.log(this.vegetation.data_combined.length, this.vegetation.data_combined[0].length);
    while(this.getTile(points) && treeCount < maxTreeCount) {
      const x = points[0].x / this.tile_size;
      const z = points[0].z / this.tile_size;
      if(this.vegetation.data_combined[x][z] > 0.05) {
        treeCount++;
      }
    }
    console.log(treeCount);

    let bufferMatrices = new Float32Array(16 * treeCount);

    treeCount = 0;
    this.tileIterator = 0;
    while(this.getTile(points) && treeCount < maxTreeCount) {
      const x = points[0].x / this.tile_size;
      const z = points[0].z / this.tile_size;
      if(this.vegetation.data_combined[x][z] > 0.05) {
        if(treeCount % 100 == 0) {
          console.log(treeCount);
        }

        const size = Math.random() * 0.1 + 0.1;
        const matrix = BABYLON.Matrix.Compose(
          new BABYLON.Vector3(size, size, size),
          //BABYLON.Vector3.One(),
          BABYLON.Quaternion.Zero(),
          this.randomPoint(points)
          //new BABYLON.Vector3(1, 2, 3)
        );

        //const leaves = tree.leaves.thinInstanceAdd(matrix, true);
        //const trunk = tree.trunk.thinInstanceAdd(matrix, true);

        console.assert(treeCount * 16 < bufferMatrices.length);
        matrix.copyToArray(bufferMatrices, (treeCount) * 16);

        treeCount++;
      }
    }
    this.trees.leaves.thinInstanceSetBuffer("matrix", bufferMatrices, 16, true);
    this.trees.trunk.thinInstanceSetBuffer("matrix", bufferMatrices, 16, true);
  }
}

class Tree {
  readonly tessellation: number = 3;
  readonly trunkHeight: number = 5;
  readonly leavesHeight: number = 10;
  readonly leavesDiamiter: number = 10;
  root: BABYLON.Mesh;
  trunk: BABYLON.Mesh;
  leaves: BABYLON.Mesh;
  trunkMaterial: BABYLON.StandardMaterial;
  leafMaterial: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.trunkMaterial = new BABYLON.StandardMaterial("trunkMaterial", scene);
    this.trunkMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.3);
    this.trunkMaterial.specularColor = new BABYLON.Color3(0.04, 0.04, 0.03);

    this.leafMaterial = new BABYLON.StandardMaterial("leafMaterial", scene);
    this.leafMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.1);
    this.leafMaterial.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);

    this.root = BABYLON.Mesh.CreateBox("pineTree", 1, scene);
    this.root.isVisible = false;
    
    this.trunk = BABYLON.MeshBuilder.CreateCylinder(
      "trunk",
      {
        height: this.trunkHeight,
        tessellation: this.tessellation,
        cap: BABYLON.Mesh.NO_CAP,
        diameterTop: 1,
        diameterBottom: 1.2,
      }
    );
    this.trunk.position.y = this.trunkHeight / 2;
    this.trunk.material = this.trunkMaterial;
    this.trunk.bakeCurrentTransformIntoVertices();

    this.leaves = BABYLON.MeshBuilder.CreateCylinder(
      "leaves",
      {
        height: this.leavesHeight,
        tessellation: this.tessellation,
        cap: BABYLON.Mesh.NO_CAP,
        diameterTop: 0.1,
        diameterBottom: this.leavesDiamiter,
      }
    );
    this.leaves.position.y = this.leavesHeight / 2 + this.trunkHeight;
    this.leaves.material = this.leafMaterial;
    this.leaves.bakeCurrentTransformIntoVertices();

    this.leaves.parent = this.root;
    this.trunk.parent = this.root; 
  }
}
