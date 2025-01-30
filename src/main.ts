import { Camera } from './camera.js';
import KeyboardState from '../lib/keyboard-state.js';

import { Vector3, Scene as TreeScene, WebGLRenderer, PerspectiveCamera, DirectionalLight, AmbientLight } from 'three';
import { RayTracingRenderer } from './ray-tracing-renderer.js';
import { import_gltf, import_obj } from './model.js';
import { Scene } from './scene.js';

main().catch(e => {
  document.body.innerText = e.message;
  console.error(e);
})

async function main() {
  const renderer = new RayTracingRenderer(innerWidth, innerHeight, 4);
  await renderer.compile_shaders();
  document.body.appendChild(renderer.canvas);
  const camera = new Camera(renderer.gl, 90, 0, 2, renderer.canvas.width, renderer.canvas.height, new Vector3(0, 0, 0), 50, 1.5, 0);

  const tree_renderer = new WebGLRenderer({ antialias: true });
  tree_renderer.setSize(innerWidth, innerHeight);
  // document.body.appendChild(tree_renderer.domElement);

  const tree_scene = new TreeScene();
  const dir_light = new DirectionalLight(0xffffff, 1);
  dir_light.position.set(1, 1, 1);
  tree_scene.add(dir_light);
  tree_scene.add(new AmbientLight(0xffffff, 0.5));
  
  let model = await import_gltf('assets/models/cyber-samurai.glb');
  console.log(model);

  // tree_scene.add(model);
  model.forEach(mesh => {
    tree_scene.add(mesh);
  });

  const tree_camera = new PerspectiveCamera(90, innerWidth / innerHeight, 0.1, 1000);
  tree_camera.position.set(0, 0, 4);

  tree_renderer.domElement.addEventListener('mousemove', e => {
    if (e.buttons !== 1) {
      tree_renderer.domElement.style.cursor = 'grab';
      return;
    }
    tree_renderer.domElement.style.cursor = 'grabbing';
    tree_camera.rotation.y += 0.01 * e.movementX;
    tree_camera.rotation.x += 0.01 * e.movementY;
  });
  
  let scene = new Scene(renderer.gl);
  scene.add(...model);
  scene.update();
  
  const keyboard = new KeyboardState();
  
  renderer.canvas.addEventListener('mousemove', e => process_mouse_move(e, renderer, camera));
  renderer.canvas.addEventListener('mousewheel', e => process_mouse_wheel(e as WheelEvent, renderer, camera));
  
  addEventListener('resize', () => resize(renderer, camera));

  addEventListener('depth-input', (event) => {
    const customEvent = event as CustomEvent;
    renderer.max_depth = customEvent.detail.depth;
    renderer.reset_sampling();
  });

  addEventListener('background-color-input', (event) => {
    const customEvent = event as CustomEvent;
    const color = parseInt(customEvent.detail.color.substring(1), 16);
    renderer.background_color = new Vector3(
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255
    );
    renderer.reset_sampling();
  });

  const scene_cache: Map<string, Scene> = new Map();
  scene_cache.set('cornell-box.obj', scene);
  addEventListener('model-change', async (event) => {
    const customEvent = event as CustomEvent;
    const path = customEvent.detail.path;
    if (scene_cache.has(path)) {
      scene = scene_cache.get(path)!;
    }
    else {
      if (path.endsWith('.gltf') || path.endsWith('.glb')) {
        model = await import_gltf(path);
      }
      else if (path.endsWith('.obj')) {
        model = await import_obj(path);
      }
      console.log(model)
      scene = new Scene(renderer.gl);
      scene.add(...model);
      scene.update();
      scene_cache.set(path, scene);
    }
    renderer.reset_sampling();
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
    
    keyboard.pressed('W') && tree_camera.translateZ(-0.1);
    process_keyboard_input(keyboard, renderer, camera, frame_time);
    
    renderer.render(camera, scene);
    tree_renderer.render(tree_scene, tree_camera);
    
    const diff_time = current_time - last_avg_time;
    if (diff_time > 1000) {
      const avg_fps = frame_count / (diff_time / 1000);
      document.getElementById('fps')!.innerText = "FPS: " + avg_fps.toFixed(0);
      last_avg_time = current_time;
      frame_count = 0;  
    }
    document.getElementById('samples')!.innerText = "Samples: " + renderer.sample_count;
    document.getElementById('triangles')!.innerText = "Triangles: " + scene.meshes.reduce((acc, model) => {
      const index = model.geometry.getIndex();
      const position = model.geometry.getAttribute('position');
      return acc + (index ? index.count / 3 : position.count / 3);
    }, 0);
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
    renderer.reset_sampling();
  }
  if (keyboard.pressed('S')) {
    camera.vfov += 0.1 * frame_time;
    if (camera.vfov > 179) {
      camera.vfov = 179;
    }
    renderer.reset_sampling();
  }
  if (keyboard.pressed('D')) {
    camera.focus_distance += 0.002 * frame_time;
    renderer.reset_sampling();
  }
  if (keyboard.pressed('A')) {
    camera.focus_distance -= 0.002 * frame_time;
    if (camera.focus_distance < 0.1) {
      camera.focus_distance = 0.1;
    }
    renderer.reset_sampling();
  }
  if (keyboard.pressed('Q')) {
    camera.defocus_angle -= 0.002 * frame_time;
    if (camera.defocus_angle < 0) {
      camera.defocus_angle = 0;
    }
    renderer.reset_sampling();
  }
  if (keyboard.pressed('E')) {
    camera.defocus_angle += 0.002 * frame_time;
    if (camera.defocus_angle > 45) {
      camera.defocus_angle = 45;
    }
    renderer.reset_sampling();
  }
  if (keyboard.pressed('up')) {
    let offset = Math.exp(camera.radial_distance * 0.1 - 0.5) * 0.005;
    if (offset > 2) {
      offset = 2;
    }
    camera.radial_distance -= offset * frame_time;
    if (camera.radial_distance < 0.1) {
      camera.radial_distance = 0.1;
    }
    renderer.reset_sampling();
  }
  if (keyboard.pressed('down')) {
    let offset = Math.exp(camera.radial_distance * 0.1 - 0.5) * 0.005;
    if (offset > 2) {
      offset = 2;
    }
    camera.radial_distance += offset * frame_time;
    renderer.reset_sampling();
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
    renderer.reset_sampling();
  }
  else {
    renderer.canvas.style.cursor = 'grab';
  }
}

function process_mouse_wheel(event: WheelEvent, renderer: RayTracingRenderer, camera: Camera) {
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
  renderer.reset_sampling();
}