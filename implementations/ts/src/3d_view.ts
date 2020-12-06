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
import {Planting, PlantType} from './Planting';

export class Display3d extends DisplayBase {
  config: Config = null;
  tile_size: number = 2;
  positions: number[] = [];
  indices: number[] = [];
  normals: number[] = [];
  rivers: BABYLON.Vector3[][] = [];
  land_mesh: BABYLON.Mesh;
  sea_mesh: BABYLON.Mesh;
  rivers_mesh: BABYLON.Mesh;
  update_rivers_timer: ReturnType<typeof setTimeout> = 0;

  vegetation: Noise;
  treesPine: TreePine;
  treesDeciduous: TreeDeciduous;

  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.UniversalCamera;

  land_material: BABYLON.StandardMaterial;
  sea_material: BABYLON.StandardMaterial;
  seabed_material: BABYLON.StandardMaterial;

  light_1:BABYLON.DirectionalLight;

  optimizer: BABYLON.SceneOptimizer;
  deoptimizer: BABYLON.SceneOptimizer;

  constructor(geography: Geography, vegetation: Noise, config: Config) {
    super(geography);

    this.vegetation = vegetation;
    this.config = config;

    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    const mapsize = this.tile_size * config.get("enviroment.tile_count");

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
    this.camera.ellipsoid = new BABYLON.Vector3(1.0, 0.5, 1.0);
    this.camera.updateUpVectorFromRotation = true;

    // Higher the less sensitive.
    this.camera.touchMoveSensibility = 200;
    this.camera.touchAngularSensibility = 60000;

    this.camera.attachControl(this.canvas, true);
    this.light_1 = new BABYLON.DirectionalLight(
      "light_1",
      new BABYLON.Vector3(-100, -100, 0),
      this.scene);
    this.light_1.diffuse = new BABYLON.Color3(1, 1, 1);
    this.light_1.specular = new BABYLON.Color3(0, 0, 0);
    this.light_1.intensity = 0.5;
    this.light_1.autoCalcShadowZBounds = true;

    const light_2 = new BABYLON.DirectionalLight(
      "light_2",
      new BABYLON.Vector3(0, -100, 0),
      this.scene);
    light_2.diffuse = new BABYLON.Color3(1, 1, 1);
    light_2.specular = new BABYLON.Color3(0.3, 0.3, 0.3);
    light_2.intensity = 0.5;
    light_2.autoCalcShadowZBounds = true;

    this.scene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    this.land_material = new BABYLON.StandardMaterial("land_material", this.scene);
    this.land_material.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2);
    this.land_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    // this.land_material.backFaceCulling = false;
    //this.land_material.freeze();

