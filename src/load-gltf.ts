import { Triangle, triangles_from_gltf } from "./triangles-from-gltf";

import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export async function load_gltf(file_path: string, scale: number = 1): Promise<Triangle[]> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(file_path);

  const triangles = triangles_from_gltf(gltf);

  const bounding_box = new Box3().setFromObject(gltf.scene);

  move_to_origin(bounding_box, triangles);
  normalize_and_scale(bounding_box, triangles, scale);

  return triangles;
}

function move_to_origin(bounding_box: Box3, triangles: Triangle[]) {
  const center = new Vector3();
  bounding_box.getCenter(center);

  for (const triangle of triangles) {
    triangle.a.position.sub(center);
    triangle.b.position.sub(center);
    triangle.c.position.sub(center);
  }
}

function normalize_and_scale(bounding_box: Box3, triangles: Triangle[], scale: number) {
  const size = new Vector3();
  bounding_box.getSize(size);

  const max_size = Math.max(size.x, size.y, size.z);
  const normalized_scale = scale / max_size;

  for (const triangle of triangles) {
    triangle.a.position.multiplyScalar(normalized_scale);
    triangle.b.position.multiplyScalar(normalized_scale);
    triangle.c.position.multiplyScalar(normalized_scale);
  }
}
