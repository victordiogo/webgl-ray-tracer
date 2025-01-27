import { Camera } from "./camera";
import { Model } from "./model";
import { Scene } from "./scene";
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
  max_depth: number;
  texture_32f: boolean;

  constructor(width: number, height: number, max_depth: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 is not supported');
    }
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float is not supported');
    }
    this.texture_32f = !!gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.gl.viewport(0, 0, width, height);
    this.swap_framebuffer = new SwapFramebuffer(gl, width, height, this.texture_32f);
    this.screen_quad_vao = this.create_screen_quad(gl);
    this.background_color = new Vector3(0, 0, 0);
    this.sample_count = 0;
    this.max_depth = max_depth;
  }

  async compile_shaders() {
    this.screen_quad_program = await create_shader_program(this.gl, './src/shaders/screen-quad.vert', './src/shaders/screen-quad.frag');
    this.ray_tracing_program = await create_shader_program(this.gl, './src/shaders/ray-tracing.vert', './src/shaders/ray-tracing.frag');
  }

  reset_sampling() {
    this.sample_count = 0;
  }

  render(camera: Camera, scene: Scene) {
    ++this.sample_count;

    // rt rendering
    this.swap_framebuffer.use();
    this.gl.useProgram(this.ray_tracing_program);
      this.gl.uniform1i(this.gl.getUniformLocation(this.ray_tracing_program, 'u_prev_color'), 0);
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.swap_framebuffer.offscreen_texture);
      this.gl.uniform1i(this.gl.getUniformLocation(this.ray_tracing_program, 'u_sample_count'), this.sample_count);
      this.gl.uniform1i(this.gl.getUniformLocation(this.ray_tracing_program, 'u_max_depth'), this.sample_count == 1 ? 2 : this.max_depth);
      this.gl.uniform3fv(this.gl.getUniformLocation(this.ray_tracing_program, 'u_background_color'), this.background_color.toArray());
      camera.use(this.ray_tracing_program);
      scene.use(this.ray_tracing_program);
    this.gl.bindVertexArray(this.screen_quad_vao);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    // screen quad rendering
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.useProgram(this.screen_quad_program);
      this.gl.uniform1i(this.gl.getUniformLocation(this.screen_quad_program, 'u_render'), 0);
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.swap_framebuffer.screen_texture);
      this.gl.uniform1i(this.gl.getUniformLocation(this.screen_quad_program, 'u_sample_count'), this.sample_count);
    this.gl.bindVertexArray(this.screen_quad_vao);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.swap_framebuffer.swap();
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.swap_framebuffer.destroy();
    this.swap_framebuffer = new SwapFramebuffer(this.gl, width, height, this.texture_32f);
    this.sample_count = 0;
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