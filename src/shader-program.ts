import { load_text_file } from "./load-text-file";

export async function create_shader_program(gl: WebGL2RenderingContext, vertex_source_path: string, fragment_source_path: string) {
  const vertex_shader = await create_shader(gl, gl.VERTEX_SHADER, vertex_source_path);
  const fragment_shader = await create_shader(gl, gl.FRAGMENT_SHADER, fragment_source_path);

  const shader_program = gl.createProgram();
  if (!shader_program) {
    throw new Error('Failed to create shader program');
  }
  gl.attachShader(shader_program, vertex_shader);
  gl.attachShader(shader_program, fragment_shader);
  gl.linkProgram(shader_program);
  if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
    throw new Error('Failed to link shader program: ' + gl.getProgramInfoLog(shader_program));
  }

  gl.deleteShader(vertex_shader);
  gl.deleteShader(fragment_shader);

  return shader_program;
}

async function create_shader(gl: WebGL2RenderingContext, type: number, source_path: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }
  const source = await load_text_file(source_path);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Failed to compile shader: ' + gl.getShaderInfoLog(shader));
  }
  return shader;
}