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
import "regenerator-runtime/runtime";

import {Enviroment, Geography, Tile} from "./flowing_terrain";
import {gen_seed_points, seed_point_get_value, Noise} from "./genesis";
import {draw_2d} from "./2d_view";
import {Display3d, Console} from "./3d_view";
import {Config} from "./config";
import '@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js';
import {CollapsibleMenu} from "./custom_html_elements";
import {Planting} from './Planting';

// Hack to force ./custom_html_elements to be loaded.
new CollapsibleMenu();

interface Task {
  label: string;
  getter: any;
  description: string;
  priority?: number;
  time_spent?: number;
  setter?: (value: any) => void;
  generator?: any;
}

/* A simple task scheduler.
 * Tasks are wrappers around functions or generators.
 * The task `label` field is a unique identifier.
 * Tasks have a priority. Lower priority tasks get scheduled before higher.
 * If a task is scheduled and there is already a task with the same label
 * currently being executed (because it is a generator function) the existing
 * task will get deleted and a new, unstarted task will be scheduled.
 */
class TaskList {
  private task_lists: (Task[])[] = [];
  private requested: number = 0;
  private tasklist_div: HTMLElement;
  length: number = 0;

  constructor(private user_console: Console) {
  }

  push(task: Task): void {
    if (task.priority === undefined) {
      task.priority = 0;  // Best priority.
    }

    // Ensure we have enough task lists. One per priority.
    for(let new_index = this.task_lists.length; new_index <= task.priority; new_index++) {
      this.task_lists.push([]);
    }

    const task_list = this.task_lists[task.priority];
    for(let index of task_list.keys()) {
      const existing_task = task_list[index];
      if (existing_task.label === task.label) {
        // Already have task in queue.
        if (existing_task.time_spent === undefined) {
          // Task not started so no need to do anything more.
          return;
        }
        // There is an incomplete task of the same type in progress.
        // Abandon it so the new (unstarted) task takes it's place.
        console.log("Abandon task: ", existing_task.label);
        task_list.splice(index, 1);
        this.length--;
        break;
      }
    }
    task_list.push(task);
    this.length++;
    if (this.requested === 0) {
      this.requested = requestAnimationFrame((now: number) => {this.processTasks(now);});
    }

    this.update_div();
  }

  getNextTask(): Task {
    for(let task_list of this.task_lists) {
      if (task_list.length === 0) {
        continue;
      }

      return task_list[0];
    }
  }

  deleteTask(label: string) {
    for(let task_list of this.task_lists) {
      for(let index of task_list.keys()) {
        const existing_task = task_list[index];
        if (existing_task.label === label) {
          task_list.splice(index, 1);
          this.length--;
          this.update_div();
          return;
        }
      }
    }
  }

  processTasks(taskStartTime_: number): void {
    const taskStartTime: number = window.performance.now();
    let taskFinishTime: number = window.performance.now();
    //console.log("TaskList.processTasks", this.task_list.length);
    this.requested = 0;
    while (taskFinishTime - taskStartTime < 10 && this.length > 0) {
      const task = this.getNextTask();

      if (task.time_spent === undefined) {
        console.log("New task: ", task.label);
        task.time_spent = 0;
      }

      let value;
      if (task.generator !== undefined) {
      } else {
        value = task.getter();
        if (value !== undefined && "next" in value) {
          task.generator = value;
        }
      }

      if (task.generator !== undefined) {
        value = task.generator.next();
        console.assert("done" in value, value);
        if(!value.done) {
          taskFinishTime = window.performance.now();
          task.time_spent += taskFinishTime;
          task.time_spent -= taskStartTime;
          continue;
        }
        value = value.value;
      }

      this.deleteTask(task.label);

      if(task.setter !== undefined) {
        task.setter(value);
      }

      taskFinishTime = window.performance.now();
      task.time_spent += taskFinishTime;
      task.time_spent -= taskStartTime;
      console.log("task: ", task.label,
        "Took:", task.time_spent);
    }

    if (this.length > 0 && this.requested === 0) {
      this.requested = requestAnimationFrame((now: number) => {this.processTasks(now);});
    }
  }