    this.seabed_material = new BABYLON.StandardMaterial("seabed_material", this.scene);
    this.seabed_material.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2);
    this.seabed_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    // this.seabed_material.backFaceCulling = false;
    //this.seabed_material.freeze();

    this.sea_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    this.sea_material.diffuseColor = new BABYLON.Color3(0.1, 0.2, 1.0);
    this.sea_material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    this.sea_material.alpha = config.get("display.sea_transparency");
    this.sea_material.backFaceCulling = false;
    //this.sea_material.freeze();

    this.draw();

    this.camera.setTarget(new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2));

    // FPS meter.
    //const instrumentation = new BABYLON.EngineInstrumentation(this.engine);
    //instrumentation.captureGPUFrameTime = true;
    const updateEvery = 10;
    const sampleCount = 10;
    const fpsDiv = document.getElementById("fps");
    let fps = 0;
    let fpsCount = 0;
    const fpsSamples = Array(sampleCount).fill(0);
    let fpsTotal = 0;
    let fpsIndex = 0;
    this.scene.registerBeforeRender(() => {
      if(!((fpsCount++) % updateEvery === 0)) {
        return;
      }
      fps = this.engine.getFps();
      if(!isFinite(fps)) {
        return;
      }
      fpsIndex = Math.round(fpsCount / updateEvery) % sampleCount;
      fpsTotal -= fpsSamples[fpsIndex];
      fpsTotal += fps;
      fpsSamples[fpsIndex] = fps;
      fpsDiv.innerHTML = (fpsTotal / sampleCount).toFixed() + "fps<br>";
      //fpsDiv.innerHTML += "GPU average time: ";
      //fpsDiv.innerHTML +=
      //  (instrumentation.gpuFrameTimeCounter.average * 0.000001).toFixed(2) + "ms";
    });

    // Hide the HTML loader.
    document.getElementById("loader").style.display = "none";

    // Optimizations.
    // this.scene.freezeActiveMeshes();
    // this.scene.autoClear = false;
    // this.scene.autoClearDepthAndStencil = false;

    // Optimizers
    this.optimizer =
      new BABYLON.SceneOptimizer(this.scene, this.optimizer_options());
    this.optimizer.onNewOptimizationAppliedObservable.add((optim) => {
      console.info(optim.getDescription());
    });
    this.optimizer.onSuccessObservable.add((optim) => {
      console.info("Sucessfully optimized.");
    });
    this.optimizer.onFailureObservable.add((optim) => {
      console.info("Failed to optimize.");
    });

    let o = new BABYLON.LensFlaresOptimization(0);
    o.apply(this.scene, this.optimizer);
    o = new BABYLON.MergeMeshesOptimization(0);
    o.apply(this.scene, this.optimizer);
    o = new BABYLON.PostProcessesOptimization(0);
    o.apply(this.scene, this.optimizer);
    o = new BABYLON.ParticlesOptimization(0);
    o.apply(this.scene, this.optimizer);

    this.deoptimizer =
      new BABYLON.SceneOptimizer(
        this.scene, new BABYLON.SceneOptimizerOptions(60, 2000), null, true);

    this.optimize();
  }

  optimize(): void {
    this.deoptimize();
    this.optimizer.targetFrameRate = this.config.get("display.target_fps");
    this.optimizer.reset();
    this.optimizer.start();
  }

  deoptimize(): void {
    // Undo all optimizations.
    let o = new BABYLON.ShadowsOptimization(0);
    o.apply(this.scene, this.deoptimizer);
    o = new BABYLON.TextureOptimization(0, 4896);
    o.apply(this.scene, this.deoptimizer);
    o = new BABYLON.HardwareScalingOptimization(0, 0.5);
    o.apply(this.scene, this.deoptimizer);

    this.deoptimizer.reset();
    this.deoptimizer.start();
  }

  optimizer_options(target_fps: number = 60): BABYLON.SceneOptimizerOptions {
    const result = new BABYLON.SceneOptimizerOptions(target_fps, 1000);
    let priority = 0;

    result.optimizations.push(new BABYLON.TextureOptimization(priority, 4096));
    result.optimizations.push(new BABYLON.HardwareScalingOptimization(priority, 1));

    // Next priority
    priority++;
    result.optimizations.push(new BABYLON.TextureOptimization(priority, 2048));
    result.optimizations.push(new BABYLON.HardwareScalingOptimization(priority, 2));

    // Next priority
    priority++;
    result.optimizations.push(new BABYLON.TextureOptimization(priority, 1024));
    result.optimizations.push(new BABYLON.HardwareScalingOptimization(priority, 3));

    // Next priority
    priority++;
    result.optimizations.push(new BABYLON.TextureOptimization(priority, 512));
    result.optimizations.push(new BABYLON.HardwareScalingOptimization(priority, 4));

    // Next priority
    priority++;
    result.optimizations.push(new BABYLON.ShadowsOptimization(priority));

    return result;
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
      if(mesh) {
        try {
          mesh.dispose();
        } catch(error) {
          // This error occurs inside Babylon after the optimizer reduces the
          // render target texture size.
          // It seems to be not harmful.
        }
      }
    }

    this.positions = [];
    this.indices = [];
    this.rivers = [];

    for(let y = 0; y < this.config.get("enviroment.tile_count"); y++) {
      for(let x = 0; x < this.config.get("enviroment.tile_count"); x++) {
        // These are the points at the corners of the grid.
        // We actually form these into triangles later in draw_tile(...) where
        // we populate the this.indices[] collection with indexes of
        // this.positions entries.
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

    // if(height00 === 0 && height10 === 0 && height01 === 0 && height11 === 0) {
      // The tile we are considering drawing is at the same height as the seabed.
      // More efficient to just draw a single "seabed" tile under the whole map.
      // return;
    // }

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
    if(height00 === height_lowest || height11 === height_lowest) {
      // First triangle.
      this.indices.push(offset00);
      this.indices.push(offset11);
      this.indices.push(offset01);
      // Second triangle.
      this.indices.push(offset11);
      this.indices.push(offset00);
      this.indices.push(offset10);
    } else {
      // First triangle.
      this.indices.push(offset10);
      this.indices.push(offset01);
      this.indices.push(offset00);
      // Second triangle.
      this.indices.push(offset01);
      this.indices.push(offset10);
      this.indices.push(offset11);
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
    // Required to keep camera above ground.
    this.land_mesh.checkCollisions = true;
    // this.land_mesh.convertToFlatShadedMesh();

    // Show tile edges.
    // this.land_mesh.enableEdgesRendering(.9999999999);
    // this.land_mesh.edgesWidth = 5.0;
    // this.land_mesh.edgesColor = new BABYLON.Color4(1, 1, 1, 1);

    this.land_mesh.freezeWorldMatrix();

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

    this.sea_mesh.freezeWorldMatrix();

    // Plant trees.
    this.planting();
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
    this.rivers_mesh.freezeWorldMatrix();
  }

  /* Given a vector populated with the x and z coordinates, calculate the
   * corresponding y (height). */
  setHeightToSurface(point: BABYLON.Vector3): void {
    // Get the 2 triangles that tile this square.
    const indiceStartIndex = (
      (Math.floor(point.z / this.tile_size) *
        (this.config.get("enviroment.tile_count") - 1) +
        Math.floor(point.x / this.tile_size)) * 6);

    // Get points at corners of tile.
    const points = [
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 0] * 3),
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 1] * 3),
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 2] * 3),
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 5] * 3)
    ];

    // Each tile is made up of 2 triangles. Calculate which one the point is in.
    point.y = (points[2].y + points[3].y) / 2;
    let triangle: [BABYLON.Vector3, BABYLON.Vector3, BABYLON.Vector3];
    if(BABYLON.Vector3.DistanceSquared(point, points[2]) <
       BABYLON.Vector3.DistanceSquared(point, points[3])) {
      triangle = [points[0], points[1], points[2]];
    } else {
      triangle = [points[0], points[1], points[3]];
    }

    const dx = (point.x / this.tile_size) - (triangle[2].x / this.tile_size);
    const dz = (point.z / this.tile_size) - (triangle[2].z / this.tile_size);
    const dy0 = triangle[2].y - triangle[0].y;
    const dy1 = triangle[2].y - triangle[1].y;

    // There are 4 possible triangle layouts.
    if(triangle[0].x > triangle[1].x && triangle[0].x > triangle[2].x) {
      // 1
      // 2 0
      // console.assert(triangle[0].z < triangle[1].z);
      point.y = triangle[2].y - (dx * dy0) - (dz * dy1);
    } else if(triangle[0].x <= triangle[1].x && triangle[0].x === triangle[2].x) {
      // 2 1
      // 0
      // console.assert(triangle[0].z < triangle[1].z);
      point.y = triangle[2].y - (dx * dy1) + (dz * dy0);
    } else if(triangle[0].x > triangle[1].x && triangle[0].x === triangle[2].x) {
      // 1 2
      //   0
      // console.assert(triangle[0].z < triangle[1].z);
      point.y = triangle[2].y + (dx * dy1) + (dz * dy0);
    } else {
      //   1
      // 0 2
      point.y = triangle[2].y + (dx * dy0) - (dz * dy1);
    }

    return;
  }

  planting(): void {
    const p = new Planting(this.geography, this.config, this.vegetation.data_combined);

    if(this.treesPine) {
      try {
        this.treesPine.trunkMaterial.dispose();
        this.treesPine.leafMaterial.dispose();
        this.treesPine.root.dispose();
      } catch(error) {
        // This error occurs inside Babylon after the optimizer reduces the
        // render target texture size.
        // It seems to be not harmful.
      }
    }
    if(this.treesDeciduous) {
      try {
        this.treesDeciduous.trunkMaterial.dispose();
        this.treesDeciduous.leafMaterial.dispose();
        this.treesDeciduous.root.dispose();
      } catch(error) {
        // This error occurs inside Babylon after the optimizer reduces the
        // render target texture size.
        // It seems to be not harmful.
      }
    }

    if(! this.config.get("vegetation.enabled")) {
      return;
    }

    this.treesPine = new TreePine(this.scene);
    this.treesDeciduous = new TreeDeciduous(this.scene);
    let pineCount = 0;
    let deciduousCount = 0;

    let bufferMatricesPine =
      new Float32Array(16 * p.countByType[PlantType.Pine]);
    let bufferMatricesDeciduous =
      new Float32Array(16 * p.countByType[PlantType.Deciduous]);

    for(let [keyX, row] of p.locations.entries()) {
      for(let [keyY, Plant] of row.entries()) {
        for(let plant of p.get(keyX, keyY)) {
          //const position = plant.position.clone() as BABYLON.Vector3;
          const position = new BABYLON.Vector3(
            plant.position.x * this.tile_size, 0, plant.position.z * this.tile_size);
          this.setHeightToSurface(position);

          const matrix = BABYLON.Matrix.Compose(
            new BABYLON.Vector3(plant.height, plant.height, plant.height),
            BABYLON.Quaternion.Zero(),
            position
          );

          switch(plant.type_){
            case PlantType.Pine:
              matrix.copyToArray(bufferMatricesPine, pineCount * 16);
              pineCount++;
              break;
            case PlantType.Deciduous:
              matrix.copyToArray(bufferMatricesDeciduous, deciduousCount * 16);
              deciduousCount++;
              break;
          }
        }
      }
    }

    this.treesDeciduous.leaves.thinInstanceSetBuffer("matrix", bufferMatricesDeciduous, 16, true);
    this.treesDeciduous.trunk.thinInstanceSetBuffer("matrix", bufferMatricesDeciduous, 16, true);
    this.treesPine.leaves.thinInstanceSetBuffer("matrix", bufferMatricesPine, 16, true);
    this.treesPine.trunk.thinInstanceSetBuffer("matrix", bufferMatricesPine, 16, true);

    if(deciduousCount === 0) {
      this.treesDeciduous.trunk.isVisible = false;
      this.treesDeciduous.leaves.isVisible = false;
    }
    if(pineCount === 0) {
      this.treesPine.trunk.isVisible = false;
      this.treesPine.leaves.isVisible = false;
    }

    // Tree shadows.
    if(this.config.get("vegetation.shadow_enabled")) {
      const shadowGenerator = new BABYLON.ShadowGenerator(4096, this.light_1);
      //const shadowGenerator = new BABYLON.ShadowGenerator(1024, this.light_1);
      //const shadowGenerator = new BABYLON.ShadowGenerator(512, this.light_1);
      //shadowGenerator.usePoissonSampling = true;
      shadowGenerator.addShadowCaster(this.treesPine.trunk, true);
      shadowGenerator.addShadowCaster(this.treesPine.leaves, true);
      shadowGenerator.addShadowCaster(this.treesDeciduous.trunk, true);
      shadowGenerator.addShadowCaster(this.treesDeciduous.leaves, true);
      this.land_mesh.receiveShadows = true;
    }
  }
}

