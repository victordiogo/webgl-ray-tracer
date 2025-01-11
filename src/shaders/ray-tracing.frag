#version 300 es

precision highp float;
precision highp int;

// renderer
uniform sampler2D u_prev_color;
uniform int u_sample_count;
uniform vec3 u_background_color;
uniform int u_max_depth;
// scene
uniform sampler2D u_positions;
uniform sampler2D u_normals;
uniform sampler2D u_uvs;
uniform sampler2D u_materials;
uniform sampler2D u_textures[16];
uniform int u_num_triangles;
uniform int u_max_texture_size;
// camera
uniform float u_defocus_radius;
uniform vec3 u_initial_position;
uniform vec3 u_step_x;
uniform vec3 u_step_y;
uniform vec3 u_look_from;

out vec4 o_color;

float g_max_float = 3.402823466e+38;
uint g_rng_state;

uint jenkins_hash(uint x) {
  x += x << 10u;
  x ^= x >> 6u;
  x += x << 3u;
  x ^= x >> 11u;
  x += x << 15u;
  return x;
}

void init_rng() {
  uint seed = (uint(gl_FragCoord.x) + uint(gl_FragCoord.y) * uint(textureSize(u_prev_color, 0).x)) ^ jenkins_hash(uint(u_sample_count));
  g_rng_state = jenkins_hash(seed);
}

uint xorshift() {
  g_rng_state ^= g_rng_state << 13u;
  g_rng_state ^= g_rng_state >> 17u;
  g_rng_state ^= g_rng_state << 5u;
  return g_rng_state;
}

float uint_to_float(uint x) {
  return intBitsToFloat(int(0x3f800000u | (x >> 9u))) - 1.0;
}

// returns a random float in the range [0, 1)
float rand() {
  return uint_to_float(xorshift());
}

vec3 random_unit_vector() {
  float z = 1.0 - 2.0 * rand();
  float a = 2.0 * 3.1415926535897932385 * rand();
  float r = sqrt(1.0 - z * z);
  return vec3(r * cos(a), r * sin(a), z);
}

struct Ray {
  vec3 origin;
  vec3 direction;
};

vec3 ray_at(Ray ray, float t) {
  return ray.origin + t * ray.direction;
}

struct HitRecord {
  float t;
  float p;
  float q;
  int triangle_index;
};

ivec2 get_vertex_coords(int triangle_index, int vertex_index) {
  int i = (triangle_index * 3 + vertex_index) % u_max_texture_size;
  int j = (triangle_index * 3 + vertex_index) / u_max_texture_size;
  return ivec2(i, j);
}

ivec2 get_material_coords(int triangle_index) {
  int i = triangle_index % u_max_texture_size;
  int j = triangle_index / u_max_texture_size;
  return ivec2(i, j);
}

bool hit_triangle(int triangle_index, Ray ray, float min_distance, float max_distance, out HitRecord hit_record) {
  // o + td = a + p * ab + q * ac

  ivec2 a_coords = get_vertex_coords(triangle_index, 0);
  ivec2 b_coords = get_vertex_coords(triangle_index, 1);
  ivec2 c_coords = get_vertex_coords(triangle_index, 2);
  
  vec3 a = texelFetch(u_positions, a_coords, 0).xyz;
  vec3 b = texelFetch(u_positions, b_coords, 0).xyz;
  vec3 c = texelFetch(u_positions, c_coords, 0).xyz;

  vec3 ab = b - a;
  vec3 ac = c - a;

  vec3 abxac = cross(ab, ac);
  float det = dot(abxac, -ray.direction);
  if (abs(det) < 1e-6) {
    return false;
  }

  vec3 ao = ray.origin - a;

  vec3 dxao = cross(ray.direction, ao);
  float p = dot(-dxao, ac) / det;
  if (p < 0.0 || p > 1.0) {
    return false;
  }

  float q = dot(dxao, ab) / det;
  if (q < 0.0 || p + q > 1.0) {
    return false;
  }

  float t = dot(abxac, ao) / det;
  if (t < min_distance || t > max_distance) {
    return false;
  }

  hit_record.t = t;
  hit_record.p = p;
  hit_record.q = q;
  hit_record.triangle_index = triangle_index;

  return true;
}