  update_div(): void {
    this.user_console.delay_length = 20000;  // Display console for 20 seconds after update.
    this.user_console.clear();

    let count = 0;
    for(let task_list of this.task_lists) {
      if (task_list.length === 0) {
        continue;
      }
      for(let task of task_list) {
        count++;
      }
    }

    if (count === 0) {
      this.user_console.hide();
      return;
    }

    this.user_console.append(`Updating. ${count} tasks to do.`, "font-weight: bold;");

    for(let task_list of this.task_lists) {
      if (task_list.length === 0) {
        continue;
      }
      for(let task of task_list) {
        this.user_console.append(`${task.description}`);
      }
    }
  }
}

const user_console = new Console();
const taskList = new TaskList(user_console);

window.onload = () => {
  console.time("window.onload");
  const canvas = document.getElementById("renderCanvas");
  const enviroment: Enviroment = new Enviroment();
  const config: Config = new Config();
  let seed_points: Set<string> = null;
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
  config.set_callback("seed_points.threshold", regenerate_seedpoints);

  config.set_if_null("noise.low_octave", 3);
  config.set_callback("noise.low_octave", recalculate_heights);
  config.set_if_null("noise.mid_octave", 4);
  config.set_callback("noise.mid_octave", recalculate_heights);
  config.set_if_null("noise.high_octave", 6);
  config.set_callback("noise.high_octave", recalculate_heights);
  config.set_if_null("noise.low_octave_weight", 3 / 4);
  config.set_callback("noise.low_octave_weight", recalculate_heights);
  config.set_if_null("noise.mid_octave_weight", 1 / 4);
  config.set_callback("noise.mid_octave_weight", recalculate_heights);
  config.set_if_null("noise.high_octave_weight", 1 / 16);
  config.set_callback("noise.high_octave_weight", recalculate_heights);

  config.set_if_null("vegetation.enabled", 1);
  config.set_callback("vegetation.enabled", redraw_vegetation);
  config.set_if_null("vegetation.shadow_enabled", 1);
  config.set_callback("vegetation.shadow_enabled", redraw_vegetation);
  config.set_if_null("vegetation.noise_effect", 5);
  config.set_callback("vegetation.noise_effect", recalculate_vegetation);
  config.set_if_null("vegetation.dampness_effect", 5);
  config.set_callback("vegetation.dampness_effect", recalculate_vegetation);
  config.set_if_null("vegetation.low_octave", 3);
  config.set_callback("vegetation.low_octave", recalculate_vegetation_noise);
  config.set_if_null("vegetation.mid_octave", 5);
  config.set_callback("vegetation.mid_octave", recalculate_vegetation_noise);
  config.set_if_null("vegetation.high_octave", 10);
  config.set_callback("vegetation.high_octave", recalculate_vegetation_noise);
  config.set_if_null("vegetation.low_octave_weight", 0.2);
  config.set_callback("vegetation.low_octave_weight", recalculate_vegetation_noise);
  config.set_if_null("vegetation.mid_octave_weight", 0.5);
  config.set_callback("vegetation.mid_octave_weight", recalculate_vegetation_noise);
  config.set_if_null("vegetation.high_octave_weight", 0.2);
  config.set_callback("vegetation.high_octave_weight", recalculate_vegetation_noise);

  config.set_if_null("terrain.height_constant", 0.05);
  config.set_callback("terrain.height_constant", recalculate_terrain);
  config.set_if_null("terrain.noise_height_weight", 1.0);
  config.set_callback("terrain.noise_height_weight", recalculate_terrain);
  config.set_if_null("terrain.noise_height_polarize", 1.0);
  config.set_callback("terrain.noise_height_polarize", recalculate_terrain);
  config.set_if_null("terrain.noise_gradient_weight", 1.0);
  config.set_callback("terrain.noise_gradient_weight", recalculate_terrain);
  config.set_if_null("terrain.noise_gradient_polarize", 1.0);
  config.set_callback("terrain.noise_gradient_polarize", recalculate_terrain);

  config.set_if_null("geography.riverWidth", 20);
  config.set_callback("geography.riverWidth", (key: string, value: any) => {
    display.set_land_material();
    recalculate_vegetation();
  });

  config.set_if_null("geography.riverLikelihood", 5);
  config.set_callback("geography.riverLikelihood", (key: string, value: any) => {
    display.set_land_material();
    recalculate_vegetation();
  });

  config.set_if_null("display.target_fps", 30);
  config.set_callback("display.target_fps", reoptimize_3d);

  config.set_if_null("geography.sealevel", 0.5);
  config.set_callback("geography.sealevel", (key: string, value: any) => {
    display.set_sealevel(value);
    recalculate_vegetation();
  });

  config.set_if_null("display.sea_transparency", 0.9);
  config.set_callback("display.sea_transparency", (key: string, value: any) => {
    if (display && display.sea_material) {
      display.sea_material.alpha = config.get("display.sea_transparency");
    }
  });

  config.set_if_null("geography.shoreline", 0.05);
  config.set_callback("geography.shoreline", (key: string, value: any) => {
    if (display && display.land_material) {
      display.set_land_material();
      recalculate_vegetation();
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

  config.set_if_null("geography.windDirection", 5);
  config.set_callback("geography.windDirection", (key: string, value: any) => {
    if (display && display.sea_material) {
      display.set_sea_material();
    }
  });

  config.set_if_null("geography.windStrength", 10);
  config.set_callback("geography.windStrength", (key: string, value: any) => {
    if (display && display.sea_material) {
      display.set_sea_material();
    }
  });


  // UI components below this point.

  // Resize the window.
  function* onResize(): Generator<null, void, boolean> {
    let generator_start_time = window.performance.now();
    display.engine.resize();

    const width = window.innerWidth
      || document.documentElement.clientWidth
      || document.body.clientWidth;
    const minimum_width = 1110;

    let menus_open = 0;
    for(const menu of document.getElementsByTagName("collapsable-menu")) {
      if(window.performance.now() - generator_start_time > 10) {
        yield;
        generator_start_time = window.performance.now();
      }

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
      // Have more than one menu open but display is too narrow to fit them.
      // Close all menus.
      for(const menu of document.getElementsByTagName("collapsable-menu")) {
        menu.setAttribute("active", "false");
      }
    }
  }
  window.addEventListener("resize", onResize_task);


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
  menu_seed_points.addEventListener("click", regenerate_seedpoints);


  // Button to regenerate all aspects of the noise map.
  const menu_noise = document.getElementById("noise") as HTMLInputElement;
  menu_noise.addEventListener("click", regenerate_heights);


  // Button to regenerate all aspects of the vegetation map.
  const menu_vegetation = document.getElementById("vegetation") as HTMLInputElement;
  menu_vegetation.addEventListener("click", regenerate_vegetation);

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


  // Set target FPS via slider.
  function reoptimize_3d(keys: string, fps: number): void {
    display.target_fps = fps;
  }


  function gen_seed_points_task(): void {
    taskList.push({
      label: "gen_seed_points",
      description: "Generate terrain start points",
      priority: 0,
      getter: () => {
        return gen_seed_points(config, config.get("enviroment.tile_count"));
      },
      setter: (value) => {
        seed_points = value;
      }
    });
  }

  function draw_2d_seed_map_task(): void {
    taskList.push({
      label: "draw_2d_seed_map",
      description: "Draw terrain start points minimap",
      priority: 1,
      getter: () => {
        return draw_2d(
          "2d_seed_map",
          config.get("enviroment.tile_count"),
          seed_points,
          seed_point_get_value,
          2);
      }
    });
  }

  function gen_noise_task(regenerate: boolean = false): void {
    taskList.push({
      label: "gen_noise",
      description: "Generate terrain noise",
      priority: 2,
      getter: () => {
        if (noise === null) {
          noise = new Noise("noise", config);
        } else {
          noise.generate(regenerate);
        }
      }
    });
  }

  function draw_2d_noise_map_task(): void {
    taskList.push({
      label: "draw_2d_noise_map",
      description: "Draw terrain noise minimap",
      priority: 3,
      getter: () => {
        noise.text(document.getElementById("height_debug"));
        return draw_2d(
          "2d_noise_map",
          noise.length,
          null,
          (x, y, unused) => {return noise.get_value(x, y);},
          2);
      }
    });
  }

  function gen_geography_task(): void {
    taskList.push({
      label: "gen_geography",
      description: "Calculate landscape",
      priority: 4,
      getter: () => {
        if (geography === null) {
          geography = new Geography(config);
        }
        return geography.terraform(enviroment, seed_points, noise);
      }
    });
  }

  function draw_2d_terrain_map_task(): void {
    taskList.push({
      label: "draw_2d_terrain_map",
      description: "Draw terrain minimap",
      priority: 5,
      getter: () => {
        return draw_2d(
          "2d_height_map",
          config.get("enviroment.tile_count"),
          null,
          (x, y, unused) => {return geography.get_tile({x, y}).height / enviroment.highest_point;},
          2);
      }
    });
  }

  function gen_vegetation_task(
    recalculate_noise: boolean = false,
    regenerate_noise: boolean = false
  ): void {
    taskList.push({
      label: "gen_vegetation",
      description: "Calculate tree locations",
      priority: 7,
      getter: () => {
        if (vegetation === null) {
          vegetation = new Planting(geography, config);
          if (display !== null && display.vegetation === null) {
            display.vegetation = vegetation;
          }
        }
        if(recalculate_noise) {
          vegetation.noise_update(regenerate_noise);
        }
        return vegetation.update();
      }
    });
  }

  function draw_2d_vegetation_map_task(): void {
    taskList.push({
      label: "draw_2d_vegetation_map",
      description: "Draw trees minimap",
      priority: 8,
      getter: () => {
        vegetation.noise.text(document.getElementById("vegetation_debug"));
        return draw_2d(
          "vegetation_map",
          vegetation.noise.length,
          null,
          (x, y, unused) => {return vegetation.noise.get_value(x, y);},
          2);
      }
    });
  }

  function draw_3d_terrain_task(): void {
    taskList.push({
      label: "gen_3d",
      description: "Draw 3D land",
      priority: 6,
      getter: () => {
        if (display === null) {
          display = new Display3d(geography, vegetation, config, user_console);
        }
        return display.draw();
      }
    });
  }

  function start_3d_task(): void {
    taskList.push({
      label: "start_3d",
      description: "Start displaying 3D",
      priority: 9,
      getter: () => {
        display.startRender();
        document.getElementById("loader").style.display = "none";
      }
    });
  }

  function onResize_task(): void {
    taskList.push({
      label: "onResize",
      description: "Optimise for screen size",
      priority: 10,
      getter: () => {
        return onResize();
      }
    });
  }

  function final_3d_setup_task(): void {
    taskList.push({
      label: "final_3d_setup",
      description: "Finalise 3d display",
      priority: 11,
      getter: () => {
        display.set_view("up");
        display.startOptimizing();
      }
    });
  }

  function draw_vegetation_3d_task(): void {
    taskList.push({
      label: "draw_vegetation_3d",
      description: "Draw trees",
      priority: 9,
      getter: () => {
        return display.plant();
      }
    });
  }

  function regenerate_seedpoints(): void {
    config.set("seed_points.random_seed", `${(new Date()).getTime()}`);
    gen_seed_points_task();
    draw_2d_seed_map_task();
    gen_geography_task();
    draw_2d_terrain_map_task();
    draw_3d_terrain_task();
    gen_vegetation_task();
    draw_vegetation_3d_task();
  }

  function regenerate_heights(): void {
    gen_noise_task(true);
    draw_2d_noise_map_task();
    gen_geography_task();
    draw_2d_terrain_map_task();
    draw_3d_terrain_task();
    gen_vegetation_task();
    draw_vegetation_3d_task();
  }

  function recalculate_heights(): void {
    gen_noise_task(false);
    draw_2d_noise_map_task();
    gen_geography_task();
    draw_2d_terrain_map_task();
    draw_3d_terrain_task();
    gen_vegetation_task();
    draw_vegetation_3d_task();
  }

  function recalculate_terrain(): void {
    gen_geography_task();
    draw_2d_terrain_map_task();
    draw_3d_terrain_task();
    gen_vegetation_task();
    draw_vegetation_3d_task();
  }

  function regenerate_vegetation(): void {
    gen_vegetation_task(true, true);
    draw_2d_vegetation_map_task();
    draw_vegetation_3d_task();
  }

  function recalculate_vegetation_noise(): void {
    gen_vegetation_task(true, false);
    draw_2d_vegetation_map_task();
    draw_vegetation_3d_task();
  }

  function recalculate_vegetation(): void {
    gen_vegetation_task();
    draw_vegetation_3d_task();
  }

  function redraw_vegetation(): void {
    draw_vegetation_3d_task();
  }

  // Return focus to canvas after any menu is clicked so keyboard controls
  // work.
  window.addEventListener("mouseup", (event) => {
    window.setTimeout(() => canvas.focus(), 0);
  });

  gen_seed_points_task();
  draw_2d_seed_map_task();
  gen_noise_task(true);
  draw_2d_noise_map_task();
  gen_geography_task();
  draw_2d_terrain_map_task();
  gen_vegetation_task();
  draw_2d_vegetation_map_task();
  draw_3d_terrain_task();
  start_3d_task();
  draw_vegetation_3d_task();
  onResize_task();
  final_3d_setup_task();


  console.timeEnd("window.onload");
}
