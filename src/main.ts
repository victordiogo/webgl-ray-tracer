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
  const camera = new Camera(renderer.gl, 60, 45, 30, renderer.canvas.width, renderer.canvas.height, new Vector3(0, 0, 0), 60, 18, 0);
  
  let model = await Model.import_obj('assets/models/chicken/', 'chicken.obj');
  console.log(model);

  let scene = new Scene(renderer.gl);
  scene.add(model);
  scene.update();

  const keyboard = new KeyboardState();
  
  renderer.canvas.addEventListener('mousemove', e => process_mouse_move(e, renderer, camera));
  renderer.canvas.addEventListener('mousewheel', e => process_mouse_wheel(e as WheelEvent, renderer, camera));

  addEventListener('resize', () => resize(renderer, camera));

  const scene_cache: Map<string, Scene> = new Map();
  scene_cache.set('chicken.obj', scene);
  addEventListener('model-change', async (event) => {
    const customEvent = event as CustomEvent;
    if (scene_cache.has(customEvent.detail.file_name)) {
      scene = scene_cache.get(customEvent.detail.file_name)!;
    }
    else {
      model = await Model.import_obj(customEvent.detail.obj_dir, customEvent.detail.file_name);
      scene = new Scene(renderer.gl);
      scene.add(model);
      scene.update();
      scene_cache.set(customEvent.detail.file_name, scene);
    }
    renderer.start_sampling();
  });

  let last_frame = performance.now();

  const render = () => {
    const now = performance.now();
    const frame_time = now - last_frame;
    last_frame = now;

    process_keyboard_input(keyboard, renderer, camera, frame_time);

    renderer.render(camera, scene);

    document.getElementById('fps')!.innerText = "FPS: " + (1000 / frame_time).toFixed(2);
    document.getElementById('samples')!.innerText = "Samples: " + renderer.sample_count;
    document.getElementById('fov')!.innerText = "FOV: " + camera.vfov.toFixed(2) + "°";
    document.getElementById('focus-distance')!.innerText = "Focus Distance: " + camera.focus_distance.toFixed(2);
    document.getElementById('defocus-angle')!.innerText = "Defocus Angle: " + camera.defocus_angle.toFixed(2) + "°";
    
    requestAnimationFrame(render);
  }

  render();
}

function resize(renderer: RayTracingRenderer, camera: Camera) {
  renderer.resize(innerWidth, innerHeight);
  camera.width = innerWidth;
  camera.height = innerHeight;
}

function process_keyboard_input(keyboard: KeyboardState, renderer: RayTracingRenderer, camera: Camera, frame_time: number) {
  if (keyboard.pressed('W')) {
    camera.vfov -= 0.1 * frame_time;
    if (camera.vfov < 1) {
      camera.vfov = 1;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('S')) {
    camera.vfov += 0.1 * frame_time;
    if (camera.vfov > 179) {
      camera.vfov = 179;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('D')) {
    camera.focus_distance += 0.02 * frame_time;
    renderer.start_sampling();
  }
  if (keyboard.pressed('A')) {
    camera.focus_distance -= 0.02 * frame_time;
    if (camera.focus_distance < 1) {
      camera.focus_distance = 1;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('Q')) {
    camera.defocus_angle -= 0.002 * frame_time;
    if (camera.defocus_angle < 0) {
      camera.defocus_angle = 0;
    }
    renderer.start_sampling();
  }
  if (keyboard.pressed('E')) {
    camera.defocus_angle += 0.002 * frame_time;
    if (camera.defocus_angle > 45) {
      camera.defocus_angle = 45;
    }
    renderer.start_sampling();
  }
  keyboard.update();
}

function process_mouse_move(event: MouseEvent, renderer: RayTracingRenderer, camera: Camera) {
  if (event.buttons === 1) {
    renderer.canvas.style.cursor = 'grabbing';
    camera.azimuthal_angle -= 0.3 * event.movementX;
    camera.polar_angle -= 0.3 * event.movementY;
    if (camera.polar_angle > 179.9) {
      camera.polar_angle = 179.9;
    }
    if (camera.polar_angle < 0.01) {
      camera.polar_angle = 0.01;
    }
    renderer.start_sampling();
  }
  else {
    renderer.canvas.style.cursor = 'grab';
  }
}

function process_mouse_wheel(event: WheelEvent, renderer: RayTracingRenderer, camera: Camera) {
  // very close to center (radial distance close to 0) changes very slower
  let offset = Math.exp(camera.radial_distance * 0.1 - 0.5) * 0.001 * event.deltaY;
  if (Math.abs(offset) > 10) {
    offset = 10 * Math.sign(offset);
  }
  camera.radial_distance += offset;
  if (camera.radial_distance < 0.1) {
    camera.radial_distance = 0.1;
  }
  if (camera.radial_distance > 500) {
    camera.radial_distance = 500;
  }
  renderer.start_sampling();
}