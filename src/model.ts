import { Box3, Color, Group, Material, Mesh, MeshPhongMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3DEventMap, Texture, Vector2, Vector3, Vector4 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";	
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

export async function import_gltf(path: string) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(path);
  normalize_scale(gltf.scene);
  move_to_origin(gltf.scene);
  gltf.scene.updateMatrixWorld();
  const meshes: Mesh[] = [];
  gltf.scene.traverse(child => {
    if (child instanceof Mesh) {
      child.geometry.applyMatrix4(child.matrixWorld);
      meshes.push(child);
    }
  });
  return meshes;
}

async function find_mtl_path(obj_path: string) {
  const response = await fetch(obj_path);
  const text = await response.text();
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('mtllib ')) {
      return obj_path.replace(/\/[^\/]+$/, '/') + line.replace('mtllib ', '').trim();
    }
  }
  return null;
}

export async function import_obj(path: string) {
  const mtl_path = await find_mtl_path(path);

  const obj_loader = new OBJLoader();
  let mtl;

  if (mtl_path) {
    const mtl_loader = new MTLLoader();
    mtl = await mtl_loader.loadAsync(mtl_path);
    mtl.preload();
    obj_loader.setMaterials(mtl);
  }

  const obj = await obj_loader.loadAsync(path);

  if (mtl) {
    obj.traverse(child => {
      if (!(child instanceof Mesh)) {
        return;
      }
      function to_physical(material) {
        const info = mtl.materialsInfo[material.name];
        const result = new MeshPhysicalMaterial();
        result.ior = info.ni ? parseFloat(info.ni) : 1.5;
        result.color = info.kd ? new Color().fromArray(info.kd) : new Color(1, 1, 1);
        result.emissive = info.ke ? new Color().fromArray(info.ke) : new Color(0, 0, 0);
        result.opacity = material.opacity;
        result.transparent = material.transparent;
        result.map = material.map;
        result.metalness = info.pm ? parseFloat(info.pm) : 0;
        result.roughness = info.pr ? parseFloat(info.pr) : 1;
        return result;
      }
      if (child.material instanceof Material) {
        child.material = to_physical(child.material);
      }
      else {
        for (let i = 0; i < child.material.length; ++i) {
          if (child.material[i] instanceof Material) {
            child.material[i] = to_physical(child.material[i]);
          }
        } 
      }
    });
  }

  normalize_scale(obj);
  move_to_origin(obj);
  obj.updateMatrixWorld();
  const meshes: Mesh[] = [];
  obj.traverse(child => {
    if (child instanceof Mesh) {
      child.geometry.applyMatrix4(child.matrixWorld);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        material.emissive.r *= material.emissiveIntensity;
        material.emissive.g *= material.emissiveIntensity;
        material.emissive.b *= material.emissiveIntensity;
        material.emissiveIntensity = 1;
      });
      meshes.push(child);
    }
  });
  return meshes;
}

function normalize_scale(object: Group<Object3DEventMap>) {
  const box = new Box3().setFromObject(object);
  const size = new Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z);
  object.scale.setScalar(1 / max);
}

function move_to_origin(object: Group<Object3DEventMap>) {
  const box = new Box3().setFromObject(object);
  const center = new Vector3();
  box.getCenter(center);
  object.position.copy(center).negate();
}