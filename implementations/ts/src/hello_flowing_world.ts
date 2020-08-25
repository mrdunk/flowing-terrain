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
      new BABYLON.Vector3(-mapsize / 2, mapsize / 2, -mapsize / 2),
      this.scene);
    this.camera.attachControl(renderCanvas);

    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene);

    this.scene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.3);
  }

  draw_tile(tile11: Tile): void {
    const highest_point = this.enviroment.highest_point;

    const x = tile11.pos.x;
    const y = tile11.pos.y;
    const tile00 = this.geography.get_tile({x: x - 1, y: y - 1});
    const tile10 = this.geography.get_tile({x: x    , y: y - 1});
    const tile20 = this.geography.get_tile({x: x + 1, y: y - 1});
    const tile01 = this.geography.get_tile({x: x - 1, y       });
    // const tile11 = this.geography.get_tile({x       , y       });
    const tile21 = this.geography.get_tile({x: x + 1, y       });
    const tile02 = this.geography.get_tile({x: x - 1, y: y + 1});
    const tile12 = this.geography.get_tile({x: x    , y: y + 1});
    const tile22 = this.geography.get_tile({x: x + 1, y: y + 1});

    if(tile00 === null || tile10 === null || tile20 === null ||
       tile01 === null || tile11 === null || tile21 === null ||
       tile02 === null || tile12 === null || tile22 === null) {
      return;
    }

    console.assert(tile00.height !== null);
    console.assert(tile10.height !== null);
    console.assert(tile20.height !== null);

    console.assert(tile01.height !== null);
    console.assert(tile11.height !== null);
    console.assert(tile21.height !== null, {a: tile21.toString()});
    
    console.assert(tile01.height !== null);
    console.assert(tile12.height !== null, {b: tile12.toString()});
    console.assert(tile22.height !== null);

    const offset00 = this.positions.length / 3;
    const offset10 = offset00 + 1;
    const offset20 = offset00 + 2;
    const offset01 = offset00 + 3;
    const offset11 = offset00 + 4;
    const offset21 = offset00 + 5;
    const offset02 = offset00 + 6;
    const offset12 = offset00 + 7;
    const offset22 = offset00 + 8;

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

    this.positions.push(tile00.pos.x * this.tile_size);
    this.positions.push(tile00.height);
    this.positions.push(tile00.pos.y * this.tile_size);
    this.positions.push(tile10.pos.x * this.tile_size);
    this.positions.push(tile10.height);
    this.positions.push(tile10.pos.y * this.tile_size);
    this.positions.push(tile20.pos.x * this.tile_size);
    this.positions.push(tile20.height);
    this.positions.push(tile20.pos.y * this.tile_size);
    this.positions.push(tile01.pos.x * this.tile_size);
    this.positions.push(tile01.height);
    this.positions.push(tile01.pos.y * this.tile_size);
    this.positions.push(tile11.pos.x * this.tile_size);
    this.positions.push(tile11.height);
    this.positions.push(tile11.pos.y * this.tile_size);
    this.positions.push(tile21.pos.x * this.tile_size);
    this.positions.push(tile21.height);
    this.positions.push(tile21.pos.y * this.tile_size);
    this.positions.push(tile02.pos.x * this.tile_size);
    this.positions.push(tile02.height);
    this.positions.push(tile02.pos.y * this.tile_size);
    this.positions.push(tile12.pos.x * this.tile_size);
    this.positions.push(tile12.height);
    this.positions.push(tile12.pos.y * this.tile_size);
    this.positions.push(tile22.pos.x * this.tile_size);
    this.positions.push(tile22.height);
    this.positions.push(tile22.pos.y * this.tile_size);

    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
    this.colors.push(0.1 + 0.1 * tile11.height / highest_point);
    this.colors.push(0.6 - 0.5 * tile11.height / highest_point);
    this.colors.push(0.2);
    this.colors.push(1);
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

    if(highest.dampness <= this.geography.enviroment.dampest / 16) {
      return;
    }

    const mid = this.geography.get_tile(
      {x: (highest.pos.x + lowest.pos.x) / 2, y: (highest.pos.y + lowest.pos.y) / 2});
    // Offset to prevent height fighting during render.
    // Make rivers slightly above land.
    const offset = 0.01;

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
    //seabed_material.diffuseColor = new BABYLON.Color3(0.15, 0.8, 0.2);
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
    //vertexData.normals = this.normals;

    const land = new BABYLON.Mesh("land");
    land.material = land_material;
    vertexData.applyToMesh(land, true);

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

    // Generate sea.
    const sea = BABYLON.MeshBuilder.CreateGround(
      "sea", {width: mapsize * 2, height: mapsize * 2});
    sea.position = new BABYLON.Vector3(mapsize / 2, 0, mapsize / 2);
    sea.material = sea_material;

    this.camera.setTarget(sea.position);
  }
}

const geography = new Geography();
const display = new Display(geography);
display.draw();

display.engine.runRenderLoop(() => {
    display.scene.render();
})
