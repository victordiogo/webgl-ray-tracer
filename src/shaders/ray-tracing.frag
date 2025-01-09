#version 300 es

precision highp float;
precision highp int;

// renderer
uniform sampler2D u_prev_color;
uniform int u_sample_count;
uniform vec3 u_background_color;
// scene
uniform sampler2D u_positions;
uniform sampler2D u_normals;
uniform sampler2D u_uvs;
uniform sampler2D u_materials;
uniform sampler2D u_textures[16];
uniform int u_positions_width;
uniform int u_materials_width;
// camera
uniform float u_defocus_radius;
uniform vec3 u_initial_position;
uniform vec3 u_step_x;
uniform vec3 u_step_y;
uniform vec3 u_look_from;

out vec4 o_color;

struct Ray {
  vec3 origin;
  vec3 direction;
};

vec3 ray_at(Ray ray, float t) {
  return ray.origin + t * ray.direction;
}

float g_max_float = 3.402823466e+38;

// struct ScatterData {
//   vec3 attenuation;
//   Ray scattered;
// };

// float rand() {
//   return fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
// }

// vec3 random_unit_vector() {
//   float z = 2.0 * rand() - 1.0;
//   float a = 2.0 * 3.14159265358979323846 * rand();
//   float r = sqrt(1.0 - z * z);
//   return vec3(r * cos(a), r * sin(a), z);
// }

// ScatterData scatter_lambertian(vec3 normal) {
//   vec3 target = normal + random_unit_vector();
//   Ray scattered = new_ray(normal, target);
//   return ScatterData(vec3(0.5, 0.5, 0.5), scattered);
// }

struct HitRecord {
  float t;
  vec3 point;
  vec3 normal;
  vec2 uv;
  int material;
};

ivec2 get_position_coords(int triangle_index, int vertex_index) {
  int i = (triangle_index * 3 + vertex_index) % u_positions_width;
  int j = (triangle_index * 3 + vertex_index) / u_positions_width;
  return ivec2(i, j);
}

ivec2 get_material_coords(int triangle_index) {
  int i = triangle_index % u_materials_width;
  int j = triangle_index / u_materials_width;
  return ivec2(i, j);
}

bool hit_triangle(int triangle_index, Ray ray, float min_distance, float max_distance, out HitRecord hit_record) {
  ivec2 a_pos_coords = get_position_coords(triangle_index, 0);
  ivec2 b_pos_coords = get_position_coords(triangle_index, 1);
  ivec2 c_pos_coords = get_position_coords(triangle_index, 2);
  
  vec3 a = texelFetch(u_positions, a_pos_coords, 0).xyz;
  vec3 b = texelFetch(u_positions, b_pos_coords, 0).xyz;
  vec3 c = texelFetch(u_positions, c_pos_coords, 0).xyz;

  vec3 ab = b - a;
  vec3 ac = c - a;

  vec3 abxac = cross(ab, ac);
  float det = dot(abxac, -ray.direction);
  if (abs(det) < 1e-6) {
    return false;
  }

  vec3 ao = ray.origin - a;

  vec3 dxao = cross(ray.direction, ao);
  float u = dot(-dxao, ac) / det;
  if (u < 0.0 || u > 1.0) {
    return false;
  }

  float v = dot(dxao, ab) / det;
  if (v < 0.0 || u + v > 1.0) {
    return false;
  }

  float t = dot(abxac, ao) / det;
  if (t < min_distance || t > max_distance) {
    return false;
  }

  vec2 a_uv = texelFetch(u_uvs, a_pos_coords, 0).xy;
  vec2 b_uv = texelFetch(u_uvs, b_pos_coords, 0).xy;
  vec2 c_uv = texelFetch(u_uvs, c_pos_coords, 0).xy;

  vec3 a_normal = texelFetch(u_normals, a_pos_coords, 0).xyz;
  vec3 b_normal = texelFetch(u_normals, b_pos_coords, 0).xyz;
  vec3 c_normal = texelFetch(u_normals, c_pos_coords, 0).xyz;

  ivec2 material_coords = get_material_coords(triangle_index);
  int material = int(texelFetch(u_materials, material_coords, 0).x);

  float w = 1.0 - u - v;

  hit_record.t = t;
  hit_record.point = ray_at(ray, t);
  hit_record.normal = normalize(w * a_normal + u * b_normal + v * c_normal);
  hit_record.uv = w * a_uv + u * b_uv + v * c_uv;
  hit_record.uv.y = 1.0 - hit_record.uv.y;
  hit_record.material = material;

  return true;
}

bool trace(Ray ray, out HitRecord hit_record) {
  hit_record.t = g_max_float;
  bool hit_anything = false;

  for (int i = 0; i < u_materials_width; ++i) {
    HitRecord temp_record;
    if (hit_triangle(i, ray, 0.0, hit_record.t, temp_record)) {
      hit_anything = true;
      hit_record = temp_record;
    }
  }

  return hit_anything;
}

vec3 ray_cast(Ray ray) {
  vec3 color = vec3(1.0, 1.0, 1.0);

  for (int depth = 0; depth < 1; ++depth) {
    HitRecord hit_record;

    if (!trace(ray, hit_record)) {
      color = u_background_color;
      break;
    }

    if (hit_record.material == 0) {
      color *= texture(u_textures[0], hit_record.uv).xyz;
    }
    if (hit_record.material == 1) {
      color *= texture(u_textures[1], hit_record.uv).xyz;
    }

    //   ScatterData scatter_data = scatter_lambertian(closest_hit.normal);
    //   color *= scatter_data.attenuation;

    //   ray = scatter_data.scattered;
  }

  return color;
}

void main() {
  vec3 position = u_initial_position + gl_FragCoord.x * u_step_x + gl_FragCoord.y * u_step_y;
  Ray ray = Ray(u_look_from, position - u_look_from);
  vec3 color = ray_cast(ray);

  if (u_sample_count == 1) {
    o_color = vec4(0.0, 0.0, 0.0, 1.0);
  }
  else {
    o_color = texelFetch(u_prev_color, ivec2(gl_FragCoord.xy), 0);
  }

  o_color += vec4(color, 1.0);
}