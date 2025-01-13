#version 300 es

precision highp int;
precision highp float;
precision highp sampler2D;

// renderer
uniform sampler2D u_prev_color;
uniform vec3 u_background_color;
uniform int u_sample_count;
uniform int u_max_depth;
// scene
uniform sampler2D u_positions;
uniform sampler2D u_normals;
uniform sampler2D u_uvs;
uniform sampler2D u_materials;
uniform sampler2D u_indices;
uniform sampler2D u_bvh;
uniform sampler2D u_textures[25];
uniform int u_bvh_length;
uniform int u_max_texture_size;
// camera
uniform float u_defocus_radius;
uniform vec3 u_initial_position;
uniform vec3 u_step_x;
uniform vec3 u_step_y;
uniform vec3 u_right;
uniform vec3 u_up;
uniform vec3 u_look_from;

out vec4 o_color;

float g_max_float = 3.402823466e+38;
float g_pi = 3.1415926535897932385;

// --> RANDOM NUMBER GENERATOR
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
  float a = 2.0 * g_pi * rand();
  float r = sqrt(1.0 - z * z);
  return vec3(r * cos(a), r * sin(a), z);
}
// <-- RANDOM NUMBER GENERATOR

// --> RAY 
struct Ray {
  vec3 origin;
  vec3 direction;
};

vec3 ray_at(Ray ray, float t) {
  return ray.origin + t * ray.direction;
}
// <-- RAY

struct HitRecord {
  float t;
  float p;
  float q;
  int material_index;
  ivec3 uv_index;
  ivec3 normal_index;
};

ivec2 to_texture_coords(int index) {
  int i = index % u_max_texture_size;
  int j = index / u_max_texture_size;
  return ivec2(i, j);
}

ivec4 get_vertex_indices(int triangle_index, int vertex_index) {
  ivec2 coords = to_texture_coords(triangle_index * 3 + vertex_index);
  return ivec4(texelFetch(u_indices, coords, 0).xyzw);
}

vec3 get_position(int index) {
  ivec2 coords = to_texture_coords(index);
  return texelFetch(u_positions, coords, 0).xyz;
}

vec2 get_uv(int index) {
  ivec2 coords = to_texture_coords(index);
  return texelFetch(u_uvs, coords, 0).xy;
}

vec3 get_normal(int index) {
  ivec2 coords = to_texture_coords(index);
  return texelFetch(u_normals, coords, 0).xyz;
}

