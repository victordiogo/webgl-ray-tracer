import { Camera } from "./camera";
import { create_shader_program } from "./shader-program";
import { SwapFramebuffer } from "./swap-framebuffer";

import { Vector3 } from "three";

export class RayTracingRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  swap_framebuffer: SwapFramebuffer;
  ray_tracing_program: WebGLProgram;
  screen_quad_program: WebGLProgram;
  screen_quad_vao: WebGLVertexArrayObject;
  background_color: Vector3;
  sample_count: number;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 is not supported');
    }
    // if (!gl.getExtension('EXT_color_buffer_float')) {
    //   throw new Error('EXT_color_buffer_float is not supported');
    // }
    this.gl = gl;
    this.gl.viewport(0, 0, width, height);
    this.swap_framebuffer = new SwapFramebuffer(gl, width, height);
    this.screen_quad_vao = this.create_screen_quad(gl);
    this.background_color = new Vector3(0.5, 0.7, 1.0);
    this.sample_count = 0;
  }

  async compile_shaders() {
    this.ray_tracing_program = await create_shader_program(this.gl, 'src/ray-tracing.vert', 'src/ray-tracing.frag');
    this.screen_quad_program = await create_shader_program(this.gl, 'src/screen-quad.vert', 'src/screen-quad.frag');
  }

  render(scene_moved: boolean, camera: Camera) {
    if (scene_moved) {
      this.sample_count = 0;
    }
    ++this.sample_count;

    this.swap_framebuffer.use();
    this.gl.useProgram(this.ray_tracing_program);
    this.gl.bindVertexArray(this.screen_quad_vao);
    // rt rendering
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.useProgram(this.screen_quad_program);
    this.gl.bindVertexArray(this.screen_quad_vao);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.swap_framebuffer.screen_texture);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.swap_framebuffer.swap();
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.swap_framebuffer.destroy();
    this.swap_framebuffer = new SwapFramebuffer(this.gl, width, height);
    this.sample_count = 0;
  }

  get_viewport(camera: Camera) : { width: number, height: number } {
    const height = 2 * camera.focus_distance * Math.tan(0.5 * camera.vfov * Math.PI / 180);
    const width = camera.aspect_ratio * height;
    return { width, height };
  }

  get_initial_ray_data(camera: Camera, width: number, height: number) : { position: Vector3, step_x: Vector3, step_y: Vector3 } {
    const [u, v, w] = camera.uvw;
    const viewport = this.get_viewport(camera);
    const step_x = u.clone().multiplyScalar(viewport.width / width);
    const step_y = v.clone().multiplyScalar(viewport.height / height);
    const position = camera.position.clone()
      .sub(u.clone().multiplyScalar(0.5 * viewport.width))
      .sub(v.clone().multiplyScalar(0.5 * viewport.height))
      .sub(w.clone().multiplyScalar(camera.focus_distance))
      .add(step_x.clone().multiplyScalar(0.5))
      .add(step_y.clone().multiplyScalar(0.5));

    return { position, step_x, step_y };
  }

  create_screen_quad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
    const quad_verts = [-1, -1, 1, -1, 1, 1, -1, -1, 1,  1, -1, 1];
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad_verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);
    return vao;
  }
};