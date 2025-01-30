#version 300 es

precision highp int;
precision highp float;
precision highp sampler2D;
precision highp sampler2DArray;

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
uniform sampler2DArray u_textures;
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

const float g_max_float = 3.402823466e+38;
const float g_pi = 3.1415926535897932385;

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
  return uintBitsToFloat(0x3f800000u | (x >> 9u)) - 1.0;
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
  if (abs(det) < 1e-8) {
    return false;
  }

  float inv_det = 1.0 / det;

  vec3 ao = ray.origin - a;

  vec3 dxao = cross(ray.direction, ao);
  float p = dot(-dxao, ac) * inv_det;
  if (p < 0.0 || p > 1.0) {
    return false;
  }

  float q = dot(dxao, ab) * inv_det;
  if (q < 0.0 || p + q > 1.0) {
    return false;
  }

  float t = dot(abxac, ao) * inv_det;
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
  BvhNode n;
  n.left_index = int(data_a.x);
  n.right_index = int(data_a.y);
  n.bounding_box_axes[0] = data_a.zw;
  n.bounding_box_axes[1] = data_b.xy;
  n.bounding_box_axes[2] = data_b.zw;
  return n;
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
    if (t0 > min_distance) {
      min_distance = t0;
    }
    if (t1 < max_distance) {
      max_distance = t1;
    }
    if (max_distance <= min_distance) {
      return false;
    }
  }
  return true;
}

bool trace(Ray ray, out HitRecord hit_record) {
  int stack[64];
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
  int albedo_index;
  int roughness_index;
  int metallic_index;
  int normal_index;
  int emission_index;
  vec3 albedo;
  vec3 emission;
  float metallic;
  float roughness;
  float transparency;
  float refraction_index;
};

Material get_material(int material_index) {
  ivec2 coords = to_texture_coords(material_index * 4 + 0);
  vec4 data_a = texelFetch(u_materials, coords, 0).xyzw;
  coords = to_texture_coords(material_index * 4 + 1);
  vec4 data_b = texelFetch(u_materials, coords, 0).xyzw;
  coords = to_texture_coords(material_index * 4 + 2);
  vec4 data_c = texelFetch(u_materials, coords, 0).xyzw;
  coords = to_texture_coords(material_index * 4 + 3);
  vec4 data_d = texelFetch(u_materials, coords, 0).xyzw;
  return Material(
    int(data_a.x), 
    int(data_a.y),
    int(data_a.z),
    int(data_a.w),
    int(data_b.x),
    data_b.yzw,
    data_c.xyz,
    data_c.w,
    data_d.x,
    data_d.y,
    data_d.z
  );
}

struct SurfaceData {
  vec3 point;
  vec3 normal;
  vec2 uv;
  bool front_face;
  Material material;
};

bool near_zero(vec3 v, float epsilon) {
  return (abs(v.x) < epsilon) && (abs(v.y) < epsilon) && (abs(v.z) < epsilon);
}

const float g_scatter_bias = 5e-6;

ScatterData scatter_lambertian(SurfaceData surface_data) {
  vec3 direction = surface_data.normal + random_unit_vector();
  if (near_zero(direction, 1e-5)) {
    direction = surface_data.normal;
  }
  Ray scattered = Ray(surface_data.point + surface_data.normal * g_scatter_bias, direction);
  return ScatterData(surface_data.material.albedo, scattered);
}

ScatterData scatter_metal(Ray ray, SurfaceData surface_data) {
  vec3 reflected = reflect(ray.direction, surface_data.normal);
  vec3 ref = normalize(reflected) + surface_data.material.roughness * random_unit_vector();
  if (dot(ref, surface_data.normal) < 0.0) {
    ref = reflected;
  }
  Ray scattered = Ray(surface_data.point + surface_data.normal * g_scatter_bias, ref);
  return ScatterData(surface_data.material.albedo, scattered);
}

float reflectance(float cosine, float ri) {
  float r0 = (1.0 - ri) / (1.0 + ri);
  r0 = r0 * r0;
  return r0 + (1.0 - r0) * pow(1.0 - cosine, 5.0);
}

ScatterData scatter_dielectric(Ray ray, SurfaceData surface_data) {
  float refraction_index = surface_data.front_face ? 1.0 / surface_data.material.refraction_index : surface_data.material.refraction_index;

  vec3 unit_direction = normalize(ray.direction);
  float cos_theta = min(dot(-unit_direction, surface_data.normal), 1.0);  
  float sin_theta = sqrt(1.0 - cos_theta * cos_theta);

  bool cannot_refract = refraction_index * sin_theta > 1.0;
  vec3 direction;
  vec3 point;

  if (cannot_refract || reflectance(cos_theta, refraction_index) > rand()) {
    direction = reflect(unit_direction, surface_data.normal);
    point = surface_data.point + surface_data.normal * g_scatter_bias;
  }
  else {
    direction = refract(unit_direction, surface_data.normal, refraction_index);
    point = surface_data.point - surface_data.normal * g_scatter_bias;
  }

  return ScatterData(vec3(1.0), Ray(point, direction));
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
  data.front_face = dot(ray.direction, data.normal) < 0.0;
  if (!data.front_face) {
    data.normal = -data.normal;
  }
  data.uv = r * a_uv + hit_record.p * b_uv + hit_record.q * c_uv;
  data.material = get_material(hit_record.material_index);

  if (data.material.albedo_index != -1) {
    data.material.albedo = texture(u_textures, vec3(data.uv, data.material.albedo_index)).xyz;
  }

  if (data.material.metallic_index != -1) {
    data.material.metallic = texture(u_textures, vec3(data.uv, data.material.metallic_index)).x;
  }

  if (data.material.roughness_index != -1) {
    data.material.roughness = texture(u_textures, vec3(data.uv, data.material.roughness_index)).x;
  }

  // if (data.material.normal_index != -1) {
  //   vec3 normal = texture(u_textures, vec3(data.uv, data.material.normal_index)).xyz;
  //   normal = 2.0 * normal - 1.0;
  //   data.normal = normalize(normal);
  // }

  if (data.material.emission_index != -1) {
    data.material.emission = texture(u_textures, vec3(data.uv, data.material.emission_index)).xyz;
  }

  return data;
}

