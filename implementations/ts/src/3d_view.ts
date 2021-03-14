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

/* A web frontend for the algorithm described at
 * https://github.com/mrdunk/flowing-terrain */

import * as BABYLON from 'babylonjs';
import {Geography, Tile, DisplayBase, Coordinate} from "./flowing_terrain";
import {Noise} from "./genesis";
import {Config} from "./config";
import {FreeCameraPointersInput} from './freeCameraPointersInput';
import {Planting, PlantType} from './Planting';
import {LandMaterial} from './materialsLibrary/land/landMaterial';
import {SeaMaterial} from './materialsLibrary/sea/seaMaterial';

export class Display3d extends DisplayBase {
  readonly tile_size: number = 2;
  readonly horizon_ratio: number = 16;

  mapsize: number;
  positions: number[] = [];
  indices: number[] = [];
  uvs: number[] = [];
  normals: number[] = [];
  land_mesh: BABYLON.Mesh;
  sea_mesh: BABYLON.Mesh;

  treesPine: TreePine;
  treesDeciduous: TreeDeciduous;
  treeShadowMapSize: number = 512;
  treeShadowGenerator: BABYLON.ShadowGenerator;

  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.UniversalCamera;

  land_material: LandMaterial;
  sea_material: SeaMaterial;
  seabed_material: BABYLON.StandardMaterial;

  light_1:BABYLON.DirectionalLight;

  optimizer: BABYLON.SceneOptimizer;
  deoptimizer: BABYLON.SceneOptimizer;

  constructor(protected geography: Geography,
              public vegetation: Planting,
              protected config: Config
  ) {
    super(geography);
    this.mapsize = this.tile_size * this.tile_count;

    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(this.canvas, true);

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.65, 0.77, 0.9, 1.0);

    this.camera = new BABYLON.UniversalCamera(
      "UniversalCamera",
      new BABYLON.Vector3(0, 0, 0),
      this.scene);

    this.camera.inputs.addMouseWheel();
    (this.camera.inputs.attached['mousewheel'] as BABYLON.FreeCameraMouseWheelInput).
      wheelYMoveScene = BABYLON.Coordinate.Y;
    (this.camera.inputs.attached['mousewheel'] as BABYLON.FreeCameraMouseWheelInput).
      wheelPrecisionY = -this.tile_size / 2;

    this.camera.inputs.removeMouse();
    this.camera.inputs.remove(this.camera.inputs.attached.touch);
    //this.camera.inputs.addPointers();
    let pointerInput = new FreeCameraPointersInput();
    pointerInput.panSensitivity =
      new BABYLON.Vector3(-0.01 * this.tile_size, -0.01 * this.tile_size, 0.01 * this.tile_size);
    pointerInput.angularSensitivity = new BABYLON.Vector3(0.001, 0.001, 0.001);
    this.camera.inputs.add(pointerInput);

    this.camera.position = new BABYLON.Vector3(
      -this.mapsize / 4, this.mapsize / 4, -this.mapsize / 4);
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new BABYLON.Vector3(1.0, 0.5, 1.0);
    this.camera.updateUpVectorFromRotation = true;
    this.camera.setTarget(new BABYLON.Vector3(this.mapsize / 2, 0, this.mapsize / 2));

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

    this.seabed_material = new BABYLON.StandardMaterial("seabed_material", this.scene);
    this.seabed_material.diffuseColor = new BABYLON.Color3(0, 0, 0);
    this.seabed_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    //this.seabed_material.freeze();


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

