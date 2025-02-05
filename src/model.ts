import { Box3, Color, Group, Material, Mesh, MeshPhysicalMaterial, Object3DEventMap, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";	
import { MaterialInfo, MTLLoader } from "three/addons/loaders/MTLLoader.js";

function process_model(model: Group<Object3DEventMap>) {
  normalize_scale(model);
  move_to_origin(model);
  return model;
}

export async function import_gltf(path: string) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(path);
  return process_model(gltf.scene);
}

async function find_mtl_path(obj_path: string) : Promise<string | null> {
  const response = await fetch(obj_path);
  const text = await response.text();
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('mtllib ')) {
      const path = obj_path.replace(/\/[^\/]+$/, '/');
      const file = line.replace('mtllib ', '').trim();
      return path + file;
    }
  }

  return null;
}

function to_physical_material(material: Material, info: MaterialInfo) {
  const physical = new MeshPhysicalMaterial();
  physical.ior = info["ni"] ? parseFloat(info["ni"]) : 1;
  physical.color = info.kd ? new Color().fromArray(info.kd) : new Color(1, 1, 1);
  physical.emissive = info.ke ? new Color().fromArray(info.ke) : new Color(0, 0, 0);
  physical.transmission = 1 - material.opacity;
  physical.opacity = material.opacity;
  physical.transparent = material.transparent;
  physical.map = material["map"] || null;
  physical.metalness = info["pm"] ? parseFloat(info["pm"]) : 0;
  physical.roughness = info["pr"] ? parseFloat(info["pr"]) : 1;
  return physical;
}

export async function import_obj(path: string) {
  const mtl_path = await find_mtl_path(path);
  const obj_loader = new OBJLoader();
  let mtl: MTLLoader.MaterialCreator | null = null;

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
      if (child.material instanceof Material) {
        child.material = to_physical_material(child.material, mtl.materialsInfo[child.material.name]);
      }
      else {
        for (let i = 0; i < child.material.length; ++i) {
          child.material[i] = to_physical_material(child.material[i], mtl.materialsInfo[child.material[i].name]);
        } 
      }
    });
  }

  return process_model(obj);
}

function normalize_scale(object: Group<Object3DEventMap>) {
  const box = new Box3().setFromObject(object, true);
  const size = new Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z);
  object.scale.setScalar(1 / max);
}

function move_to_origin(object: Group<Object3DEventMap>) {
  const box = new Box3().setFromObject(object, true);
  const center = new Vector3();
  box.getCenter(center);
  object.position.copy(center).negate();
  object.position.y = -box.min.y;
}