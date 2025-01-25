#version 300 es

precision highp int;
precision highp float;
precision highp sampler2D;

uniform sampler2D u_render;
uniform int u_sample_count;

out vec4 o_color;

vec3 gamma_correct(vec3 color) {
  return pow(color, vec3(1.0 / 2.2));
}

void main() {
  vec3 color = texelFetch(u_render, ivec2(gl_FragCoord.xy), 0).rgb / float(u_sample_count);
  // tone mapping
  color = color / (color + vec3(1.0));
  o_color = vec4(gamma_correct(color), 1.0);
}