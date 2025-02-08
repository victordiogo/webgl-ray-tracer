import { OrbitalCamera } from './orbital-camera';
import { Scene } from './scene';

import KeyboardState from '../lib/keyboard-state.js';

import { Vector3, FloatType, PlaneGeometry, MeshPhysicalMaterial, TextureLoader, Mesh } from 'three';
import { RayTracingRenderer } from './ray-tracing-renderer';
import { import_gltf, import_obj } from './model';
import { RGBELoader } from 'three/examples/jsm/Addons.js';

main().catch(e => {
  document.body.innerText = e.message;
  console.error(e);
});

async function load_hdr(path: string) {
  const loader = new RGBELoader().setDataType(FloatType);
  return await loader.loadAsync(path);
}

async function create_ground() {
  const geometry = new PlaneGeometry(3, 3);
  geometry.rotateX(-Math.PI / 2);
  const loader = new TextureLoader();
  const albedo = await loader.loadAsync('assets/textures/ground/ground-alb.jpg');
  const normal = await loader.loadAsync('assets/textures/ground/ground-nor.jpg');
  const arm = await loader.loadAsync('assets/textures/ground/ground-arm.jpg');

  albedo.repeat.set(3, 3)
  albedo.offset.set(0.3, 0.3);

  normal.repeat.set(3, 3)
  normal.offset.set(0.3, 0.3);

  arm.repeat.set(3, 3)
  arm.offset.set(0.3, 0.3);

  const material = new MeshPhysicalMaterial({
    map: albedo,
    normalMap: normal,
    roughnessMap: arm,
    metalnessMap: arm
  });

  return new Mesh(geometry, material);
}

async function main() {
  let resolution = 0.6;

  const renderer = new RayTracingRenderer(innerWidth * resolution, innerHeight * resolution, 3);
  document.body.appendChild(renderer.canvas);
  
  const camera = new OrbitalCamera(90, 0, 2, renderer.canvas.width, renderer.canvas.height, new Vector3(0, 0.5, 0), 50, 1.5, 0);
  
  const environment = await load_hdr('assets/environments/lost-city.hdr');
  let scene = new Scene(environment);
  
  let model = await import_obj('assets/models/cornell-box/cornell-box.obj');
  scene.add(model);
  
  const plane = await create_ground();
  scene.add(plane);
  scene.meshes_needs_update = true;

  const geometry = new PlaneGeometry(2, 2);
  const material = new MeshPhysicalMaterial({ emissive: 0xffffff });
  const light = new Mesh(geometry, material);
  light.position.set(1, 3, 1);
  light.rotateX(-Math.PI / 2);
  scene.add(light);
  
  const keyboard = new KeyboardState();
  
  renderer.canvas.addEventListener('mousemove', e => process_mouse_move(e, renderer, camera));
  renderer.canvas.addEventListener('mousewheel', e => process_mouse_wheel(e as WheelEvent, camera));
  renderer.canvas.addEventListener('contextmenu', e => e.preventDefault());
  
  addEventListener('resize', () => resize(renderer, camera, resolution));

  addEventListener('max-depth-input', (event) => {
    const customEvent = event as CustomEvent;
    renderer.max_depth = customEvent.detail.max_depth;
    renderer.sample_count = 0;
  });

  addEventListener('environment-change', (event) => {
    const customEvent = event as CustomEvent;
    load_hdr(customEvent.detail.path).then(env => {
      scene.environment = env;
      scene.environment_needs_update = true;
    });
  });

  addEventListener('environment-intensity-input', (event) => {
    const customEvent = event as CustomEvent;
    scene.environmentIntensity = customEvent.detail.intensity;
    scene.environment_intensity_needs_update = true;
  });

  addEventListener('resolution-input', (event) => {
    const customEvent = event as CustomEvent;
    resolution = customEvent.detail.resolution;
    resize(renderer, camera, resolution);
  });

  addEventListener('model-change', async (event) => {
    const customEvent = event as CustomEvent;
    const path = customEvent.detail.path;
    scene.remove(model);
    if (path.endsWith('.gltf') || path.endsWith('.glb')) {
      model = await import_gltf(path);
    }
    else if (path.endsWith('.obj')) {
      model = await import_obj(path);
    }
    scene.add(model);
    scene.meshes_needs_update = true;
  });
  
  let last_time = performance.now();
  let last_avg_time = last_time;
  let frame_count = 0;
  
  document.getElementById('fps')!.innerText = "FPS: 0";
  
  const render = () => {
    const current_time = performance.now();
    const frame_time = current_time - last_time;
    last_time = current_time;
    ++frame_count;
    
    process_keyboard_input(keyboard, camera, frame_time);
    
    renderer.render(scene, camera);
    
    const elapsed = current_time - last_avg_time;
    if (elapsed > 1000) {
      const avg_fps = frame_count / (elapsed / 1000);
      document.getElementById('fps')!.innerText = "FPS: " + avg_fps.toFixed(0);
      last_avg_time = current_time;
      frame_count = 0;  
    }
    document.getElementById('samples')!.innerText = "Samples: " + renderer.sample_count;
    document.getElementById('triangles')!.innerText = "Triangles: " + scene.num_triangles;
    document.getElementById('fov')!.innerText = "FOV: " + camera.fov.toFixed(2) + "°";
    document.getElementById('focus-distance')!.innerText = "Focus Distance: " + camera.focus_distance.toFixed(2);
    document.getElementById('defocus-angle')!.innerText = "Defocus Angle: " + camera.defocus_angle.toFixed(2) + "°";
    
    requestAnimationFrame(render);
  }
  
  render();
}

