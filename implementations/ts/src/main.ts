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
import {seed_points, seed_points_to_array, Noise} from "./genesis"
import {draw_2d} from "./2d_view"
import {Display_3d} from "./3d_view"
import {Config} from "./config"

const stats: Record<string, number> = {};

// TODO: Use console.timer() instead.
function time(label: string, to_time: () => any) {
  const start = performance.now();
  const return_val = to_time();
  stats[label] = performance.now() - start;
  return return_val;
}

window.onload = () => {
  const enviroment: Enviroment = new Enviroment;
  const config: Config = new Config();
  let seabed: Set<string> = null;
  //let noise: Array<Array<number>> = null;
  let noise: Noise = null;
  let geography: Geography = null;
  let display: Display_3d = null;

  config.set_if_null("enviroment.tile_count", 100);
  config.set_if_null("seed_points.random_seed", `${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed_low", `low ${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed_mid", `mid ${(new Date()).getTime()}`);
  config.set_if_null("noise.random_seed_high", `high ${(new Date()).getTime()}`);
  
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

  config.set_if_null("display.river_threshold", 3);
  config.set_callback("display.river_threshold", (key: string, value: any) => {
    display.set_rivers(value);
  });
  
  config.set_if_null("geography.sealevel", 0.5);
  config.set_callback("geography.sealevel", (key: string, value: any) => {
    display.set_sealevel(value);
  });
  
  config.set_if_null("display.sea_transparency", 0.5);
  config.set_callback("display.sea_transparency", (key: string, value: any) => {
    display.sea_material.alpha = value;
  });

  function generate_seed_points() {
    seabed = time("seed_points", () => {
      return seed_points(config, enviroment.tile_count);
    });
    time("2d_seed_map", () => {
      draw_2d("2d_seed_map", seed_points_to_array(enviroment.tile_count, seabed));
    });
  }

  function generate_noise(regenerate: boolean = false) {
    time("noise", () => {
      if(noise === null) {
        noise = new Noise(config);
      }
      noise.generate(regenerate);
    });
    time("2d_noise_map", () => {
      draw_2d("2d_noise_map", noise.data_combined);
    });
  }

  function generate_terrain() {
    geography = time("geography", () => {
      if(geography === null) {
        return new Geography(enviroment, seabed, noise.data_combined);
      } else {
        geography.terraform(enviroment, seabed, noise.data_combined);
        return geography;
      }
    });

    time("2d_height_map", () => {
      draw_2d("2d_height_map", 
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

  console.table(stats);

  // Start drawing the 3d view.
  display.engine.runRenderLoop(() => {
    display.scene.render();
  })

  window.addEventListener("resize", function () {
    display.engine.resize();
  });


  // UI components below this point.

  // Configure HTML input elements.
  for(let input_wrap of document.getElementsByClassName("input-wrap")) {
    const input = input_wrap.getElementsByClassName("input")[0] as HTMLInputElement;
    const bubble = input_wrap.getElementsByClassName("bubble")[0] as HTMLInputElement;
    
    const stored_value = config.get(input.name, false);

    //console.log(
    //  input.name,
    //  input.type === "checkbox" ? input.checked : input.value,
    //  stored_value
    //)

    // Make the HTML element match the stored state.
    if(stored_value !== null) {
      if(input.type === "checkbox") {
        input.checked = stored_value;
      } else {
        input.value = stored_value;
      }
    } else {
      console.warn(
        `Range element does not have coresponding entry in config: ${input.name}`);
    }
    if(bubble) {
      bubble.innerHTML = input.value;
    }

    // Set up HTML element callback.
    input.addEventListener("input", () => {
      const value = input.type === "checkbox" ? input.checked : input.value
      //console.log(input.name, value);
      if(bubble) {
        bubble.innerHTML = `${value}`;
      }
      if(config.get(input.name, false) !== null) {
        // Callback happens as part of the config.set(...).
        if(typeof value === "string") {
          config.set(input.name, parseFloat(value));
        } else {
          config.set(input.name, value);
        }
      }
    });
  }


  // Button to regenerate the seed_point map.
  const menu_seed_points = document.getElementById("seed_points") as HTMLInputElement;
  menu_seed_points.addEventListener("click", function(event: Event) {
    config.set("seed_points.random_seed", `${(new Date()).getTime()}`);
    generate_seed_points();
    generate_terrain();
  }.bind(config));


  // Callabck for adjusting detail of the seed_point map.
  let seed_threshold_timer_fast: ReturnType<typeof setTimeout> = 0;
  let seed_threshold_timer_slow: ReturnType<typeof setTimeout> = 0;
  function seed_threshold_callback(keys: string, value: any) {
    // Only change the minimap every 200ms, even if more updates are sent.
    if(seed_threshold_timer_fast === 0) {
      seed_threshold_timer_fast = setTimeout(() => {
        config.set("seed_points.random_seed", `${(new Date()).getTime()}`);
        generate_seed_points();
        seed_threshold_timer_fast = 0;
      }, 200);
    }
    // Only change the 3d display every 2 seconds.
    if(seed_threshold_timer_slow === 0) {
      seed_threshold_timer_slow = setTimeout(() => {
        generate_terrain();
        seed_threshold_timer_slow = 0;
      }, 2000);
    }
  }


  // Button to regenerate all aspects of the noise map.
  const menu_noise = document.getElementById("noise") as HTMLInputElement;
  menu_noise.addEventListener("click", (event) => {
    generate_noise(true);
    generate_terrain();
  });


  // Callback to set noise octaves.
  // This single callback will work for all octaves.
  let noise_timer_fast: ReturnType<typeof setTimeout> = 0;
  let noise_timer_slow: ReturnType<typeof setTimeout> = 0;
  function noise_octaves_callback(keys: string, value: any) {
    // Only do this every 200ms, even if more updates are sent.
    if(noise_timer_fast === 0) {
      noise_timer_fast = setTimeout(() => {
        generate_noise();
        noise_timer_fast = 0;
      }, 200);
    }
    // Only change the 3d display every 2 seconds.
    if(noise_timer_slow === 0) {
      noise_timer_slow = setTimeout(() => {
        generate_terrain();
        noise_timer_slow = 0;
      }, 2000);
    }
  }

  // Move camera to overhead view.
  const overhead_view = document.getElementById("overhead_view") as HTMLInputElement;
  overhead_view.addEventListener("click", display.overhead_view.bind(display));


  // Launch Babylon.js debug panel.
  function menu_inspector_handler(event: Event) {
    display.scene.debugLayer.show({embedMode:true});
  }
  const menu_inspector = document.getElementById("inspector") as HTMLInputElement;
  menu_inspector.addEventListener("click", menu_inspector_handler);


  // Create a permanent link to the current map.
  function menu_link_button_handler(event: Event) {
    navigator.clipboard.writeText(config.url.toString()).then(function() {
      /* clipboard successfully set */
      $('.toast').toast('show');
    }, function() {
      /* clipboard write failed */
      console.log(`Failed to copy ${config.url.toString()} to paste buffer.`);
    });
    //window.open(config.url.toString());
    const hyperlink: HTMLAnchorElement = document.getElementById("permalink") as HTMLAnchorElement;
    hyperlink.href = config.url.toString();
  }
  const menu_link_button = document.getElementById("link") as HTMLInputElement;
  menu_link_button.addEventListener("click", menu_link_button_handler);

}
