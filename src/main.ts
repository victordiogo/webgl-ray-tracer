import { Camera } from './camera.js';
import { create_shader_program } from './create-shader-program.js';
import { load_gltf } from './load-gltf.js';
import KeyboardState from '../lib/keyboard-state.js';

import { Vector3 } from 'three';

main();

async function main() {
  const canvas = create_canvas(document.body, window.innerWidth, window.innerHeight);
  
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    document.body.textContent = 'WebGL2 not supported in this browser';
    return;
  }

  const ext = gl.getExtension('EXT_color_buffer_float');
  if (!ext) {
    document.body.textContent = 'EXT_color_buffer_float not supported in this browser';
    return;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  
  let swap_buffers = create_swap_buffers(gl, canvas.width, canvas.height);

  const quad_shader_program = await create_shader_program(gl, './src/shaders/quad.vert', './src/shaders/quad.frag');
  const ray_tracing_shader_program = await create_shader_program(gl, './src/shaders/ray-tracing.vert', './src/shaders/ray-tracing.frag');
  
  const quad_vao = create_screen_quad(gl);

  const model = await load_gltf('./assets/models/skull.glb', 1);

  const camera = new Camera(45, 45, 3, canvas.width / canvas.height, new Vector3(0, 0, 0), 60, 1.0, 0.1);
  const background_color = new Vector3(0.5, 0.7, 1.0);

  const keyboard = new KeyboardState();
  
  let sample_count = 0;

  addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    swap_buffers = create_swap_buffers(gl, canvas.width, canvas.height);
    camera.aspect_ratio = canvas.width / canvas.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    sample_count = 0;
  });

  const render = () => {
    ++sample_count;

    keyboard.update();

    if (keyboard.pressed('up')) {
      camera.polar_angle -= 0.5;
      sample_count = 1;
    }
    if (keyboard.pressed('down')) {
      camera.polar_angle += 0.5;
      sample_count = 1;
    }
    if (keyboard.pressed('left')) {
      camera.azimuthal_angle -= 0.5;
      sample_count = 1;
    }
    if (keyboard.pressed('right')) {
      camera.azimuthal_angle += 0.5;
      sample_count = 1;
    }

    const framebuffer = swap_buffers[sample_count % 2].framebuffer;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    
    gl.useProgram(ray_tracing_shader_program);
    gl.bindVertexArray(quad_vao);
    const color_texture = swap_buffers[(sample_count + 1) % 2].texture;
    gl.bindTexture(gl.TEXTURE_2D, color_texture);
    gl.uniform1i(gl.getUniformLocation(ray_tracing_shader_program, 'u_sample_count'), sample_count);
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_background_color'), background_color.toArray());
    gl.uniform1f(gl.getUniformLocation(ray_tracing_shader_program, 'u_defocus_radius'), camera.defocus_radius);
    const ray_data = camera.ray_data(canvas.width, canvas.height);
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_initial_position'), ray_data.initial_position.toArray());
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_step_x'), ray_data.step_x.toArray());
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_step_y'), ray_data.step_y.toArray());
    gl.uniform3fv(gl.getUniformLocation(ray_tracing_shader_program, 'u_look_from'), camera.position.toArray());
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    gl.useProgram(quad_shader_program);
    gl.bindVertexArray(quad_vao);
    const render_texture = swap_buffers[sample_count % 2].texture;
    gl.bindTexture(gl.TEXTURE_2D, render_texture);
    gl.uniform1i(gl.getUniformLocation(quad_shader_program, 'u_sample_count'), sample_count);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    requestAnimationFrame(render);
  }

  render();
}

function create_canvas(element: HTMLElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  element.appendChild(canvas);
  return canvas;
}

function create_swap_buffers(gl: WebGL2RenderingContext, width: number, height: number): { texture: WebGLTexture, framebuffer: WebGLFramebuffer }[] {
  const texture_a = create_float_texture(gl, width, height);
  const framebuffer_a = create_framebuffer(gl, texture_a);

  const texture_b = create_float_texture(gl, width, height);
  const framebuffer_b = create_framebuffer(gl, texture_b);

  return [
    { texture: texture_a, framebuffer: framebuffer_a },
    { texture: texture_b, framebuffer: framebuffer_b },
  ];
}

function create_float_texture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function create_framebuffer(gl: WebGL2RenderingContext, color_texture: WebGLTexture) : WebGLFramebuffer {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color_texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Framebuffer is incomplete');
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return framebuffer;
}

function create_screen_quad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const quad_verts = [
    -1, -1,
    1, -1,
    1, 1,

    -1, -1,
    1, 1,
    -1, 1,
  ];

  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad_verts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);

  return vao;
}