bool hit_triangle(int triangle_index, Ray ray, float min_distance, float max_distance, out HitRecord hit_record) {
  // o + td = a + p * ab + q * ac

  ivec4 a_indices = get_vertex_indices(triangle_index, 0);
  ivec4 b_indices = get_vertex_indices(triangle_index, 1);
  ivec4 c_indices = get_vertex_indices(triangle_index, 2);
  
  vec3 a = get_position(a_indices.x);
  vec3 b = get_position(b_indices.x);
  vec3 c = get_position(c_indices.x);

  vec3 ab = b - a;
  vec3 ac = c - a;

  vec3 abxac = cross(ab, ac);
  float det = dot(abxac, -ray.direction);
  if (abs(det) < 1e-10) {
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
  hit_record.material_index = a_indices.w;
  hit_record.uv_index = ivec3(a_indices.y, b_indices.y, c_indices.y);
  hit_record.normal_index = ivec3(a_indices.z, b_indices.z, c_indices.z);

  return true;
}

struct BvhNode {
  int left_index;
  int right_index;
  vec2 bounding_box_axes[3];
};

BvhNode get_bvh_node(int index) {
  ivec2 coords = to_texture_coords(index * 2 + 0);
  vec4 data_a = texelFetch(u_bvh, coords, 0).xyzw;
  coords = to_texture_coords(index * 2 + 1);
  vec4 data_b = texelFetch(u_bvh, coords, 0).xyzw;
  return BvhNode(int(data_a.x), int(data_a.y), vec2[](data_a.zw, data_b.xy, data_b.zw));
}

bool hit_bounding_box(BvhNode node, Ray ray, float min_distance, float max_distance) {
  for (int i = 0; i < 3; ++i) {
    vec2 axis = node.bounding_box_axes[i];
    float inv_d = 1.0 / ray.direction[i];
    float t0 = (axis.x - ray.origin[i]) * inv_d;
    float t1 = (axis.y - ray.origin[i]) * inv_d;
    if (inv_d < 0.0) {
      float temp = t0;
      t0 = t1;
      t1 = temp;
    }
    min_distance = max(t0, min_distance);
    max_distance = min(t1, max_distance);
    if (max_distance <= min_distance) {
      return false;
    }
  }
  return true;
}

bool trace(Ray ray, out HitRecord hit_record) {
  int stack[32];
  int stack_size = 0;
  stack[stack_size++] = u_bvh_length - 1;

  hit_record.t = g_max_float;

  while (stack_size > 0) {
    int node_index = stack[--stack_size];
    BvhNode node = get_bvh_node(node_index);

    if (!hit_bounding_box(node, ray, 0.0, hit_record.t)) {
      continue;
    }

    if (node.left_index < 0) {
      HitRecord temp_record;
      int triangle_index = -node.left_index - 1;
      if (hit_triangle(triangle_index, ray, 0.0, hit_record.t, temp_record)) {
        hit_record = temp_record;
      }
    }
    else {
      stack[stack_size++] = node.right_index;
      stack[stack_size++] = node.left_index;
    }
  }

  return hit_record.t < g_max_float;
}

struct ScatterData {
  vec3 attenuation;
  Ray scattered;
};

struct Material {
  int texture_index;
  vec3 albedo;
};

Material get_material(int material_index) {
  ivec2 coords = to_texture_coords(material_index);
  vec4 mat = texelFetch(u_materials, coords, 0).xyzw;
  return Material(int(mat.x), mat.yzw);
}

struct SurfaceData {
  vec3 point;
  vec3 normal;
  vec2 uv;
  Material material;
};

bool near_zero(vec3 v, float epsilon) {
  return (abs(v.x) < epsilon) && (abs(v.y) < epsilon) && (abs(v.z) < epsilon);
}

ScatterData scatter_lambertian(SurfaceData surface_data) {
  vec3 direction = surface_data.normal + random_unit_vector();
  while (near_zero(direction, 1e-6)) {
    direction = surface_data.normal + random_unit_vector();
  }
  Ray scattered = Ray(surface_data.point + surface_data.normal * 1e-5, direction);
  vec3 attenuation;
  switch (surface_data.material.texture_index) {
    case -1:
      attenuation = surface_data.material.albedo;
      break;
    case 0:
      attenuation = texture(u_textures[0], surface_data.uv).xyz;
      break;
    case 1:
      attenuation = texture(u_textures[1], surface_data.uv).xyz;
      break;
    case 2:
      attenuation = texture(u_textures[2], surface_data.uv).xyz;
      break;
    case 3:
      attenuation = texture(u_textures[3], surface_data.uv).xyz;
      break;
    case 4:
      attenuation = texture(u_textures[4], surface_data.uv).xyz;
      break;
    case 5:
      attenuation = texture(u_textures[5], surface_data.uv).xyz;
      break;
    case 6:
      attenuation = texture(u_textures[6], surface_data.uv).xyz;
      break;
    case 7:
      attenuation = texture(u_textures[7], surface_data.uv).xyz;
      break;
    case 8:
      attenuation = texture(u_textures[8], surface_data.uv).xyz;
      break;
    case 9:
      attenuation = texture(u_textures[9], surface_data.uv).xyz;
      break;
    case 10:
      attenuation = texture(u_textures[10], surface_data.uv).xyz;
      break;
    case 11:
      attenuation = texture(u_textures[11], surface_data.uv).xyz;
      break;
    case 12:
      attenuation = texture(u_textures[12], surface_data.uv).xyz;
      break;
    case 13:
      attenuation = texture(u_textures[13], surface_data.uv).xyz;
      break;
    case 14:
      attenuation = texture(u_textures[14], surface_data.uv).xyz;
      break;
    case 15:
      attenuation = texture(u_textures[15], surface_data.uv).xyz;
      break;
    case 16:
      attenuation = texture(u_textures[16], surface_data.uv).xyz;
      break;
    case 17:
      attenuation = texture(u_textures[17], surface_data.uv).xyz;
      break;
    case 18:
      attenuation = texture(u_textures[18], surface_data.uv).xyz;
      break;
    case 19:
      attenuation = texture(u_textures[19], surface_data.uv).xyz;
      break;
    case 20:
      attenuation = texture(u_textures[20], surface_data.uv).xyz;
      break;
    case 21:
      attenuation = texture(u_textures[21], surface_data.uv).xyz;
      break;
    case 22:
      attenuation = texture(u_textures[22], surface_data.uv).xyz;
      break;
    case 23:
      attenuation = texture(u_textures[23], surface_data.uv).xyz;
      break;
    case 24:
      attenuation = texture(u_textures[24], surface_data.uv).xyz;
      break;
    default:
      attenuation = vec3(0.9, 0.9, 0.9);
      break;
  }
  return ScatterData(attenuation, scattered);
}

SurfaceData get_surface_data(Ray ray, HitRecord hit_record) {
  SurfaceData data;

  vec2 a_uv = get_uv(hit_record.uv_index.x);
  vec2 b_uv = get_uv(hit_record.uv_index.y);
  vec2 c_uv = get_uv(hit_record.uv_index.z);

  vec3 a_normal = get_normal(hit_record.normal_index.x);
  vec3 b_normal = get_normal(hit_record.normal_index.y);
  vec3 c_normal = get_normal(hit_record.normal_index.z);

  float r = 1.0 - hit_record.p - hit_record.q;

  data.point = ray_at(ray, hit_record.t);
  data.normal = normalize(r * a_normal + hit_record.p * b_normal + hit_record.q * c_normal);
  data.uv = r * a_uv + hit_record.p * b_uv + hit_record.q * c_uv;
  data.material = get_material(hit_record.material_index);

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

  float r = sqrt(rand());
  float theta = 2.0 * g_pi * rand();
  vec3 radial_offset = u_defocus_radius * r * (cos(theta) * u_right + sin(theta) * u_up);

  vec3 pos_offset = (rand() - 0.5) * u_step_x + (rand() - 0.5) * u_step_y;

  vec3 position = u_initial_position + gl_FragCoord.x * u_step_x + gl_FragCoord.y * u_step_y;
  vec3 origin = u_look_from + radial_offset;
  Ray ray = Ray(origin, position + pos_offset - origin);
  vec3 color = cast_ray(ray);

  if (u_sample_count == 1) {
    o_color = vec4(0.0, 0.0, 0.0, 0.0);
  }
  else {
    o_color = texelFetch(u_prev_color, ivec2(gl_FragCoord.xy), 0);
  }

  o_color += vec4(color, 1.0);
}