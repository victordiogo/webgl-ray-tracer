import { Mesh, Vector2, Vector3 } from "three";
import { GLTF } from "three/addons/loaders/GLTFLoader.js";

export class Vertex {
  position: Vector3;
  normal: Vector3;
  uv: Vector2;
};

export class Triangle {
  a: Vertex = new Vertex();
  b: Vertex = new Vertex();
  c: Vertex = new Vertex();
};

export function triangles_from_gltf(gltf: GLTF) : Triangle[] {
  const triangles: Triangle[] = [];

  gltf.scene.traverse(child => {
    if (!(child instanceof Mesh)) {
      return;
    }

    const geometry = child.geometry;
    if (!geometry) {
      return;
    }

    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;

    if (!position || !normal || !uv) {
      return;
    }

    for (let i = 0; i < position.count; i += 3) {
      let triangle = new Triangle();
      triangle.a.position = new Vector3().fromBufferAttribute(position, i);
      triangle.b.position = new Vector3().fromBufferAttribute(position, i + 1);
      triangle.c.position = new Vector3().fromBufferAttribute(position, i + 2);
      triangle.a.normal = new Vector3().fromBufferAttribute(normal, i);
      triangle.b.normal = new Vector3().fromBufferAttribute(normal, i + 1);
      triangle.c.normal = new Vector3().fromBufferAttribute(normal, i + 2);
      triangle.a.uv = new Vector2().fromBufferAttribute(uv, i);
      triangle.b.uv = new Vector2().fromBufferAttribute(uv, i + 1);
      triangle.c.uv = new Vector2().fromBufferAttribute(uv, i + 2);
      triangles.push(triangle);
    }
  });

  return triangles;
}