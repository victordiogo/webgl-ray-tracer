import { load_text_file } from "./load-text-file";
import { Texture } from "./texture";

import { Vector2, Vector3, Vector4 } from "three";

export class Material {
  texture_index: number;
  albedo: Vector3;
  emission: Vector3;
  metallic: number;
  roughness: number; 
  transparency: number; 
  refraction_index: number;

  constructor(
    texture_index: number = -1, 
    albedo: Vector3 = new Vector3(1, 1, 1), 
    emission: Vector3 = new Vector3(0, 0, 0),
    metallic: number = 0,
    roughness: number = 1,
    transparency: number = 0,
    refraction_index: number = 1) {
    this.texture_index = texture_index;
    this.albedo = albedo;
    this.emission = emission;
    this.metallic = metallic;
    this.roughness = roughness;
    this.transparency = transparency;
    this.refraction_index = refraction_index;
  }
};

export class Model {
  positions: Vector3[] = [];
  normals: Vector3[] = [];
  uvs: Vector2[] = [];
  materials: Material[] = [];
  indices: Vector4[] = []; // x: position, y: uv, z: normal, w: material
  textures: Texture[] = [];

  static async import_obj(obj_dir: string, file_name: string) : Promise<Model> {
    const obj_path = obj_dir + file_name;
    const file = (await load_text_file(obj_path)).split("\n");
    const model = new Model();
    const materials: Map<string, Material> = new Map();
    const textures: Map<string, number> = new Map();
    
    for (let i = 0; i < file.length; ++i) {
      const line = file[i];
      const tokens = line.split(" ");
      if (tokens[0] === "mtllib") {
        await Model.import_materials(obj_dir, tokens[1], model, materials, textures);
      }
      else if (tokens[0] === "v") {
        model.positions.push(new Vector3(
          parseFloat(tokens[1]),
          parseFloat(tokens[2]),
          parseFloat(tokens[3])
        ));
      } 
      else if (tokens[0] === "vn") {
        model.normals.push(new Vector3(
          parseFloat(tokens[1]),
          parseFloat(tokens[2]),
          parseFloat(tokens[3])
        ));
      } 
      else if (tokens[0] === "vt") {
        model.uvs.push(new Vector2(
          parseFloat(tokens[1]),
          parseFloat(tokens[2])
        ));
      }
      else if (tokens[0] === "usemtl") {
        const material = materials.get(tokens[1]);
        if (!material) {
          throw new Error("Material must be defined before usemtl");
        }
        model.materials.push(material);
      }
      else if (tokens[0] === "f") {
        if (model.materials.length === 0) {
          throw new Error("usemtl must be defined before faces");
        }
        const vertices: Vector4[] = [];
        for (let j = 1; j < tokens.length; ++j) {
          const vertex_arr = tokens[j].split("/");
          const vertex = new Vector4();
          vertex.x = parseInt(vertex_arr[0]) - 1; // position
          vertex.y = parseInt(vertex_arr[1]) - 1; // uv
          vertex.z = parseInt(vertex_arr[2]) - 1; // normal
          vertex.w = model.materials.length - 1;  // material
          vertices.push(vertex);
        }
        for (let j = 1; j < vertices.length - 1; ++j) {
          const a = vertices[0].clone();
          const b = vertices[j].clone();
          const c = vertices[j + 1].clone();
          model.indices.push(a, b, c);
        }
      }
    }

    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const position of model.positions) {
      min.x = Math.min(min.x, position.x);
      min.y = Math.min(min.y, position.y);
      min.z = Math.min(min.z, position.z);
      max.x = Math.max(max.x, position.x);
      max.y = Math.max(max.y, position.y);
      max.z = Math.max(max.z, position.z);
    }
    const center = min.clone().add(max).multiplyScalar(0.5);
    const size = max.clone().sub(min);
    const max_size = Math.max(size.x, size.y, size.z);
    for (const position of model.positions) {
      position.sub(center).divideScalar(max_size);
    }

    return model;
  }

  static async import_materials(obj_dir: string, file_name: string, o_model: Model, o_materials: Map<string, Material>, o_textures: Map<string, number>) {
    const file = (await load_text_file(obj_dir + file_name)).split("\n");
    let material_name: string | null = null;

    for (let i = 0; i < file.length; ++i) {
      const line = file[i];
      const tokens = line.split(" ");
      if (tokens[0] === "newmtl") {
        material_name = tokens[1];
        o_materials.set(material_name, new Material());
      }
      else if (tokens[0] === "map_Kd") {
        const texture_path = obj_dir + tokens[1];
        await Model.import_texture(texture_path, o_model, o_textures);
        if (!material_name) {
          throw new Error("newmtl must be defined before map_Kd");
        }
        const material = o_materials.get(material_name)!;
        material.texture_index = o_textures.get(texture_path)!;
      }
      else if (tokens[0] === "Kd") {
        if (!material_name) {
          throw new Error("newmtl must be defined before Kd");
        }
        const material = o_materials.get(material_name)!;
        material.albedo = new Vector3(
          parseFloat(tokens[1]),
          parseFloat(tokens[2]),
          parseFloat(tokens[3])
        );
      }
      else if (tokens[0] === "Ke") {
        if (!material_name) {
          throw new Error("newmtl must be defined before Ke");
        }
        const material = o_materials.get(material_name)!;
        material.emission = new Vector3(
          parseFloat(tokens[1]),
          parseFloat(tokens[2]),
          parseFloat(tokens[3])
        );
      }
      else if (tokens[0] === "Pm") {
        if (!material_name) {
          throw new Error("newmtl must be defined before Pm");
        }
        const material = o_materials.get(material_name)!;
        material.metallic = parseFloat(tokens[1]);
      }
      else if (tokens[0] === "Pr") {
        if (!material_name) {
          throw new Error("newmtl must be defined before Pf");
        }
        const material = o_materials.get(material_name)!;
        material.roughness = parseFloat(tokens[1]);
      }
      else if (tokens[0] === "Tr" || tokens[0] === "d") {
        if (!material_name) {
          throw new Error("newmtl must be defined before Tr");
        }
        const material = o_materials.get(material_name)!
        material.transparency = parseFloat(tokens[1]);
        if (tokens[0] === "d") {
          material.transparency = 1 - material.transparency;
        }
      }
      else if (tokens[0] === "Ni") {
        if (!material_name) {
          throw new Error("newmtl must be defined before Ni");
        }
        const material = o_materials.get(material_name)!;
        material.refraction_index = parseFloat(tokens[1]);
      }
    }
  }

  static async import_texture(texture_path: string, o_model: Model, o_textures: Map<string, number>) {
    if (o_textures.has(texture_path)) {
      return;
    }
    const texture = await Texture.from_file(texture_path);
    const index = o_model.textures.length;
    o_model.textures.push(texture);
    o_textures.set(texture_path, index);
  }
};