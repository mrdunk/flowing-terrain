import * as BABYLON from 'babylonjs';
import {Geography, Tile, DisplayBase, Coordinate} from "./flowing_terrain"


class Display extends DisplayBase {
  tile_size: number = 1;
  positions: Array<number> = [];
  indices: Array<number> = [];
  colors: Array<number> = [];
  normals: Array<number> = [];
  rivers: Array<Array<BABYLON.Vector3>> = [];

  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.UniversalCamera;

  constructor(geography: Geography) {
    super(geography);
    const mapsize = this.tile_size * this.enviroment.tile_count;

    const renderCanvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(renderCanvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.camera = new BABYLON.UniversalCamera(
      "UniversalCamera",
      new BABYLON.Vector3(-mapsize / 4, mapsize / 4, -mapsize / 4),
      this.scene);
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new BABYLON.Vector3(0.5, 0.5, 0.5);
    this.camera.attachControl(renderCanvas);

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
  }
  
  coordinate_to_index(coordinate: Coordinate): number {
    return (coordinate.y * this.enviroment.tile_count + coordinate.x);
  }
  
  // Called before iteration through map's points.
  draw_start(): void {
    for(let y = 0; y < this.enviroment.tile_count; y++) {
      for(let x = 0; x < this.enviroment.tile_count; x++) {
        const tile = this.geography.get_tile({x, y});

        this.positions.push(tile.pos.x * this.tile_size);
        this.positions.push(tile.height);
        this.positions.push(tile.pos.y * this.tile_size);

        this.colors.push(0.2);
        this.colors.push(0.5);
        this.colors.push(0.2);
        this.colors.push(1);
      }
    }
  }

  draw_tile(tile: Tile): void {
    const x = tile.pos.x;
    const y = tile.pos.y;
    if( x < 1 || x >= this.enviroment.tile_count ||
        y < 1 || y >= this.enviroment.tile_count) {
      return;
    }

    const offset00 = this.coordinate_to_index({x: x - 1, y: y - 1});
    const offset10 = this.coordinate_to_index({x: x + 0, y: y - 1});
    const offset20 = this.coordinate_to_index({x: x + 1, y: y - 1});
    const offset01 = this.coordinate_to_index({x: x - 1, y: y + 0});
    const offset11 = this.coordinate_to_index({x: x + 0, y: y + 0});
    const offset21 = this.coordinate_to_index({x: x + 1, y: y + 0});
    const offset02 = this.coordinate_to_index({x: x - 1, y: y + 1});
    const offset12 = this.coordinate_to_index({x: x + 0, y: y + 1});
    const offset22 = this.coordinate_to_index({x: x + 1, y: y + 1});

    this.indices.push(offset11);
    this.indices.push(offset00);
    this.indices.push(offset10);

    this.indices.push(offset11);
    this.indices.push(offset10);
    this.indices.push(offset20);

    this.indices.push(offset11);
    this.indices.push(offset20);
    this.indices.push(offset21);

    this.indices.push(offset11);
    this.indices.push(offset21);
    this.indices.push(offset22);

    this.indices.push(offset11);
    this.indices.push(offset22);
    this.indices.push(offset12);

    this.indices.push(offset11);
    this.indices.push(offset12);
    this.indices.push(offset02);

    this.indices.push(offset11);
    this.indices.push(offset02);
    this.indices.push(offset01);

    this.indices.push(offset11);
    this.indices.push(offset01);
    this.indices.push(offset00);
  }
  
  // Draw drainage between 2 points.
  draw_river(highest: Tile, lowest: Tile): void {
    if(highest === null || lowest === null) {
      return;
    }
    if(highest.height < 0.0) {
      // Whole thing below sealevel.
      return;
    }

    // Only draw rivers in the wettest tiles.
    if(highest.dampness <= this.geography.enviroment.dampest / 16) {
      return;
    }

    const mid = this.geography.get_tile(
      {x: (highest.pos.x + lowest.pos.x) / 2, y: (highest.pos.y + lowest.pos.y) / 2});
    // Offset to prevent height fighting during render.
    // Make rivers slightly above land.
    const offset = 0.01;

    // Prove river is indeed flowing down hill.
    console.assert( highest.height >= mid.height, {errormessage: "river flows uphill"});
    console.assert( mid.height >= lowest.height, {errormessage: "river flows uphill"});

    const river: Array<BABYLON.Vector3> = [];
    river.push(new BABYLON.Vector3(
      highest.pos.x * this.tile_size, highest.height + offset, highest.pos.y * this.tile_size));

    // River section from highest to mid-point.
    if(mid.height >= 0.0) {
      river.push(new BABYLON.Vector3(
        mid.pos.x * this.tile_size, mid.height + offset, mid.pos.y * this.tile_size));
    } else {
      // Stop at shoreline.
      const ratio_x = (highest.pos.x - mid.pos.x) / (highest.height - mid.height);
      const ratio_y = (highest.pos.y - mid.pos.y) / (highest.height - mid.height);
      let x = highest.pos.x - (highest.height * ratio_x);
      let y = highest.pos.y - (highest.height * ratio_y);
      river.push(new BABYLON.Vector3(x, 0 + offset, y));
    }

    // River section from mid-point to lowest.
    if(lowest.height >= 0.0) {
      river.push(new BABYLON.Vector3(
        lowest.pos.x * this.tile_size, lowest.height + offset, lowest.pos.y * this.tile_size));
    } else if(mid.height >= 0.0) {
      // Stop at shoreline.
      const ratio_x = (mid.pos.x - lowest.pos.x) / (mid.height - lowest.height);
      const ratio_y = (mid.pos.y - lowest.pos.y) / (mid.height - lowest.height);
      let x = mid.pos.x - (mid.height * ratio_x);
      let y = mid.pos.y - (mid.height * ratio_y);
      river.push(new BABYLON.Vector3(x, 0 + offset, y));
    }

    this.rivers.push(river);
  }

  draw_end(): void {
    const land_material = new BABYLON.StandardMaterial("land_material", this.scene);
    land_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    //land_material.backFaceCulling = false;

    const seabed_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    seabed_material.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.2);
    seabed_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    //seabed_material.backFaceCulling = false;

    const sea_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    sea_material.diffuseColor = new BABYLON.Color3(0, 0.3, 1);
    sea_material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    sea_material.alpha = 0.85;
    sea_material.backFaceCulling = false;

    // Finish computing land.
    BABYLON.VertexData.ComputeNormals(this.positions, this.indices, this.normals);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = this.positions;
    vertexData.indices = this.indices;
    vertexData.colors = this.colors;
    vertexData.normals = this.normals;

    const land = new BABYLON.Mesh("land");
    land.material = land_material;
    vertexData.applyToMesh(land, true);
    land.checkCollisions = true;
    //land.convertToFlatShadedMesh();

    // Rivers
    this.rivers.forEach((river) => {
      const mesh = BABYLON.MeshBuilder.CreateLines(
        "river", {points: river}, this.scene); 
      mesh.enableEdgesRendering();
      mesh.edgesWidth = 6.0;
    });
    
    // Generate seabed.
    const mapsize = this.tile_size * this.enviroment.tile_count;
    const seabed = BABYLON.MeshBuilder.CreateGround(
      "seabed", {width: mapsize * 2, height: mapsize * 2});
    seabed.position = new BABYLON.Vector3(
      mapsize / 2, -this.enviroment.sealevel - 0.01, mapsize / 2);
    seabed.material = seabed_material;
    seabed.checkCollisions = true;

    // Generate sea.
    const sea = BABYLON.MeshBuilder.CreateGround(
      "sea", {width: mapsize * 2, height: mapsize * 2});
    sea.position = new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2);
    sea.material = sea_material;
    //sea.checkCollisions = false;

    this.camera.setTarget(sea.position);
  }
}

const geography = new Geography();
const display = new Display(geography);
display.draw();

display.engine.runRenderLoop(() => {
  display.scene.render();
})

window.addEventListener("resize", function () {
  display.engine.resize();
});

document.getElementById('renderCanvas').focus();
