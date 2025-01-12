import { Camera } from './camera.js';
import KeyboardState from '../lib/keyboard-state.js';

import { Vector3 } from 'three';
import { RayTracingRenderer } from './ray-tracing-renderer.js';
import { Model } from './model.js';
import { Scene } from './scene.js';

main();

async function main() {
  const renderer = new RayTracingRenderer(innerWidth, innerHeight, 4);
  await renderer.compile_shaders();
  document.body.appendChild(renderer.canvas);
  const camera = new Camera(renderer.gl, 60, 45, 3, renderer.canvas.width, renderer.canvas.height, new Vector3(0, 0, 0), 60, 0.8, 0);
  
  let model = await Model.import_obj('assets/models/chicken/', 'chicken.obj');
  console.log(model);

  let scene = new Scene(renderer.gl);
  scene.add(model);
  scene.update();

  const keyboard = new KeyboardState();

  addEventListener('resize', () => resize(renderer, camera));

  document.querySelectorAll('input[type="radio"]')!.forEach(el => el.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    model = await Model.import_obj('assets/models/' + target.value + '/', target.value + '.obj');
    scene = new Scene(renderer.gl);
    scene.add(model);
    scene.update();
    console.log("triangle count: " + model.indices.length / 3);
    renderer.sample_count = 0;
  }));

  let last_frame = performance.now();

  const render = () => {
    const now = performance.now();
    const frame_time = now - last_frame;
    last_frame = now;

    let scene_moved = process_input(keyboard, camera, frame_time);

    renderer.render(scene_moved, camera, scene);

    document.getElementById('fps')!.innerText = "FPS: " + (1000 / frame_time).toFixed(2);
    document.getElementById('samples')!.innerText = "Samples: " + renderer.sample_count;
    document.getElementById('focus-distance')!.innerText = "Focus Distance: " + camera.focus_distance.toFixed(2);
    document.getElementById('defocus-angle')!.innerText = "Defocus Angle: " + camera.defocus_angle.toFixed(2);
    
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
  if (keyboard.pressed('W')) {
    camera.polar_angle -= 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('S')) {
    camera.polar_angle += 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('A')) {
    camera.azimuthal_angle -= 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('D')) {
    camera.azimuthal_angle += 0.1 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('Q')) {
    camera.radial_distance -= 0.001 * frame_time;
    if (camera.radial_distance < 0.1) {
      camera.radial_distance = 0.1;
    }
    scene_moved = true;
  }
  if (keyboard.pressed('E')) {
    camera.radial_distance += 0.001 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('up')) {
    camera.focus_distance += 0.002 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('down')) {
    camera.focus_distance -= 0.002 * frame_time;
    if (camera.focus_distance < 0.1) {
      camera.focus_distance = 0.1;
    }
    scene_moved = true;
  }
  if (keyboard.pressed('left')) {
    camera.defocus_angle -= 0.0005 * frame_time;
    if (camera.defocus_angle < 0) {
      camera.defocus_angle = 0;
    }
    scene_moved = true;
  }
  if (keyboard.pressed('right')) {
    camera.defocus_angle += 0.0005 * frame_time;
    scene_moved = true;
  }
  return scene_moved;
}