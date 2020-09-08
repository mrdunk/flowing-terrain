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

import {Enviroment, Geography, Tile} from "./flowing_terrain"
import {seed_points, seed_points_to_array, get_noise} from "./genesis"
import {draw_2d} from "./2d_view"
import {Display_3d} from "./3d_view"

const stats: Record<string, number> = {};

function time(label: string, to_time: () => any) {
  const start = performance.now();
  const return_val = to_time();
  stats[label] = performance.now() - start;
  return return_val;
}

window.onload = () => {
  // Create all the components, timing how long they take.
  const enviroment = new Enviroment;

  const sea = time("seed_points", () => {
    return seed_points(enviroment.tile_count);
  });

  const noise = time("get_noise", () => {
    return get_noise(enviroment.tile_count);
  });

  const geography = time("geography", () => {
    return new Geography(enviroment, sea, noise);
  });

  time("2d_display", () => {
    draw_2d("2d_seed", seed_points_to_array(enviroment.tile_count, sea));
    draw_2d("2d_heights", noise);
    draw_2d("2d_output", 
      geography.tiles,
      (tile: Tile) => { return tile.height / enviroment.highest_point;});
  });

  const display = time("3d_display", () => {
    return new Display_3d(geography);
  });

  console.log(stats);

  // Start drawing the 3d view.
  display.engine.runRenderLoop(() => {
    display.scene.render();
  })

  window.addEventListener("resize", function () {
    display.engine.resize();
  });


  // UI components below this point.

  const menu_config = document.getElementById("config");
  menu_config.getElementsByClassName("expandButton")[0].addEventListener("click", (event) => {
    for(let content of menu_config.getElementsByClassName("content")) {
      //const content = menu_config.getElementsByClassName("content")[0] as HTMLElement;
      if(content.classList.contains("hidden")) {
        content.classList.remove("hidden");
      }
      else {
        content.classList.add("hidden");
      }
    }
  });

  function menu_sealevel_handler(event: Event) {
    const target = <HTMLInputElement>event.target;
    display.set_sealevel(parseFloat(menu_sealevel.value));
  }
  const menu_sealevel: HTMLInputElement = document.getElementById("seaLevel") as HTMLInputElement;
  menu_sealevel.addEventListener("change", menu_sealevel_handler);
  //menu_sealevel.addEventListener("click", menu_sealevel_handler);
  menu_sealevel.addEventListener("input", menu_sealevel_handler);

  function menu_rivers_handler(event: Event) {
    display.set_rivers(parseFloat(menu_rivers.value));
  }
  const menu_rivers = document.getElementById("rivers") as HTMLInputElement;
  menu_rivers.addEventListener("change", menu_rivers_handler);
  //menu_rivers.addEventListener("click", menu_rivers_handler);
  menu_rivers.addEventListener("input", menu_rivers_handler);

  function menu_overhead_view(event: Event) {
    display.overhead_view();
  }
  const overhead_view = document.getElementById("overhead_view") as HTMLInputElement;
  overhead_view.addEventListener("click", menu_overhead_view);

  function menu_inspector_handler(event: Event) {
    display.scene.debugLayer.show({embedMode:true});
  }
  const menu_inspector = document.getElementById("inspector") as HTMLInputElement;
  menu_inspector.addEventListener("click", menu_inspector_handler);
}
