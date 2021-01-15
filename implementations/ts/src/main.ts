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

import {Enviroment, Geography, Tile} from "./flowing_terrain";
import {seed_points, seed_point_get_value, Noise} from "./genesis";
import {draw_2d} from "./2d_view";
import {Display3d} from "./3d_view";
import {Config} from "./config";
import '@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js';
import {CollapsibleMenu} from "./custom_html_elements";
import {Planting} from './Planting';

// Hack to force ./custom_html_elements to be loaded.
new CollapsibleMenu();

window.onload = () => {
  console.time("window.onload");
  const canvas = document.getElementById("renderCanvas");
  const enviroment: Enviroment = new Enviroment();
  const config: Config = new Config();
  let seabed: Set<string> = null;
  let noise: Noise = null;
  let geography: Geography = null;
  let display: Display3d = null;
  let vegetation: Planting = null;

  config.set_if_null("enviroment.tile_count", 100);
  config.set_if_null("seed_points.random_seed", `${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed_low", `low ${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed_mid", `mid ${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed_high", `high ${(new Date()).getTime()}`);
  config.set_if_null("vegetation.random_seed_low", `v low ${(new Date()).getTime()}`);
  config.set_if_null("vegetation.random_seed_mid", `v mid ${(new Date()).getTime()}`);
  config.set_if_null("vegetation.random_seed_high", `v high ${(new Date()).getTime()}`);

  config.set_if_null("seed_points.threshold", 0.18);
  config.set_callback("seed_points.threshold", seed_threshold_callback);

  config.set_if_null("noise.low_octave", 3);
  config.set_callback("noise.low_octave", noise_octaves_callback);
  config.set_if_null("noise.mid_octave", 5);
  config.set_callback("noise.mid_octave", noise_octaves_callback);
  config.set_if_null("noise.high_octave", 10);
  config.set_callback("noise.high_octave", noise_octaves_callback);
  config.set_if_null("noise.low_octave_weight", 1.5);
  config.set_callback("noise.low_octave_weight", noise_octaves_callback);
  config.set_if_null("noise.mid_octave_weight", 0.5);
  config.set_callback("noise.mid_octave_weight", noise_octaves_callback);
  config.set_if_null("noise.high_octave_weight", 0.2);
  config.set_callback("noise.high_octave_weight", noise_octaves_callback);

  config.set_if_null("vegetation.enabled", 1);
  config.set_callback("vegetation.enabled", vegetation_enabled);
  config.set_if_null("vegetation.shadow_enabled", 1);
  config.set_callback("vegetation.shadow_enabled", vegetation_enabled);
  config.set_if_null("vegetation.noise_effect", 5);
  config.set_callback("vegetation.noise_effect", vegetation_octaves_callback);
  config.set_if_null("vegetation.dampness_effect", 5);
  config.set_callback("vegetation.dampness_effect", vegetation_octaves_callback);
  config.set_if_null("vegetation.low_octave", 3);
  config.set_callback("vegetation.low_octave", vegetation_octaves_callback);
  config.set_if_null("vegetation.mid_octave", 5);
  config.set_callback("vegetation.mid_octave", vegetation_octaves_callback);
  config.set_if_null("vegetation.high_octave", 10);
  config.set_callback("vegetation.high_octave", vegetation_octaves_callback);
  config.set_if_null("vegetation.low_octave_weight", 0.2);
  config.set_callback("vegetation.low_octave_weight", vegetation_octaves_callback);
  config.set_if_null("vegetation.mid_octave_weight", 0.5);
  config.set_callback("vegetation.mid_octave_weight", vegetation_octaves_callback);
  config.set_if_null("vegetation.high_octave_weight", 0.2);
  config.set_callback("vegetation.high_octave_weight", vegetation_octaves_callback);

  config.set_if_null("terrain.height_constant", 0.01);
  config.set_callback("terrain.height_constant", terrain_callback);
  config.set_if_null("terrain.noise_height_weight", 1.0);
  config.set_callback("terrain.noise_height_weight", terrain_callback);
  config.set_if_null("terrain.noise_height_polarize", 1.0);
  config.set_callback("terrain.noise_height_polarize", terrain_callback);
  config.set_if_null("terrain.noise_gradient_weight", 0.6);
  config.set_callback("terrain.noise_gradient_weight", terrain_callback);
  config.set_if_null("terrain.noise_gradient_polarize", 1.0);
  config.set_callback("terrain.noise_gradient_polarize", terrain_callback);

  config.set_if_null("geography.riverWidth", 20);
  config.set_callback("geography.riverWidth", (key: string, value: any) => {
    display.set_rivers(value);
    vegetation_octaves_callback(null, null);
  });

  config.set_if_null("geography.riverLikelihood", 5);
  config.set_callback("geography.riverLikelihood", (key: string, value: any) => {
    display.set_rivers(value);
    vegetation_octaves_callback(null, null);
  });

  config.set_if_null("display.target_fps", 30);
  config.set_callback("display.target_fps", reoptimize_3d);

  config.set_if_null("geography.sealevel", 0.5);
  config.set_callback("geography.sealevel", (key: string, value: any) => {
    display.set_sealevel(value);
    vegetation_octaves_callback(null, null);
  });

  config.set_if_null("display.sea_transparency", 0.9);
  config.set_callback("display.sea_transparency", (key: string, value: any) => {
    if (display && display.sea_material) {
      display.sea_material.alpha = config.get("display.sea_transparency");
    }
  });

  config.set_if_null("geography.shoreline", 0.05);
  config.set_callback("geography.shoreline", (key: string, value: any) => {
    console.log("geography.shoreline");
    if (display && display.land_material) {
      display.set_land_material();
      vegetation_octaves_callback(null, null);
    }
  });

  config.set_if_null("geography.snowline", 10.0);
  config.set_callback("geography.snowline", (key: string, value: any) => {
    if (display && display.land_material) {
      display.set_land_material();
    }
  });

  config.set_if_null("geography.rockLikelihood", 1.0);
  config.set_callback("geography.rockLikelihood", (key: string, value: any) => {
    if (display && display.land_material) {
      display.set_land_material();
    }
  });

  function generate_seed_points() {
    seabed = seed_points(config, config.get("enviroment.tile_count"));
    draw_2d("2d_seed_map", config.get("enviroment.tile_count"), seabed, seed_point_get_value, 2);
  }

  function generate_noise(regenerate: boolean = false) {
    if(noise === null) {
      noise = new Noise("noise", config);
    } else {
      noise.generate(regenerate);
    }
    draw_2d(
      "2d_noise_map",
      noise.length,
      null,
      (x, y, unused) => {return noise.get_value(x, y);},
      2);
    noise.text(document.getElementById("height_debug"));
  }

  function generate_terrain() {
    if(geography === null) {
      geography = new Geography(enviroment, config, seabed, noise);
    } else {
      geography.terraform(enviroment, seabed, noise);
    }
    
    generate_vegetation();

    draw_2d(
      "2d_height_map",
      config.get("enviroment.tile_count"),
      null,
      (x, y, unused) => {return geography.tiles[x][y].height / enviroment.highest_point;},
      2);

    if(display === null) {
      display = new Display3d(geography, vegetation, config);
    } else {
      display.draw();
    }
  }

  let vegetation_timer: ReturnType<typeof setTimeout> = 0;
  function generate_vegetation() {
    if(vegetation === null) {
      vegetation = new Planting(geography, config);
    }
    if(vegetation_timer === 0) {
      vegetation_timer = setTimeout(() => {
        vegetation_timer = 0;
        vegetation.update();
        draw_vegetation();
        draw_vegetation_2d_map();
      }, 1000);
    }
  }

  function draw_vegetation() {
    if(display !== null) {
      display.plant();
    }
  }

  function draw_vegetation_2d_map() {
    draw_2d(
      "vegetation_map",
      vegetation.noise.length,
      null,
      (x, y, unused) => {return vegetation.noise.get_value(x, y);},
      2);
    vegetation.noise.text(document.getElementById("vegetation_debug"));
  }

  generate_seed_points();
  generate_noise();
  generate_terrain();

  // Start drawing the 3d view.
  display.engine.runRenderLoop(() => {
    display.scene.render();
  })

  display.set_view("up");

  // UI components below this point.


  // Resize the window.
  function onResize() {
    display.engine.resize();

    const width = window.innerWidth
      || document.documentElement.clientWidth
      || document.body.clientWidth;
    const minimum_width = 1110;

    let menus_open = 0;
    for(const menu of document.getElementsByTagName("collapsable-menu")) {
      // Count how many menus are open.
      if(menu.hasAttribute("active") &&
          menu.getAttribute("active").toLowerCase() === "true") {
        menus_open += 1;
      }

      if(width <= minimum_width) {
        // For narrow display, put all menus in same group so only one will be
        // open at a time.
        if(!menu.hasAttribute("original-group")) {
          menu.setAttribute("original-group", menu.getAttribute("group"));
        }
        menu.setAttribute("group", "left");
      } else {
        // For wider displays, put menus in separate groups.
        if(menu.hasAttribute("original-group")) {
          menu.setAttribute("group", menu.getAttribute("original-group"));
        }
      }
    }
    if(width <= minimum_width && menus_open > 1) {
      // Wave more than one menu open when display is too narrow to fit them.
      // Close all menus.
      for(const menu of document.getElementsByTagName("collapsable-menu")) {
        menu.setAttribute("active", "false");
      }
    }

    display.optimize();
  }
  window.addEventListener("resize", onResize);
  onResize();


  // Initialise Slider controls.
  for(const node of document.getElementsByTagName("feedback-slider")) {
    const slider = node as HTMLInputElement;
    const name = slider.getAttribute("name");
    console.assert(name !== null && name !== undefined);
    const stored_value = config.get(name, false);

    // Make the HTML element match the stored state at startup.
    if(stored_value !== null) {
      slider.setAttribute("value", stored_value);
    } else {
      console.warn(
        `Range element does not have coresponding entry in config: ${name}`);
    }

    // Set up callback when slider moves.
    slider.addEventListener("change", () => {
      if(config.get(name, false) !== null) {
        // Callback to update map happens as part of the config.set(...).
        console.assert(typeof slider.value === "string");
        config.set(name, parseFloat(slider.value));
      }
    });
    slider.addEventListener("input", () => {
      if(config.get(name, false) !== null) {
        // Callback to update map happens as part of the config.set(...).
        console.assert(typeof slider.value === "string");
        config.set(name, parseFloat(slider.value));
      }
    });
  }

  // Initialise checkbox controls.
  for(const node of document.getElementsByTagName("input")) {
    if(node.type === "checkbox") {
      node.checked = config.get(node.name);
      node.addEventListener("change", () => {
        console.info(`Checkbox ${node.name} changed to ${node.checked}`);
        if(config.get(node.name, false) !== null) {
          // Callback to update map happens as part of the config.set(...).
          config.set(node.name, node.checked ? 1 : 0);
        }
      });
    }
  }

  // Button to regenerate the seed_point map.
  const menu_seed_points = document.getElementById("seed_points") as HTMLInputElement;
  menu_seed_points.addEventListener("click", (event: Event) => {
    config.set("seed_points.random_seed", `${(new Date()).getTime()}`);
    generate_seed_points();
    generate_terrain();
  });


  // Callback for adjusting detail of the seed_point map.
  function seed_threshold_callback(keys: string, value: any) {
    setTimeout(() => {
      config.set("seed_points.random_seed", `${(new Date()).getTime()}`);
      generate_seed_points();
    }, 0);
    terrain_callback(keys, value);
  }


  // Button to regenerate all aspects of the noise map.
  const menu_noise = document.getElementById("noise") as HTMLInputElement;
  menu_noise.addEventListener("click", (event) => {
    generate_noise(true);
    generate_terrain();
  });


  // Callback to set noise octaves.
  // This single callback will work for all octaves.
  function noise_octaves_callback(keys: string, value: any) {
    setTimeout(() => {
      generate_noise();
    }, 0);
    terrain_callback(keys, value);
  }


  // Callback to regenerate terrain after settings change.
  let terrain_timer: ReturnType<typeof setTimeout> = 0;
  function terrain_callback(keys: string, value: any) {
    // Only change the 3d display every 2 seconds.
    if(terrain_timer === 0) {
      terrain_timer = setTimeout(() => {
        terrain_timer = 0;
        generate_terrain();
      }, 2000);
    }
  }


  // Button to regenerate all aspects of the vegetation map.
  const menu_vegetation = document.getElementById("vegetation") as HTMLInputElement;
  menu_vegetation.addEventListener("click", (event) => {
    vegetation.noise_update(true);
    generate_vegetation();
  });

  // Callback to set whether trees should be displayed or not.
  function vegetation_enabled(keys: string, value: any) {
    draw_vegetation();
  }

  // Callback to set vegetation noise octaves.
  // This single callback will work for all octaves.
  function vegetation_octaves_callback(keys: string, value: any) {
    setTimeout(() => {
      vegetation.noise_update();
      draw_vegetation_2d_map();
    }, 0);

    generate_vegetation();    
  }


  // Move camera to selected view.
  const views = document.getElementById("views").querySelectorAll(".btn");
  views.forEach((view) => {
    view.addEventListener("click", (event) => {
      const parts = view.id.split("-", 3);
      let direction = parts[1];
      if(parts.length > 2) {
        direction += "-";
        direction += parts[2];
      }
      display.set_view(direction);
    });
  });


  // Launch Babylon.js debug panel.
  function menu_inspector_handler(event: Event) {
    display.scene.debugLayer.show({embedMode:true});
  }
  const menu_inspector = document.getElementById("inspector") as HTMLInputElement;
  menu_inspector.addEventListener("click", menu_inspector_handler);


  // Create a permanent link to the current map.
  const menu_link = document.getElementById("link");
  const button = menu_link.shadowRoot.querySelector("button");

  function menu_link_button_handler(event: Event) {
    if(navigator.clipboard !== undefined) {
      navigator.clipboard.writeText(config.url.toString()).then(() => {
        // clipboard write success.
        menu_link.querySelector(".success").classList.add("show");
      }, () => {
        // clipboard write failed
        menu_link.querySelector(".fail").classList.add("show");
        console.log(`Failed to copy ${config.url.toString()} to paste buffer.`);
      });
    } else {
      console.log(`Failed to copy ${config.url.toString()} to paste buffer.`);
    }

    // window.open(config.url.toString());
    const hyperlink: HTMLAnchorElement = document.getElementById("permalink") as HTMLAnchorElement;
    hyperlink.href = config.url.toString();
  }
  button.addEventListener("click", menu_link_button_handler, false);


  // Button to run SceneOptimizer again.
  const menu_reoprimize = document.getElementById("display_reoptimize") as HTMLInputElement;
  menu_reoprimize.addEventListener("click", (event) => {
    display.optimize();
  });

  // Run Babylon's SceneOptimizer again.
  function reoptimize_3d(keys: string, fps: number): void {
    display.optimize();
  }


  // Return focus to canvas after any menu is clicked so keyboard controls
  // work.
  window.addEventListener("mouseup", (event) => {
    window.setTimeout(() => canvas.focus(), 0);
  });
  console.timeEnd("window.onload");
}
