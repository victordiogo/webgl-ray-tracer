import { Bvh } from "./bvh";
import { Material, Model } from "./model";

import { Vector4 } from "three";

export class Scene {
  models: Model[] = [];
  gl: WebGL2RenderingContext;
  positions: WebGLTexture; 
  normals: WebGLTexture;
  uvs: WebGLTexture;
  indices: WebGLTexture;
  materials: WebGLTexture;
  bvh: WebGLTexture;
  textures: WebGLTexture | null = null;
  bvh_length: number;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  add(model: Model) : void {
    this.models.push(model);
  }

  merge_models() : Model {
    const merged = new Model();

    for (const model of this.models) {
      model.indices.forEach(i => {
        const pos_index = i.x + merged.positions.length;
        const uv_index = i.y + merged.uvs.length;
        const normal_index = i.z + merged.normals.length;
        const material_index = i.w + merged.materials.length;
        merged.indices.push(new Vector4(pos_index, uv_index, normal_index, material_index));
      });
      model.positions.forEach(p => {
        merged.positions.push(p.clone());
      });
      model.normals.forEach(n => {
        merged.normals.push(n.clone())
      });
      model.uvs.forEach(uv => {
        merged.uvs.push(uv.clone())
      });
      model.materials.forEach(m => {
        let texture_index = m.texture_index;
        if (texture_index !== -1) {
          texture_index += merged.textures.length;
        }
        merged.materials.push({ ...m, texture_index });
      });
      merged.textures.push(...model.textures);
    }
    
    return merged;
  }
  
  update() {
    const merged = this.merge_models();
    const bvh = new Bvh(merged);

    this.bvh_length = bvh.list.length;
    
    this.positions = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positions);
    const positions_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.positions.length);
    const positions_height = Math.ceil(merged.positions.length / positions_width);
    let data = new Float32Array(positions_width * positions_height * 3);
    merged.positions.forEach((p, i) => data.set(p.toArray(), i * 3));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB32F, positions_width, positions_height, 0, this.gl.RGB, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    
    this.normals = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.normals);
    const normals_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.normals.length);
    const normals_height = Math.ceil(merged.normals.length / normals_width);
    data = new Float32Array(normals_width * normals_height * 3);
    merged.normals.forEach((n, i) => data.set(n.toArray(), i * 3));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB32F, normals_width, normals_height, 0, this.gl.RGB, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    this.uvs = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uvs);
    const uvs_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.uvs.length);
    const uvs_height = Math.ceil(merged.uvs.length / uvs_width);
    data = new Float32Array(uvs_width * uvs_height * 2);
    merged.uvs.forEach((uv, i) => data.set(uv.toArray(), i * 2));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RG32F, uvs_width, uvs_height, 0, this.gl.RG, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    this.indices = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.indices);
    const indices_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.indices.length);
    const indices_height = Math.ceil(merged.indices.length / indices_width);
    data = new Float32Array(indices_width * indices_height * 4);
    merged.indices.forEach((i, j) => data.set(i.toArray(), j * 4));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, indices_width, indices_height, 0, this.gl.RGBA, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    
    this.materials = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.materials);
    const materials_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.materials.length * 3);
    const materials_height = Math.ceil(merged.materials.length * 3 / materials_width);
    data = new Float32Array(materials_width * materials_height * 4);
    merged.materials.forEach((m, i) => {
      data.set([m.texture_index, ...m.albedo, ...m.emission, m.metallic, m.roughness, m.transparency, m.refraction_index, 0], i * 12)
    });
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, materials_width, materials_height, 0, this.gl.RGBA, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    this.bvh = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.bvh);
    const bvh_width = Math.min(this.gl.MAX_TEXTURE_SIZE, bvh.list.length * 2);
    const bvh_height = Math.ceil(bvh.list.length * 2 / bvh_width);
    data = new Float32Array(bvh_width * bvh_height * 4);
    bvh.list.forEach((node, i) => {
      data.set([node.left_index, node.right_index, ...node.aabb.to_array()], i * 8);
    });
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, bvh_width, bvh_height, 0, this.gl.RGBA, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    if (merged.textures.length > 0) {
      let max_width = 0;
      let max_height = 0;
      merged.textures.forEach(t => {
        max_width = Math.max(max_width, t.image.width);
        max_height = Math.max(max_height, t.image.height);
      });

      this.textures = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textures);
      this.gl.texStorage3D(this.gl.TEXTURE_2D_ARRAY, 1, this.gl.RGBA8, max_width, max_height, merged.textures.length);
      merged.textures.forEach((t, i) => {
        this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, max_width, max_height, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, t.data(max_width, max_height));
      });
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
    }
  }

  use(program: WebGLProgram) {
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_positions"), 1);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positions);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_normals"), 2);
    this.gl.activeTexture(this.gl.TEXTURE2);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.normals);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_uvs"), 3);
    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uvs);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_materials"), 4);
    this.gl.activeTexture(this.gl.TEXTURE4);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.materials);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_indices"), 5);
    this.gl.activeTexture(this.gl.TEXTURE5);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.indices);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_bvh"), 6);
    this.gl.activeTexture(this.gl.TEXTURE6);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.bvh);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_textures"), 7);
    this.gl.activeTexture(this.gl.TEXTURE7);
    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textures);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_max_texture_size"), this.gl.MAX_TEXTURE_SIZE);
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_bvh_length"), this.bvh_length);
  }
};