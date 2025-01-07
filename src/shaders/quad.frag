#version 300 es

precision highp float;

uniform sampler2D u_texture;
uniform int u_sample_count;

out vec4 o_color;

void main() {
  vec3 color = texelFetch(u_texture, ivec2(gl_FragCoord.xy), 0).rgb;
  o_color = vec4(color / float(u_sample_count), 1.0);
}