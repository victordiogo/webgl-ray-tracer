import { load_text_file } from "./load-text-file";
import { Texture } from "./texture";

import { Vector2, Vector3 } from "three";

export class Material {
  texture_index: number;

  constructor(texture_index: number = -1) {
    this.texture_index = texture_index;
  }
};

export class Model {
  positions: Vector3[] = [];
  normals: Vector3[] = [];
  uvs: Vector2[] = [];
  materials: Material[] = [];
  textures: Texture[] = [];

  static async import_obj(obj_dir: string, file_name: string) : Promise<Model> {
    const obj_path = obj_dir + file_name;
    const file = (await load_text_file(obj_path)).split("\n");
    const model = new Model();
    const positions: Vector3[] = [];
    const normals: Vector3[] = [];
    const uvs: Vector2[] = [];
    const materials: Map<string, Material> = new Map();
    const textures: Map<string, Texture> = new Map();
    let current_material: Material | null = null;
    
    for (let i = 0; i < file.length; ++i) {
      const line = file[i];
      const tokens = line.split(" ");
      if (tokens[0] === "mtllib") {
        await Model.import_materials(obj_dir, tokens[1], materials, textures);
      }
      else if (tokens[0] === "v") {
        positions.push(new Vector3(
          parseFloat(tokens[1]),
          parseFloat(tokens[2]),
          parseFloat(tokens[3])
        ));
      } 
      else if (tokens[0] === "vn") {
        normals.push(new Vector3(
          parseFloat(tokens[1]),
          parseFloat(tokens[2]),
          parseFloat(tokens[3])
        ));
      } 
      else if (tokens[0] === "vt") {
        uvs.push(new Vector2(
          parseFloat(tokens[1]),
          parseFloat(tokens[2])
        ));
      }
      else if (tokens[0] === "usemtl") {
        const material = materials.get(tokens[1]);
        if (!material) {
          throw new Error("Material not found");
        }
        current_material = material;
      }
      else if (tokens[0] === "f") {
        if (!current_material) {
          throw new Error("Material not set for face");
        }
        class Vertex {
          position: number;
          uv: number;
          normal: number;
        }
        let vertices: Vertex[] = [];
        for (let j = 1; j < tokens.length; ++j) {
          const vertex_i = tokens[j].split("/");
          const vertex = new Vertex();
          vertex.position = parseInt(vertex_i[0]) - 1;
          vertex.uv = parseInt(vertex_i[1]) - 1;
          vertex.normal = parseInt(vertex_i[2]) - 1;
          vertices.push(vertex);
        }
        for (let j = 1; j < vertices.length - 1; ++j) {
          const a = vertices[0];
          const b = vertices[j];
          const c = vertices[j + 1];
          model.positions.push(positions[a.position].clone());
          model.positions.push(positions[b.position].clone());
          model.positions.push(positions[c.position].clone());
          model.normals.push(normals[a.normal].clone());
          model.normals.push(normals[b.normal].clone());
          model.normals.push(normals[c.normal].clone());
          model.uvs.push(uvs[a.uv].clone());
          model.uvs.push(uvs[b.uv].clone());
          model.uvs.push(uvs[c.uv].clone());
          model.materials.push(current_material);
        }
      }
    }

    for (const texture of textures.values()) {
      model.textures[texture.index] = texture;
    }

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
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

  static async import_materials(obj_dir: string, file_name: string, o_materials: Map<string, Material>, o_textures: Map<string, Texture>) {
    const file = (await load_text_file(obj_dir + file_name)).split("\n");
    let material_name: string | null = null;
    let texture_path: string | null = null;

    for (let i = 0; i < file.length; ++i) {
      const line = file[i];
      const tokens = line.split(" ");
      if (tokens[0] === "newmtl") {
        material_name = tokens[1];
        o_materials.set(material_name, new Material());
      }
      else if (tokens[0] === "map_Kd") {
        texture_path = obj_dir + tokens[1];
        await Model.import_texture(texture_path, o_textures);
      }

      if (material_name && texture_path) {
        o_materials.get(material_name)!.texture_index = o_textures.get(texture_path)!.index;
      }
    }
  }

  static async import_texture(texture_path: string, o_textures: Map<string, Texture>) {
    if (o_textures.has(texture_path)) {
      return;
    }
    const texture = await Texture.from_image(texture_path);
    texture.index = o_textures.size;
    o_textures.set(texture_path, texture);
  }
};