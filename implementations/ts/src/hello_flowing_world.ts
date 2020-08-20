import * as BABYLON from 'babylonjs';
import {Geography, Tile, Display, Coordinate} from "./flowing_terrain"


class BabylonDisplay extends Display {
  tile_size: number = 5;
  positions: Array<number> = [];
  indices: Array<number> = [];
  colors: Array<number> = [];
  normals: Array<number> = [];
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.UniversalCamera;

  constructor(geography: Geography) {
    super(geography);
    const renderCanvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(renderCanvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.camera = new BABYLON.UniversalCamera(
      "UniversalCamera", new BABYLON.Vector3(0, 100, 0), this.scene);
    this.camera.attachControl(renderCanvas);

    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene);

    this.scene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.3);
  }

  draw_tile(coord: Coordinate): void {
    const highest_point = this.enviroment.highest_point;

    const tile00 = this.geography.get_tile(coord);
    const tile10 = this.geography.get_tile({x: coord.x + 1, y: coord.y});
    const tile01 = this.geography.get_tile({x: coord.x, y: coord.y + 1});
    const tile11 = this.geography.get_tile({x: coord.x + 1, y: coord.y + 1});

    if(tile00 && tile10 && tile01 && tile11) {
      this.indices.push(this.positions.length / 3);
      this.indices.push(1 + this.positions.length / 3);
      this.indices.push(3 + this.positions.length / 3);
      this.indices.push(this.positions.length / 3);
      this.indices.push(3 + this.positions.length / 3);
      this.indices.push(2 + this.positions.length / 3);

      this.positions.push(tile00.pos.x * this.tile_size);
      this.positions.push(tile00.height);
      this.positions.push(tile00.pos.y * this.tile_size);
      this.positions.push(tile10.pos.x * this.tile_size);
      this.positions.push(tile10.height);
      this.positions.push(tile10.pos.y * this.tile_size);
      this.positions.push(tile01.pos.x * this.tile_size);
      this.positions.push(tile01.height);
      this.positions.push(tile01.pos.y * this.tile_size);
      this.positions.push(tile11.pos.x * this.tile_size);
      this.positions.push(tile11.height);
      this.positions.push(tile11.pos.y * this.tile_size);

      this.colors.push(0.1 + 0.1 * tile00.height / highest_point);
      this.colors.push(0.6 - 0.5 * tile00.height / highest_point);
      this.colors.push(0.2);
      this.colors.push(1);
      this.colors.push(0.1 + 0.1 * tile00.height / highest_point);
      this.colors.push(0.6 - 0.5 * tile00.height / highest_point);
      this.colors.push(0.2);
      this.colors.push(1);
      this.colors.push(0.1 + 0.1 * tile00.height / highest_point);
      this.colors.push(0.6 - 0.5 * tile00.height / highest_point);
      this.colors.push(0.2);
      this.colors.push(1);
      this.colors.push(0.1 + 0.1 * tile00.height / highest_point);
      this.colors.push(0.6 - 0.5 * tile00.height / highest_point);
      this.colors.push(0.2);
      this.colors.push(1);
    }
  }

  draw_end(): void {
    const land_material = new BABYLON.StandardMaterial("land_material", this.scene);
    land_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    const seabed_material = new BABYLON.StandardMaterial("sea_material", this.scene);
    seabed_material.diffuseColor = new BABYLON.Color3(0.15, 0.8, 0.2);
    seabed_material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    seabed_material.backFaceCulling = false;

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

    // Generate seabed.
    const mapsize = this.tile_size * this.enviroment.tile_count;
    const seabed = BABYLON.MeshBuilder.CreateGround(
      "seabed", {width: mapsize * 2, height: mapsize * 2});
    seabed.position = new BABYLON.Vector3(mapsize / 2, -this.enviroment.sealevel, mapsize / 2);
    seabed.material = seabed_material;

    // Generate sea.
    const sea = BABYLON.MeshBuilder.CreateGround(
      "sea", {width: mapsize * 2, height: mapsize * 2});
    sea.position = new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2);
    sea.material = sea_material;

    this.camera.setTarget(sea.position);
  }
}

const geography = new Geography();
const display = new BabylonDisplay(geography);
display.draw();

display.engine.runRenderLoop(() => {
    display.scene.render();
})