function resize(renderer: RayTracingRenderer, camera: OrbitalCamera, resolution: number) {
  renderer.set_size(innerWidth * resolution, innerHeight * resolution);
  camera.render_width = innerWidth * resolution;
  camera.render_height = innerHeight * resolution;
  camera.needs_update = true;
}

function process_keyboard_input(keyboard: KeyboardState, camera: OrbitalCamera, frame_time: number) {
  if (keyboard.pressed('W')) {
    camera.fov -= 0.1 * frame_time;
    if (camera.fov < 1) {
      camera.fov = 1;
    }
    camera.needs_update = true;
  }
  if (keyboard.pressed('S')) {
    camera.fov += 0.1 * frame_time;
    if (camera.fov > 179) {
      camera.fov = 179;
    }
    camera.needs_update = true;
  }
  if (keyboard.pressed('D')) {
    camera.focus_distance += 0.002 * frame_time;
    camera.needs_update = true;
  }
  if (keyboard.pressed('A')) {
    camera.focus_distance -= 0.002 * frame_time;
    if (camera.focus_distance < 0.1) {
      camera.focus_distance = 0.1;
    }
    camera.needs_update = true;
  }
  if (keyboard.pressed('Q')) {
    camera.defocus_angle -= 0.002 * frame_time;
    if (camera.defocus_angle < 0) {
      camera.defocus_angle = 0;
    }
    camera.needs_update = true;
  }
  if (keyboard.pressed('E')) {
    camera.defocus_angle += 0.002 * frame_time;
    if (camera.defocus_angle > 45) {
      camera.defocus_angle = 45;
    }
    camera.needs_update = true;
  }
  keyboard.update();
}

function process_mouse_move(event: MouseEvent, renderer: RayTracingRenderer, camera: OrbitalCamera) {
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
    camera.needs_update = true;
  }
  else if (event.buttons === 2) {
    renderer.canvas.style.cursor = 'grabbing';
    camera.look_at.add(camera.uvw[0].clone().multiplyScalar(-0.002 * event.movementX));
    camera.look_at.add(camera.uvw[1].clone().multiplyScalar(0.002 * event.movementY));
    camera.needs_update = true;
  }
  else {
    renderer.canvas.style.cursor = 'grab';
  }
}

function process_mouse_wheel(event: WheelEvent, camera: OrbitalCamera) {
  let offset = Math.exp(camera.radial_distance * 0.1 - 0.5) * 0.001 * event.deltaY;
  if (Math.abs(offset) > 2) {
    offset = 2 * Math.sign(offset);
  }
  camera.radial_distance += offset;
  if (camera.radial_distance < 0.1) {
    camera.radial_distance = 0.1;
  }
  if (camera.radial_distance > 100) {
    camera.radial_distance = 100;
  }
  camera.needs_update = true;
}