    // Optimizers
    this.deoptimizer =
      new BABYLON.SceneOptimizer(
        this.scene,
        this.optimizer_options(),
        true,
        true);
    this.deoptimizer.onNewOptimizationAppliedObservable.add((optim) => {
      console.info(optim.getDescription());
    });
    this.deoptimizer.onSuccessObservable.add((optim) => {
      const requestedFps = this.config.get("display.target_fps");
      console.info(`Successfully enhanced display until lower than ${requestedFps} fps.`);
    });
    this.deoptimizer.onFailureObservable.add((optim) => {
      const requestedFps = this.config.get("display.target_fps");
      console.info(`Ran out of display enhancements before going below ${requestedFps} fps.`);
    });
  }

  startRender(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  * optimize(): Generator<null, void, boolean> {
    console.info(`Optimizing for ${this.config.get("display.target_fps")} fps.`);

    this.scene.lensFlaresEnabled = false;
    this.scene.postProcessesEnabled = false;
    this.scene.particlesEnabled = false;
    this.scene.shadowsEnabled = false;
    this.engine.setHardwareScalingLevel(4);
    this.treeShadowMapSize = 512;

    let generator = this.plant();
    while(!generator.next().done) {
      // If the callback is actually a yielding generator, yield here.
      yield;
    }

    this.deoptimizer.targetFrameRate = this.config.get("display.target_fps") - 1;
    this.deoptimizer.reset();
    const that = this;
    setTimeout(() => {that.deoptimizer.start();}, 0);
  }

  optimizer_options(target_fps: number = 30): BABYLON.SceneOptimizerOptions {
    const result = new BABYLON.SceneOptimizerOptions(target_fps, 1000);
    let priority = 0;

    result.optimizations.push(new BABYLON.MergeMeshesOptimization(0));

    // Next priority
    priority++;
    result.optimizations.push(new BABYLON.ShadowsOptimization(priority));
    result.optimizations.push(new HardwareScalingOptimization(priority, 3));

    // Next priority
    priority++;
    result.optimizations.push(new ShadowMapOptimization(priority, this, 1024));
    result.optimizations.push(new HardwareScalingOptimization(priority, 2));

    // Next priority
    priority++;
    result.optimizations.push(new ShadowMapOptimization(priority, this, 2048));
    result.optimizations.push(new HardwareScalingOptimization(priority, 1.5));

    // Next priority
    priority++;
    result.optimizations.push(new HardwareScalingOptimization(priority, 1));

    // Next priority
    priority++;
    result.optimizations.push(new ShadowMapOptimization(priority, this, 4096));

    return result;
  }

  set_sea_material(): void {
    if (this.sea_material) {
      this.sea_material.dispose();
    }
    this.sea_material = new SeaMaterial(
      "sea_material",
      this.tile_size,
      this.mapsize * this.horizon_ratio,
      this.mapsize,
      this.scene);
    this.sea_material.alpha = this.config.get("display.sea_transparency");

    this.sea_material.diffuseColor.r = this.scene.clearColor.r;
    this.sea_material.diffuseColor.g = this.scene.clearColor.g;
    this.sea_material.diffuseColor.b = this.scene.clearColor.b;

    this.sea_material.waveHeight = this.summarise_waves();
    this.sea_material.windDir = this.geography.enviroment.wind_direction;

    if(this.sea_mesh) {
      this.sea_mesh.material = this.sea_material;
    }
  }

  set_land_material(): void {
    if (this.land_material) {
      this.land_material.dispose();
    }

    this.land_material = new LandMaterial("land_material", this.tile_size, this.scene);
    this.land_material.diffuseColor = new BABYLON.Color3(0.3, 0.8, 0.1);

    this.land_material.setNoise(
      this.geography.noise.coefficients_low,
      this.geography.noise.coefficients_mid,
      this.geography.noise.coefficients_high,
      this.config.get(`noise.low_octave_weight`),
      this.config.get(`noise.mid_octave_weight`),
      this.config.get(`noise.high_octave_weight`));

    this.land_material.shoreline = this.config.get("geography.shoreline");
    this.land_material.sealevel = this.config.get("geography.sealevel");
    this.land_material.snowline = this.config.get("geography.snowline");
    this.land_material.rockLikelihood = this.config.get("geography.rockLikelihood");
    this.land_material.riverWidth = this.config.get("geography.riverWidth");
    const riverLikelihood = this.config.get("geography.riverLikelihood");
    this.land_material.riverLikelihood = riverLikelihood * riverLikelihood;
    this.land_material.drainage = this.summarise_drainage();

    if(this.land_mesh) {
      this.land_mesh.material = this.land_material;
    }
  }

  summarise_drainage(): BABYLON.RawTexture {
    const data = new Uint32Array(this.tile_count * this.tile_count * 4);
    let iterator = 0;
    for(let y = 0; y < this.tile_count; y++) {
      for(let x = 0; x < this.tile_count; x++) {
        const tile = this.geography.get_tile({x, y});
        // Create a bitmaps of neighbours draining into this one and out of this one.
        // TODO: Would it be cheaper to calculate drain_from when we are calculating drainage?
        let drain_from = 0;
        let drain_to = 0;
        this.geography.get_neighbours(tile, false).forEach((neighbour, index) => {
          if (neighbour === null) {
            return;
          }
          if (neighbour.lowest_neighbour === tile) {
            drain_from |= (1 << index);
          }
          if (tile.lowest_neighbour === neighbour) {
            drain_to |= (1 << index);
          }
        });

        data[iterator] = drain_from;
        data[iterator + 1] = drain_to;
        data[iterator + 2] = tile.dampness;
        data[iterator + 3] = 0;
        iterator += 4;
      }
    }

    return new BABYLON.RawTexture(
      data,
      this.tile_count,
      this.tile_count,
      BABYLON.Engine.TEXTUREFORMAT_RGBA_INTEGER,
      this.scene,
      false,
      false,
      BABYLON.Engine.TEXTURE_NEAREST_SAMPLINGMODE,
      BABYLON.Engine.TEXTURETYPE_UNSIGNED_INTEGER
    );
  }

  summarise_waves(): BABYLON.RawTexture {
    const data = new Uint32Array(this.tile_count * this.tile_count * 4);
    let iterator = 0;
    for(let y = 0; y < this.tile_count; y++) {
      for(let x = 0; x < this.tile_count; x++) {
        const tile = this.geography.get_tile({x, y});

        data[iterator] = tile.wave_height;
        data[iterator + 1] = tile.shore_gradient;
        data[iterator + 2] = tile.height * 100;
        data[iterator + 3] = 0;
        iterator += 4;
      }
    }

    return new BABYLON.RawTexture(
      data,
      this.tile_count,
      this.tile_count,
      BABYLON.Engine.TEXTUREFORMAT_RGBA_INTEGER,
      this.scene,
      false,
      false,
      BABYLON.Engine.TEXTURE_NEAREST_SAMPLINGMODE,
      BABYLON.Engine.TEXTURETYPE_UNSIGNED_INTEGER
    );
  }

  // Move camera to selected view.
  set_view(direction: string): void {
    const map_center = new BABYLON.Vector3(this.mapsize / 2, 0, this.mapsize / 2);
    const view_pos = 1.5 * this.mapsize
    const view_pos_diag =  this.mapsize + this.mapsize / 2.8
    const view_mid = this.mapsize / 2;
    const view_neg = - this.mapsize / 2
    const view_neg_diag = - this.mapsize / 2.8

    const ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

    let position = new BABYLON.Vector3(view_mid, this.mapsize * 2, view_mid);

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
        position = new BABYLON.Vector3(view_mid, this.mapsize * 2, view_mid);
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
    return (coordinate.y * this.tile_count + coordinate.x);
  }

  // Called before iteration through map's points.
  * draw_start(): Generator<null, void, boolean> {
    // Cleanup any existing meshes from previous draw.
    while(this.scene.meshes.length > 0) {
      if(window.performance.now() - this.generator_start_time > 10) {
        yield;
        this.generator_start_time = window.performance.now()
      }

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

    for(let y = 0; y < this.tile_count; y++) {
      for(let x = 0; x < this.tile_count; x++) {
        if(window.performance.now() - this.generator_start_time > 10) {
          yield;
          this.generator_start_time = window.performance.now()
        }

        // These are the points at the corners of each tile.
        // We actually form these into triangles later in draw_tile(...) where
        // we populate the this.indices[] collection with indexes of
        // this.positions entries.
        const tile = this.geography.get_tile({x, y});
        this.positions.push(x * this.tile_size);
        this.positions.push(tile.height * this.tile_size);
        this.positions.push(y * this.tile_size);
        this.uvs.push(x / this.tile_count);
        this.uvs.push(y / this.tile_count);
      }
    }
  }

  // Called once per tile.
  draw_tile(tile: Tile): void {
    const x = tile.pos.x;
    const y = tile.pos.y;
    if( x < 0 || x >= this.tile_count -1||
        y < 0 || y >= this.tile_count -1) {
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

  // Called as the last stage of the render.
  * draw_end(): Generator<null, void, boolean> {
    // Finish computing land.
    BABYLON.VertexData.ComputeNormals(this.positions, this.indices, this.normals);

    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = this.positions;
    vertexData.indices = this.indices;
    vertexData.uvs = this.uvs;
    vertexData.normals = this.normals;

    this.land_mesh = new BABYLON.Mesh("land");
    vertexData.applyToMesh(this.land_mesh);
    this.land_mesh.isPickable = false;
    // Required to keep camera above ground.
    this.land_mesh.checkCollisions = true;
    //this.land_mesh.convertToFlatShadedMesh();

    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }

    // Show tile edges.
    /*this.land_mesh.enableEdgesRendering(.9999999999);
    this.land_mesh.edgesWidth = 5.0;
    this.land_mesh.edgesColor = new BABYLON.Color4(1, 1, 1, 1);*/

    //this.land_mesh.freezeWorldMatrix();

    // Generate seabed.
    const seabed = BABYLON.MeshBuilder.CreateGround(
      "seabed",
      {width: this.mapsize * this.horizon_ratio,
       height: this.mapsize * this.horizon_ratio}
    );
    seabed.position = new BABYLON.Vector3(
      this.mapsize / 2, -0.01, this.mapsize / 2);
    seabed.material = this.seabed_material;
    seabed.checkCollisions = true;

    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }

    // Generate sea.
    this.sea_mesh = BABYLON.MeshBuilder.CreateGround(
      "sea",
      {width: this.mapsize * this.horizon_ratio,
       height: this.mapsize * this.horizon_ratio}
    );
    this.set_sealevel(this.config.get("geography.sealevel"));
    this.sea_mesh.material = this.sea_material;
    this.sea_mesh.checkCollisions = false;

    // Wave movement.
    let time = 0.0;
    const that = this;
    this.scene.registerBeforeRender(() => {
      time += 0.003;

      if(that.sea_material) {
        that.sea_material.time = time;
      }
    });

    //this.sea_mesh.freezeWorldMatrix();

    // Plant trees.
    //this.plant();
  }

  // Move the height of the sea mesh on the Z axis.
  set_sealevel(sealevel: number): void {
    this.sea_mesh.position = new BABYLON.Vector3(
      this.mapsize / 2, (sealevel + 0.02) * this.tile_size, this.mapsize / 2);

    // Generate waves for the new heights.
    this.geography.blow_wind();
    // Re-texture everything so beaches are at the right height.
    this.set_land_material();
    this.set_sea_material();
  }

  /* Given a vector populated with the x and z coordinates, calculate the
   * corresponding y (height). */
  setHeightToSurface(point: BABYLON.Vector3): number {

    if(point.x >= this.mapsize - this.tile_size ||
      point.z >= this.mapsize - this.tile_size) {
      point.y = 0;
      return 0;
    }

    // Get the 2 triangles that tile this square.
    const indiceStartIndex = (
      (Math.floor(point.z / this.tile_size) * (this.tile_count - 1) +
        Math.floor(point.x / this.tile_size)) * 6);

    // Get points at corners of tile.
    console.assert(indiceStartIndex >= 0);
    console.assert((indiceStartIndex + 5) < this.indices.length);
    console.assert((this.indices[indiceStartIndex + 5] * 3 + 3) < this.positions.length);

    const points = [
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 0] * 3),
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 1] * 3),
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 2] * 3),
      BABYLON.Vector3.FromArray(this.positions, this.indices[indiceStartIndex + 5] * 3)
    ];

    // Each tile is made up of 2 triangles. Calculate which one the point is in.
    point.y = (points[2].y + points[3].y) / 2; // Get the height close to add precision.
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

    // Return the gradient of the tile.
    return Math.abs((triangle[0].y + triangle[1].y) / 2 - triangle[2].y);
  }

  * plant(): Generator<null, void, boolean> {
    if(this.vegetation === null) {
      console.log("Not ready to plant trees yet.");
      return;
    }
    if(this.treeShadowMapSize < 0) {
      this.treeShadowMapSize = 2048;
    }

    // Scrap any existing trees so we can regenerate.
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

    let pineCount = 0;
    let deciduousCount = 0;

    let bufferMatricesPine =
      new Float32Array(16 * this.vegetation.countByType[PlantType.Pine]);
    let bufferMatricesDeciduous =
      new Float32Array(16 * this.vegetation.countByType[PlantType.Deciduous]);

    for(let [keyX, row] of this.vegetation.locations.entries()) {
      for(let [keyY, Plant] of row.entries()) {

        if(window.performance.now() - this.generator_start_time > 10) {
          yield;
          this.generator_start_time = window.performance.now()
        }

        for(let tree of this.vegetation.get(keyX, keyY)) {
          const position = new BABYLON.Vector3(
            tree.position.x * this.tile_size, 0, tree.position.z * this.tile_size);
          this.setHeightToSurface(position);

          // shore_height matches the calculation used in the land material shader in
          // land.fragment.ts.
          const clamped_noise_val =
            Math.max(0, this.geography.noise.get_value(tree.position.x, tree.position.z) / 4.0);
          const shore_height = Math.max(
            this.land_material.shoreline + this.land_material.sealevel + clamped_noise_val,
            this.land_material.sealevel);

          if(position.y / this.tile_size <= shore_height) {
            // Don't draw a tree if it's on or below the beach.
            continue;
          }

          const matrix = BABYLON.Matrix.Compose(
            new BABYLON.Vector3(tree.height, tree.height, tree.height),
            BABYLON.Quaternion.Zero(),
            position
          );

          switch(tree.type_){
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

    this.treesPine = new TreePine(this.scene);
    this.treesPine.leaves.thinInstanceSetBuffer("matrix", bufferMatricesPine, 16, true);
    this.treesPine.trunk.thinInstanceSetBuffer("matrix", bufferMatricesPine, 16, true);
    
    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }
          
    this.treesDeciduous = new TreeDeciduous(this.scene);
    this.treesDeciduous.leaves.thinInstanceSetBuffer("matrix", bufferMatricesDeciduous, 16, true);
    this.treesDeciduous.trunk.thinInstanceSetBuffer("matrix", bufferMatricesDeciduous, 16, true);

    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }

    if(deciduousCount === 0) {
      this.treesDeciduous.trunk.isVisible = false;
      this.treesDeciduous.leaves.isVisible = false;
    }

    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }

    if(pineCount === 0) {
      this.treesPine.trunk.isVisible = false;
      this.treesPine.leaves.isVisible = false;
    }

    if(window.performance.now() - this.generator_start_time > 10) {
      yield;
      this.generator_start_time = window.performance.now()
    }

    this.treeShadows();
  }

  treeShadows(): void {
    if(this.treeShadowGenerator) {
      this.treeShadowGenerator.dispose();
    }

    // Tree shadows.
    if(this.config.get("vegetation.shadow_enabled")) {
      if(this.vegetation === null) {
        console.log("No trees planted yet.");
        return;
      }

      this.treeShadowGenerator =
        new BABYLON.ShadowGenerator(this.treeShadowMapSize, this.light_1);
      //this.treeShadowGenerator.usePoissonSampling = true;
      this.treeShadowGenerator.addShadowCaster(this.treesPine.trunk, true);
      this.treeShadowGenerator.addShadowCaster(this.treesPine.leaves, true);
      this.treeShadowGenerator.addShadowCaster(this.treesDeciduous.trunk, true);
      this.treeShadowGenerator.addShadowCaster(this.treesDeciduous.leaves, true);
      this.land_mesh.receiveShadows = true;
    }
  }

  debug(): void {
    const river_width_mod = this.config.get("geography.riverWidth");
    const river_likelihood = this.config.get("geography.riverLikelihood");
    const maxSpheres = 200000;
    const diameter = 0.1;
    let bufferMatrices = new Float32Array(16 * maxSpheres);

    let count = 0;
    for(let y = 0; y < this.tile_count; y++) {
      for(let x = 0; x < this.tile_count; x++) {
        const tile = this.geography.get_tile({x, y});
        if (tile.height < this.land_material.sealevel) {
          continue;
        }
        for(let yy = y; yy < y + 1; yy += 0.1) {
          if (count > maxSpheres) {
            break;
          }
          for(let xx = x; xx < x + 1; xx += 0.1) {
            if (count > maxSpheres) {
              break;
            }

            if (this.geography.distance_to_river(
              {x: xx, y: yy}, river_width_mod, river_likelihood) <= 0.0
            ) {
              continue;
            }

            const position = new BABYLON.Vector3(xx * this.tile_size, 0, yy * this.tile_size);
            this.setHeightToSurface(position);

            const matrix = BABYLON.Matrix.Compose(
              new BABYLON.Vector3(1, 1, 1),
              BABYLON.Quaternion.Zero(),
              position
            );

            matrix.copyToArray(bufferMatrices, count * 16);

            count++;
          }
        }
      }
    }

    const sphere = BABYLON.MeshBuilder.CreateSphere(
      "sphere", {diameter, segments: 2}, this.scene);
    sphere.thinInstanceSetBuffer("matrix", bufferMatrices, 16, true);
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

/**
 * Defines an optimization used to set the size of the trees shadow map.
 */
class ShadowMapOptimization extends BABYLON.SceneOptimization {

  public getDescription(): string {
    return "Setting shadowMap size to " + this.requestedSize;
  }

  constructor(
    public priority: number = 0,
    public display: Display3d,
    public requestedSize: number = 1024) {
    super(priority);
  }

  public apply(scene: BABYLON.Scene, optimizer: BABYLON.SceneOptimizer): boolean {
    this.display.treeShadowMapSize = this.requestedSize;
    this.display.treeShadows();

    return true;
  }
}

/**
 * Defines an optimization used to set the hardware scaling;
 */
class HardwareScalingOptimization extends BABYLON.SceneOptimization {

  public getDescription(): string {
    return "Setting HW scaling to " + this.requestedSize;
  }

  constructor(
    public priority: number = 0,
    public requestedSize: number = 1024) {
    super(priority);
  }

  public apply(scene: BABYLON.Scene, optimizer: BABYLON.SceneOptimizer): boolean {
    scene.getEngine().setHardwareScalingLevel(this.requestedSize);
    return true;
  }
}