bool trace(Ray ray, out HitRecord hit_record) {
  hit_record.t = g_max_float;
  bool hit_anything = false;

  for (int i = 0; i < u_num_triangles; ++i) {
    HitRecord temp_record;
    if (hit_triangle(i, ray, 0.0, hit_record.t, temp_record)) {
      hit_anything = true;
      hit_record = temp_record;
    }
  }

  return hit_anything;
}

struct ScatterData {
  vec3 attenuation;
  Ray scattered;
};


struct Material {
  int texture_index;
};

struct SurfaceData {
  vec3 point;
  vec3 normal;
  vec2 uv;
  Material material;
};

bool near_zero(vec3 v) {
  const float s = 1e-7;
  return (abs(v.x) < s) && (abs(v.y) < s) && (abs(v.z) < s);
}

ScatterData scatter_lambertian(SurfaceData surface_data) {
  vec3 direction = surface_data.normal + random_unit_vector();
  while (near_zero(direction)) {
    direction = surface_data.normal + random_unit_vector();
  }
  Ray scattered = Ray(surface_data.point + surface_data.normal * 0.001, direction);
  vec3 attenuation;
  if (surface_data.material.texture_index == 0) {
    attenuation = texture(u_textures[0], surface_data.uv).xyz;
  }
  if (surface_data.material.texture_index == 1) {
    attenuation = texture(u_textures[1], surface_data.uv).xyz;
  }
  return ScatterData(attenuation, scattered);
}

SurfaceData get_surface_data(Ray ray, HitRecord hit_record) {
  SurfaceData data;

  ivec2 a_coords = get_vertex_coords(hit_record.triangle_index, 0);
  ivec2 b_coords = get_vertex_coords(hit_record.triangle_index, 1);
  ivec2 c_coords = get_vertex_coords(hit_record.triangle_index, 2);

  vec2 a_uv = texelFetch(u_uvs, a_coords, 0).xy;
  vec2 b_uv = texelFetch(u_uvs, b_coords, 0).xy;
  vec2 c_uv = texelFetch(u_uvs, c_coords, 0).xy;

  vec3 a_normal = texelFetch(u_normals, a_coords, 0).xyz;
  vec3 b_normal = texelFetch(u_normals, b_coords, 0).xyz;
  vec3 c_normal = texelFetch(u_normals, c_coords, 0).xyz;

  ivec2 material_coords = get_material_coords(hit_record.triangle_index);
  int texture_index = int(texelFetch(u_materials, material_coords, 0).x);

  float r = 1.0 - hit_record.p - hit_record.q;

  data.point = ray_at(ray, hit_record.t);
  data.normal = normalize(r * a_normal + hit_record.p * b_normal + hit_record.q * c_normal);
  data.uv = r * a_uv + hit_record.p * b_uv + hit_record.q * c_uv;
  data.material = Material(texture_index);

  return data;
}

vec3 cast_ray(Ray ray) {
  vec3 color = vec3(1.0, 1.0, 1.0);

  for (int depth = 0; depth <= u_max_depth; ++depth) {
    if (depth == u_max_depth) {
      color = vec3(0.0, 0.0, 0.0);
      break;
    }

    HitRecord hit_record;

    if (!trace(ray, hit_record)) {
      color *= u_background_color;
      break;
    }

    SurfaceData surface_data = get_surface_data(ray, hit_record);

    ScatterData scatter_data = scatter_lambertian(surface_data);
    color *= scatter_data.attenuation;
    ray = scatter_data.scattered;
  }

  return color;
}

void main() {
  init_rng();

  vec3 position = u_initial_position + gl_FragCoord.x * u_step_x + gl_FragCoord.y * u_step_y;
  Ray ray = Ray(u_look_from, position - u_look_from);
  vec3 color = cast_ray(ray);

  if (u_sample_count == 1) {
    o_color = vec4(0.0, 0.0, 0.0, 0.0);
  }
  else {
    o_color = texelFetch(u_prev_color, ivec2(gl_FragCoord.xy), 0);
  }

  o_color += vec4(color, 1.0);
}