class TreeDeciduous {
  readonly tessellation: number = 3;
  readonly trunkHeight: number = 5;
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
    this.trunkMaterial.freeze();

    this.leafMaterial = new BABYLON.StandardMaterial("leafMaterial", scene);
    this.leafMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.7, 0.3);
    this.leafMaterial.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
    this.leafMaterial.freeze();

    this.root = BABYLON.Mesh.CreateBox("deciduousTree", 1, scene);
    this.root.isVisible = false;

    this.trunk = BABYLON.MeshBuilder.CreateCylinder(
      "trunk",
      {
        height: this.trunkHeight + this.leavesDiamiter / 2,
        tessellation: this.tessellation,
        cap: BABYLON.Mesh.NO_CAP,
        diameterTop: 1,
        diameterBottom: 1.2,
      }
    );
    this.trunk.position.y = this.trunkHeight / 2;
    this.trunk.material = this.trunkMaterial;
    this.trunk.bakeCurrentTransformIntoVertices();

    // const debug = BABYLON.MeshBuilder.CreateBox("debug", {size: 2, height: 0.02}, scene);
    // this.trunk = BABYLON.Mesh.MergeMeshes([this.trunk, debug]);

    this.leaves = BABYLON.MeshBuilder.CreateSphere(
      "leaves",
      {
        segments: 1,
        diameter: this.leavesDiamiter
      }
    );
    this.leaves.position.y = this.leavesDiamiter / 2 + this.trunkHeight;
    this.leaves.material = this.leafMaterial;
    this.leaves.bakeCurrentTransformIntoVertices();

    this.leaves.parent = this.root;
    this.trunk.parent = this.root;

    this.root.freezeWorldMatrix();
    this.leaves.freezeWorldMatrix();
    this.trunk.freezeWorldMatrix();
  }
}

class TreePine {
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
    this.trunkMaterial.freeze();

    this.leafMaterial = new BABYLON.StandardMaterial("leafMaterial", scene);
    this.leafMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.1);
    this.leafMaterial.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
    this.leafMaterial.freeze();

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

    // const debug = BABYLON.MeshBuilder.CreateBox("debug", {size: 2, height: 0.02}, scene);
    // this.trunk = BABYLON.Mesh.MergeMeshes([this.trunk, debug]);

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

    this.root.freezeWorldMatrix();
    this.leaves.freezeWorldMatrix();
    this.trunk.freezeWorldMatrix();
  }
}
