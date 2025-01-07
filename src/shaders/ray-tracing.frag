#version 300 es

precision highp float;

struct Ray {
  vec3 origin;
  vec3 direction;
};

vec3 ray_at(Ray ray, float t) {
  return ray.origin + t * ray.direction;
}

uniform sampler2D u_color_texture;
uniform int u_sample_count;
uniform vec3 u_background_color;
uniform float u_defocus_radius;
uniform vec3 u_initial_position;
uniform vec3 u_step_x;
uniform vec3 u_step_y;
uniform vec3 u_look_from;

out vec4 o_color;

// struct HitRecord {
//   float t;
//   vec3 p;
//   vec3 normal;
// };

// float g_no_hit = 1e9;

// HitRecord trace(Ray ray) {
//   HitRecord closest_hit;
//   closest_hit.t = g_no_hit;

//   for (int i = 0; i < 100000; ++i) {
//     Triangle triangle = u_triangles[i];
//     vec3 e1 = triangle.b - triangle.a;
//     vec3 e2 = triangle.c - triangle.a;
//     vec3 normal = cross(e1, e2);
//     float denominator = dot(normal, ray.direction);
//     if (abs(denominator) < 1e-6) {
//       continue;
//     }
//     float t = dot(normal, triangle.a - ray.origin) / denominator;
//     if (t < 0.0 || t > closest_hit.t) {
//       continue;
//     }
//     vec3 p = ray_at(ray, t);
//     vec3 c = p - triangle.a;
//     float u = dot(cross(ray.direction, e2), c) / dot(normal, cross(e1, e2));
//     if (u < 0.0 || u > 1.0) {
//       continue;
//     }
//     float v = dot(cross(e1, ray.direction), c) / dot(normal, cross(e1, e2));
//     if (v < 0.0 || u + v > 1.0) {
//       continue;
//     }
//     closest_hit.t = t;
//     closest_hit.p = p;
//     closest_hit.normal = normal;
//     closest_hit.material = triangle.material;
//   }

//   return closest_hit;
// }

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

bool hit_triangle(vec3 a, vec3 b, vec3 c, Ray ray) {
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
  if (t < 0.0) {
    return false;
  }

  return true;
}


vec3 ray_cast(Ray ray) {
  vec3 a = vec3(0.0, 0.0, 0.0);
  vec3 b = vec3(1.0, 0.0, 0.0);
  vec3 c = vec3(0.0, 1.0, 0.0);

  if (hit_triangle(a, b, c, ray)) {
    return vec3(1.0, 0.0, 0.0);
  }

  return u_background_color;
  // vec3 color = vec3(1.0, 1.0, 1.0);

  // for (int depth = 0; depth < 10; ++depth) {
  //   HitRecord closest_hit = trace(ray);

  //   if (closest_hit.t == g_no_hit) {
  //     return u_background_color;
  //   }

  //   ScatterData scatter_data = scatter_lambertian(closest_hit.normal);
  //   color *= scatter_data.attenuation;

  //   ray = scatter_data.scattered;
  // }

  // return color;
}

void main() {
  vec3 position = u_initial_position + gl_FragCoord.x * u_step_x + gl_FragCoord.y * u_step_y;
  Ray ray = Ray(u_look_from, position - u_look_from);
  vec3 color = ray_cast(ray);

  if (u_sample_count == 1) {
    o_color = vec4(0.0, 0.0, 0.0, 1.0);
  }
  else {
    o_color = texelFetch(u_color_texture, ivec2(gl_FragCoord.xy), 0);
  }

  o_color += vec4(color, 1.0);
}