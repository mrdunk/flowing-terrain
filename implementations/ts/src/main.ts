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

import * as $ from "jquery";
import "bootstrap";

import {Enviroment, Geography, Tile} from "./flowing_terrain"
import {seed_points, seed_points_to_array, get_noise} from "./genesis"
import {draw_2d} from "./2d_view"
import {Display_3d} from "./3d_view"
import {Config} from "./config"

const stats: Record<string, number> = {};

function time(label: string, to_time: () => any) {
  const start = performance.now();
  const return_val = to_time();
  stats[label] = performance.now() - start;
  return return_val;
}

window.onload = () => {
  const enviroment: Enviroment = new Enviroment;
  const config: Config = new Config();
  let sea: Set<string> = null;
  let noise: Array<Array<number>> = null;
  let geography: Geography = null;
  let display: Display_3d = null;

  config.set_if_null("seed_points.random_seed", `${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed", `${(new Date()).getTime()}`);
  config.set_if_null("display.river_threshold", 3);
  config.set_if_null("geography.sealevel", 1);

  function generate_seed_points() {
    sea = time("seed_points", () => {
      return seed_points(config.get("seed_points.random_seed"), enviroment.tile_count);
    });
    draw_2d("2d_seed", seed_points_to_array(enviroment.tile_count, sea));
  }

  function generate_noise() {
    noise = time("noise", () => {
      return get_noise(config.get("noise.random_seed"), enviroment.tile_count);
    });
    draw_2d("2d_heights", noise);
  }

  function generate_terrain() {
    geography = time("geography", () => {
      if(geography === null) {
        return new Geography(enviroment, sea, noise);
      } else {
        geography.terraform(enviroment, sea, noise);
        return geography;
      }
    });

    time("2d_display", () => {
      draw_2d("2d_output", 
        geography.tiles,
        (tile: Tile) => { return tile.height / enviroment.highest_point;});
    });

    display = time("3d_display", () => {
      if(display === null) {
        return new Display_3d(geography, config);
      } else {
        display.draw();
        return display;
      }
    });
  }

  generate_seed_points();
  generate_noise();
  generate_terrain();

  // Start drawing the 3d view.
  display.engine.runRenderLoop(() => {
    display.scene.render();
  })

  window.addEventListener("resize", function () {
    display.engine.resize();
  });


  // UI components below this point.

  const menu_seed_points = document.getElementById("seed_points") as HTMLInputElement;
  menu_seed_points.addEventListener("click", function(event: Event) {
    config.set("seed_points.random_seed", `${(new Date()).getTime()}`);
    generate_seed_points();
    generate_terrain();
  }.bind(config));

  const menu_noise = document.getElementById("noise") as HTMLInputElement;
  menu_noise.addEventListener("click", (event) => {
    config.set("noise.random_seed", `${(new Date()).getTime()}`);
    generate_noise();
    generate_terrain();
  });


  function menu_sealevel_handler(event: Event) {
    const target = <HTMLInputElement>event.target;
    display.set_sealevel(parseFloat(menu_sealevel.value));
  }
  const menu_sealevel: HTMLInputElement = document.getElementById("seaLevel") as HTMLInputElement;
  menu_sealevel.value = config.get("geography.sealevel");
  menu_sealevel.addEventListener("change", menu_sealevel_handler);
  //menu_sealevel.addEventListener("click", menu_sealevel_handler);
  menu_sealevel.addEventListener("input", menu_sealevel_handler);


  function menu_rivers_handler(event: Event) {
    display.set_rivers(parseFloat(menu_rivers.value));
  }
  const menu_rivers = document.getElementById("rivers") as HTMLInputElement;
  menu_rivers.value = config.get("display.river_threshold");
  menu_rivers.addEventListener("change", menu_rivers_handler);
  //menu_rivers.addEventListener("click", menu_rivers_handler);
  menu_rivers.addEventListener("input", menu_rivers_handler);


  function menu_overhead_view(event: Event) {
    display.overhead_view();
  }
  const overhead_view = document.getElementById("overhead_view") as HTMLInputElement;
  overhead_view.addEventListener("click", menu_overhead_view);


  function menu_terraform_handler(event: Event) {
    console.log("terraform");
    generate_terrain();
  }
  const menu_terraform = document.getElementById("terraform") as HTMLInputElement;
  menu_terraform.addEventListener("click", menu_terraform_handler);


  function menu_inspector_handler(event: Event) {
    display.scene.debugLayer.show({embedMode:true});
  }
  const menu_inspector = document.getElementById("inspector") as HTMLInputElement;
  menu_inspector.addEventListener("click", menu_inspector_handler);


  function menu_link_button_handler(event: Event) {
    navigator.clipboard.writeText(config.url.toString()).then(function() {
      /* clipboard successfully set */
      $('.toast').toast('show');
    }, function() {
      /* clipboard write failed */
      console.log(`Failed to copy ${config.url.toString()} to paste buffer.`);
    });
    window.open(config.url.toString());
  }
  const menu_link_button = document.getElementById("link") as HTMLInputElement;
  menu_link_button.addEventListener("click", menu_link_button_handler);
}
