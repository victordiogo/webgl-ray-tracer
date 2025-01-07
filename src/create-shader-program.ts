import { load_text_file } from "./load-text-file";

export async function create_shader_program(gl: WebGL2RenderingContext, vertex_source_path: string, fragment_source_path: string) {
  const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
  if (!vertex_shader) {
    throw new Error('Failed to create vertex shader');
  }
  const vertex_shader_source = await load_text_file(vertex_source_path);
  gl.shaderSource(vertex_shader, vertex_shader_source);
  gl.compileShader(vertex_shader);
  if (!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)) {
    throw new Error('Failed to compile vertex shader: ' + gl.getShaderInfoLog(vertex_shader));
  }

  const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragment_shader) {
    throw new Error('Failed to create fragment shader');
  }
  const fragment_shader_source = await load_text_file(fragment_source_path);
  gl.shaderSource(fragment_shader, fragment_shader_source);
  gl.compileShader(fragment_shader);
  if (!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)) {
    throw new Error('Failed to compile fragment shader: ' + gl.getShaderInfoLog(fragment_shader));
  }

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