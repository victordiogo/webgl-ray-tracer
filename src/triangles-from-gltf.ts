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

    const index = geometry.index;

    if (!index) {
      return;
    }

    for (let i = 0; i < position.count; i += 3) {
      const index_a = index.getX(i);
      const index_b = index.getX(i + 1);
      const index_c = index.getX(i + 2);
      let triangle = new Triangle();
      triangle.a.position = new Vector3().fromBufferAttribute(position, index_a);
      triangle.b.position = new Vector3().fromBufferAttribute(position, index_b);
      triangle.c.position = new Vector3().fromBufferAttribute(position, index_c);
      triangle.a.normal = new Vector3().fromBufferAttribute(normal, index_a);
      triangle.b.normal = new Vector3().fromBufferAttribute(normal, index_b);
      triangle.c.normal = new Vector3().fromBufferAttribute(normal, index_c);
      triangle.a.uv = new Vector2().fromBufferAttribute(uv, index_a);
      triangle.b.uv = new Vector2().fromBufferAttribute(uv, index_b);
      triangle.c.uv = new Vector2().fromBufferAttribute(uv, index_c);
      triangles.push(triangle);
    }
  });

  return triangles;
}