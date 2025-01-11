import { Camera } from './camera.js';
import KeyboardState from '../lib/keyboard-state.js';

import { Vector3 } from 'three';
import { RayTracingRenderer } from './ray-tracing-renderer.js';
import { Model } from './model.js';
import { Scene } from './scene.js';

main();

async function main() {
  const renderer = new RayTracingRenderer(innerWidth, innerHeight, 3);
  await renderer.compile_shaders();
  document.body.appendChild(renderer.canvas);
  const camera = new Camera(renderer.gl, 60, 45, 1, renderer.canvas.width, renderer.canvas.height, new Vector3(0, 0, 0), 60, 1.0, 0.1);
  
  const model = await Model.import_obj('assets/models/car/', 'car.obj');
  console.log(model);

  const scene = new Scene(renderer.gl);
  scene.add(model);
  scene.update();

  const keyboard = new KeyboardState();

  addEventListener('resize', () => resize(renderer, camera));

  let last_frame = performance.now();

  const render = () => {
    const now = performance.now();
    const frame_time = now - last_frame;
    last_frame = now;

    let scene_moved = process_input(keyboard, camera, frame_time);

    renderer.render(scene_moved, camera, scene);
    
    requestAnimationFrame(render);
  }

  render();
}

function resize(renderer: RayTracingRenderer, camera: Camera) {
  renderer.resize(innerWidth, innerHeight);
  camera.width = innerWidth;
  camera.height = innerHeight;
}

function process_input(keyboard: KeyboardState, camera: Camera, frame_time: number) : boolean {
  keyboard.update();
  let scene_moved = false;
  if (keyboard.pressed('up')) {
    camera.polar_angle -= 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('down')) {
    camera.polar_angle += 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('left')) {
    camera.azimuthal_angle -= 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('right')) {
    camera.azimuthal_angle += 0.1 * frame_time;
    scene_moved = true;
  }
  return scene_moved;
}