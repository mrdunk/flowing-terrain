import * as BABYLON from 'babylonjs';
import {Geography, Tile, Display, Coordinate} from "./flowing_terrain"


//import { ArcRotateCamera, Engine, HemisphericLight, MeshBuilder, Scene, Vector3 } from "babylonjs"
//import { SampleMaterial } from "./Materials/SampleMaterial"


const renderCanvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine: BABYLON.Engine = new BABYLON.Engine(renderCanvas, true);

const scene: BABYLON.Scene = new BABYLON.Scene(engine);

const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3.2,
    2,
    BABYLON.Vector3.Zero(),
    scene);

camera.attachControl(renderCanvas);

const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene);

var tile_size = 0.5;
class DisplayToBabylon extends Display {
  positions: Array<number> = [];
  indices: Array<number> = [];
  colors: Array<number> = [];
  normals: Array<number> = [];
  
  draw_tile(coordinate: Coordinate): void {
    let tile = this.geography.get_tile(coordinate);

    this.indices.push(this.positions.length / 3);
    this.indices.push(1 + this.positions.length / 3);
    this.indices.push(2 + this.positions.length / 3);
    this.indices.push(this.positions.length / 3);
    this.indices.push(2 + this.positions.length / 3);
    this.indices.push(3 + this.positions.length / 3);


    this.positions.push(tile.pos.x);
    this.positions.push(tile.height);
    this.positions.push(tile.pos.y);

    this.positions.push(tile.pos.x + tile_size);
    this.positions.push(tile.height);
    this.positions.push(tile.pos.y);

    this.positions.push(tile.pos.x + tile_size);
    this.positions.push(tile.height);
    this.positions.push(tile.pos.y + tile_size);

    this.positions.push(tile.pos.x);
    this.positions.push(tile.height);
    this.positions.push(tile.pos.y + tile_size);


    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(1);
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(1);
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(1);
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(Math.random());
    this.colors.push(1);
  }

  draw_end(): void {
    BABYLON.VertexData.ComputeNormals(this.positions, this.indices, this.normals);

    var vertexData = new BABYLON.VertexData();

    vertexData.positions = this.positions;
    vertexData.indices = this.indices;
    vertexData.colors = this.colors;
    vertexData.normals = this.normals;

    var customMesh = new BABYLON.Mesh("custom", scene);
    vertexData.applyToMesh(customMesh, true);
  }
}

let geography = new Geography();
let display = new DisplayToBabylon(geography);
display.draw();

engine.runRenderLoop(() => {
    scene.render();
})


