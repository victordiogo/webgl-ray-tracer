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
  const camera = new Camera(renderer.gl, 60, 45, 30, renderer.canvas.width, renderer.canvas.height, new Vector3(0, 0, 0), 60, 10, 0);
  
  let model = await Model.import_obj('assets/models/chicken/', 'chicken.obj');
  console.log(model);

  let scene = new Scene(renderer.gl);
  scene.add(model);
  scene.update();

  const keyboard = new KeyboardState();

  addEventListener('resize', () => resize(renderer, camera));

  addEventListener('model-change', async (event) => {
    const customEvent = event as CustomEvent;
    model = await Model.import_obj(customEvent.detail.obj_dir, customEvent.detail.file_name);
    scene = new Scene(renderer.gl);
    scene.add(model);
    scene.update();
    renderer.start_sampling();
  });

  let last_frame = performance.now();

  const render = () => {
    const now = performance.now();
    const frame_time = now - last_frame;
    last_frame = now;

    process_input(keyboard, renderer, camera, frame_time);

    renderer.render(camera, scene);

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

function process_input(keyboard: KeyboardState, renderer: RayTracingRenderer, camera: Camera, frame_time: number) {
  keyboard.update();
  if (keyboard.pressed('W')) {
    camera.polar_angle -= 0.1 * frame_time;
    if (camera.polar_angle < 0.01) {
      camera.polar_angle = 0.01;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('S')) {
    camera.polar_angle += 0.1 * frame_time;
    if (camera.polar_angle > 179.9) {
      camera.polar_angle = 179.9;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('A')) {
    camera.azimuthal_angle -= 0.1 * frame_time;
    renderer.start_sampling();
  }
  if (keyboard.pressed('D')) {
    camera.azimuthal_angle += 0.1 * frame_time;
    renderer.start_sampling();
  }
  if (keyboard.pressed('Q')) {
    camera.radial_distance += 0.01 * frame_time;
    if (camera.radial_distance < 0.1) {
      camera.radial_distance = 0.1;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('E')) {
    camera.radial_distance -= 0.01 * frame_time;
    renderer.start_sampling();
  }
  if (keyboard.pressed('up')) {
    camera.focus_distance += 0.02 * frame_time;
    renderer.start_sampling();
  }
  if (keyboard.pressed('down')) {
    camera.focus_distance -= 0.02 * frame_time;
    if (camera.focus_distance < 1) {
      camera.focus_distance = 1;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('left')) {
    camera.defocus_angle -= 0.0008 * frame_time;
    if (camera.defocus_angle < 0) {
      camera.defocus_angle = 0;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('right')) {
    camera.defocus_angle += 0.0008 * frame_time;
    if (camera.defocus_angle > 45) {
      camera.defocus_angle = 45;
    }
    renderer.start_sampling();
  }
}