vec3 fresnel_schlick(float cosTheta, vec3 F0){
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
} 

float distribution_ggx(vec3 N, vec3 H, float roughness) {
  float a      = roughness*roughness;
  float a2     = a*a;
  float NdotH  = max(dot(N, H), 0.0);
  float NdotH2 = NdotH*NdotH;

  float num   = a2;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = g_pi * denom * denom;

  return num / denom;
}

float geometry_schlick_ggx(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r*r) / 8.0;

  float num   = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return num / denom;
}

float geometry_smith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2  = geometry_schlick_ggx(NdotV, roughness);
  float ggx1  = geometry_schlick_ggx(NdotL, roughness);

  return ggx1 * ggx2;
}

ScatterData scatter_pbr(Ray ray, SurfaceData surface_data) {
  vec3 N = surface_data.normal;
  vec3 V = normalize(-ray.direction);
  vec3 L = random_unit_vector();
  if (dot(L, N) < 0.0) {
    L = -L;
  }
  L = normalize(L);

  vec3 H = normalize(L + V);

  vec3 f0 = mix(vec3(0.04), surface_data.material.albedo, surface_data.material.metallic);
  vec3 F = fresnel_schlick(clamp(dot(H, V), 0.0, 1.0), f0);

  float NDF = distribution_ggx(N, H, surface_data.material.roughness);
  float G = geometry_smith(N, V, L, surface_data.material.roughness);

  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 1e-5;
  vec3 specular = numerator / denominator;

  vec3 ks = F;
  vec3 kd = vec3(1.0) - ks;
  kd *= 1.0 - surface_data.material.metallic;

  float ndotl = max(dot(N, L), 0.0);

  vec3 attenuation = (kd * surface_data.material.albedo / g_pi + specular) * ndotl;

  return ScatterData(attenuation, Ray(surface_data.point + N * g_scatter_bias, L));
}

vec3 cast_ray(Ray ray) {
  vec3 color = vec3(1.0);

  for (int depth = 0; depth <= u_max_depth; ++depth) {
    if (depth == u_max_depth) {
      color = vec3(0.0);
      break;
    }

    if (near_zero(color, 1e-3)) {
      break;
    }

    HitRecord hit_record;

    if (!trace(ray, hit_record)) {
      color *= u_background_color * 3.0;
      break;
    }

    SurfaceData surface_data = get_surface_data(ray, hit_record);
    // color = surface_data.normal * 0.5 + 0.5;
    // break;

    if (!near_zero(surface_data.material.emission, 1e-3)) {
      color *= surface_data.material.emission * 3.0;
      break;
    }

    // surface_data.material.roughness = clamp(surface_data.material.roughness, 0.3, 1.0);
    // surface_data.material.metallic = 0.9;
    ScatterData scatter_data = scatter_pbr(ray, surface_data);
    // ScatterData scatter_data;
    // if (surface_data.material.transparency > 0.5) {
    //   scatter_data = scatter_dielectric(ray, surface_data);
    // }
    // else if (surface_data.material.metallic > 0.5) {
    //   scatter_data = scatter_metal(ray, surface_data);
    // }
    // else {
    //   scatter_data = scatter_lambertian(surface_data);
    // }
    color *= scatter_data.attenuation;
    ray = scatter_data.scattered;
  }

  return color;
}

Ray generate_ray() {
  float r = sqrt(rand());
  float theta = 2.0 * g_pi * rand();
  vec3 radial_offset = u_defocus_radius * r * (cos(theta) * u_right + sin(theta) * u_up);

  vec3 pos_offset = (rand() - 0.5) * u_step_x + (rand() - 0.5) * u_step_y;

  vec3 position = u_initial_position + gl_FragCoord.x * u_step_x + gl_FragCoord.y * u_step_y;
  vec3 origin = u_look_from + radial_offset;
  return Ray(origin, position + pos_offset - origin);
}

void main() {
  init_rng();

  Ray ray = generate_ray();
  vec3 color = cast_ray(ray);

  if (u_sample_count == 1) {
    o_color = vec4(0.0, 0.0, 0.0, 0.0);
  }
  else {
    o_color = texelFetch(u_prev_color, ivec2(gl_FragCoord.xy), 0);
  }

  o_color += vec4(color, 1.0);
}