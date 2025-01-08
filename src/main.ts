import { Camera } from './camera.js';
import KeyboardState from '../lib/keyboard-state.js';

import { Vector3 } from 'three';
import { RayTracingRenderer } from './ray-tracing-renderer.js';

main();

async function main() {
  const renderer = new RayTracingRenderer(innerWidth, innerHeight);
  await renderer.compile_shaders();
  const aspect_ratio = renderer.canvas.width / renderer.canvas.height;
  const camera = new Camera(45, 45, 3, aspect_ratio, new Vector3(0, 0, 0), 60, 1.0, 0.1);
  
  // const model = await load_gltf('./assets/models/shiba.glb', 1);
  // const model_textures = model_to_textures(gl, model);

  const keyboard = new KeyboardState();

  addEventListener('resize', () => resize(renderer, camera));

  let last_frame = performance.now();

  const render = () => {
    const now = performance.now();
    const frame_time = now - last_frame;
    last_frame = now;

    let scene_moved = process_input(keyboard, camera, frame_time);

    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_color_texture'), 0);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_positions_texture'), 1);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_normals_texture'), 2);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_uvs_texture'), 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, color_texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, model_textures.positions);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, model_textures.normals);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, model_textures.uvs);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_texture_width'), model_textures.width);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_num_triangles'), model.length);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_sample_count'), sample_count);
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_background_color'), background_color.toArray());
    gl.uniform1f(gl.getUniformLocation(ray_tracing_shader_program, 'u_defocus_radius'), camera.defocus_radius);
    const ray_data = camera.ray_data(canvas.width, canvas.height);
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_initial_position'), ray_data.initial_position.toArray());
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_step_x'), ray_data.step_x.toArray());
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_step_y'), ray_data.step_y.toArray());
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_look_from'), camera.position.toArray());
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    requestAnimationFrame(render);
  }

  render();
}

function resize(renderer: RayTracingRenderer, camera: Camera) {
  renderer.resize(innerWidth, innerHeight);
  camera.aspect_ratio = innerWidth / innerHeight;
}

function process_input(keyboard: KeyboardState, camera: Camera, frame_time: number) : boolean {
  keyboard.update();
  let scene_moved = false;
  if (keyboard.pressed('up')) {
    camera.polar_angle -= 0.5 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('down')) {
    camera.polar_angle += 0.5 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('left')) {
    camera.azimuthal_angle -= 0.5 * frame_time;
    scene_moved = true;
  }
  if (keyboard.pressed('right')) {
    camera.azimuthal_angle += 0.5 * frame_time;
    scene_moved = true;
  }
  return scene_moved;
}