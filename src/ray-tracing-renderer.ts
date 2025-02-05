import { OrbitalCamera } from "./orbital-camera";
import { Scene } from "./scene";
import { create_shader_program } from "./shader-program";
import { SwapFramebuffer } from "./swap-framebuffer";

export class RayTracingRenderer {
  canvas: HTMLCanvasElement;
  swap_framebuffer: SwapFramebuffer;
  ray_tracing_program: WebGLProgram | null = null;
  screen_quad_program: WebGLProgram | null = null;
  screen_quad_vao: WebGLVertexArrayObject;
  sample_count: number = 0;
  max_depth: number;

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
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.swap_framebuffer = new SwapFramebuffer(gl, this.canvas.width, this.canvas.height);
    this.screen_quad_vao = create_screen_quad(gl);
    this.max_depth = max_depth;
    this.compile_shaders();
  }

  async compile_shaders() {
    const gl = this.canvas.getContext('webgl2')!;
    this.screen_quad_program = await create_shader_program(gl, './src/shaders/screen-quad.vert', './src/shaders/screen-quad.frag');
    this.ray_tracing_program = await create_shader_program(gl, './src/shaders/ray-tracing.vert', './src/shaders/ray-tracing.frag');
  }

  render(scene: Scene, camera: OrbitalCamera) {  
    if (!this.ray_tracing_program || !this.screen_quad_program) {
      return;
    }

    ++this.sample_count;

    const gl = this.canvas.getContext('webgl2')!;

    let updated = scene.update_environment(gl, this.ray_tracing_program);
    updated = updated || scene.update_environment_intensity(gl, this.ray_tracing_program);
    updated = updated || scene.update_meshes(gl, this.ray_tracing_program);
    updated = updated || camera.update(gl, this.ray_tracing_program);
    scene.update_meshes(gl, this.ray_tracing_program);
    
    if (updated) {
      this.sample_count = 1;
    }
    
    // ray tracing rendering
    this.swap_framebuffer.use(gl);
    gl.useProgram(this.ray_tracing_program);
    
    gl.uniform1i(gl.getUniformLocation(this.ray_tracing_program, 'u_prev_render'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.swap_framebuffer.offscreen_texture);

    gl.uniform1i(gl.getUniformLocation(this.ray_tracing_program, 'u_sample_count'), this.sample_count);
    gl.uniform1i(gl.getUniformLocation(this.ray_tracing_program, 'u_max_depth'), this.max_depth);

    gl.bindVertexArray(this.screen_quad_vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // screen quad rendering
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.screen_quad_program);

    gl.uniform1i(gl.getUniformLocation(this.screen_quad_program, 'u_render'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.swap_framebuffer.screen_texture);

    gl.uniform1i(gl.getUniformLocation(this.screen_quad_program, 'u_sample_count'), this.sample_count);

    gl.bindVertexArray(this.screen_quad_vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.swap_framebuffer.swap();
  }

  set_size(width: number, height: number) {
    const gl = this.canvas.getContext('webgl2')!;
    gl.viewport(0, 0, width, height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.swap_framebuffer.destroy(gl);
    this.swap_framebuffer = new SwapFramebuffer(gl, width, height);
  }
};

function create_screen_quad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const quad_verts = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad_verts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);
  return vao;
}