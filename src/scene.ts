import { Bvh } from "./bvh";

import { Mesh, Vector2, Vector3, Vector4, MeshStandardMaterial, MeshPhongMaterial, MeshPhysicalMaterial, BufferAttribute, Material, Texture } from "three";

function get_texture_data(texture: Texture, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get 2d context');
  }
  if (texture.flipY) {
    // flip image vertically
    context.translate(0, height);
    context.scale(1, -1);
  }
  context.drawImage(texture.image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

class SceneData {
  positions: Vector3[] = [];
  normals: Vector3[] = [];
  uvs: Vector2[] = [];
  materials: Material[] = [];
  indices: Vector4[] = []; // x: position, y: uv, z: normal, w: material
  textures: Texture[] = [];
};

export class Scene {
  meshes: Mesh[] = [];
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

  add(...meshes: Mesh[]) : void {
    this.meshes.push(...meshes);
  }

  merge_meshes() {
    const merged = new SceneData();

    for (const mesh of this.meshes) {
      const position = mesh.geometry.getAttribute('position');
      const normal = mesh.geometry.getAttribute('normal');
      const uv = mesh.geometry.getAttribute('uv');
      const index = mesh.geometry.getIndex();

      const materials: Material[] = [];
      if (mesh.material instanceof Material) {
        materials.push(mesh.material);
      }
      else if (mesh.material instanceof Array) {
        materials.push(...mesh.material);
      }

      materials.forEach(m => {
        if (m["map"]) {
          merged.textures.push(m["map"]);
          m.userData.albedo_index = merged.textures.length - 1;
        }
        else {
          m.userData.albedo_index = -1;
        }

        if (m["normalMap"]) {
          merged.textures.push(m["normalMap"]);
          m.userData.normal_index = merged.textures.length - 1;
        }
        else {
          m.userData.normal_index = -1;
        }

        if (m["roughnessMap"]) {
          merged.textures.push(m["roughnessMap"]);
          m.userData.roughness_index = merged.textures.length - 1;
        }
        else {
          m.userData.roughness_index = -1;
        }

        if (m["metalnessMap"]) {
          merged.textures.push(m["metalnessMap"]);
          m.userData.metalness_index = merged.textures.length - 1;
        }
        else {
          m.userData.metalness_index = -1;
        }

        if (m["emissiveMap"]) {
          merged.textures.push(m["emissiveMap"]);
          m.userData.emission_index = merged.textures.length - 1;
        }
        else {
          m.userData.emission_index = -1;
        }

        merged.materials.push(m);
      });

      if (merged.materials.length === 0) {
        merged.materials.push(new MeshStandardMaterial());
      }

      if (mesh.geometry.groups.length === 0) {
        if (index) {
          mesh.geometry.addGroup(0, index.count, 0);
        }
        else {
          mesh.geometry.addGroup(0, position.count, 0);
        }
      }

      if (index) {
        for (let group = 0; group < mesh.geometry.groups.length; ++group) {
          const start = mesh.geometry.groups[group].start;
          const count = mesh.geometry.groups[group].count;
          for (let i = start; i < start + count; ++i) {
            const idx = index.getX(i);
            const material_index = merged.materials.length - mesh.geometry.groups.length + (mesh.geometry.groups[group].materialIndex || group);
            merged.indices.push(new Vector4(
              idx + merged.positions.length, 
              idx + merged.uvs.length, 
              idx + merged.normals.length, 
              material_index)
            );
          }
        }
      }
      else {
        for (let group = 0; group < mesh.geometry.groups.length; ++group) {
          const start = mesh.geometry.groups[group].start;
          const count = mesh.geometry.groups[group].count;
          for (let i = start; i < start + count; ++i) {
            const material_index = merged.materials.length - mesh.geometry.groups.length + (mesh.geometry.groups[group].materialIndex || group);
            merged.indices.push(new Vector4(
              i + merged.positions.length, 
              i + merged.uvs.length, 
              i + merged.normals.length, 
              material_index)
            );
          }
        }
      }

      for (let i = 0; i < position.count; ++i) {
        merged.positions.push(new Vector3().fromBufferAttribute(position, i));
      }

      for (let i = 0; i < normal.count; ++i) {
        merged.normals.push(new Vector3().fromBufferAttribute(normal, i));
      }

      if (uv) {
        for (let i = 0; i < uv.count; ++i) {
          merged.uvs.push(new Vector2().fromBufferAttribute(uv as BufferAttribute, i));
        }
      }
    }
    
    return merged;
  }
  
  update() {
    // cleanup last scene
    
    const merged = this.merge_meshes();
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
    const materials_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.materials.length * 4);
    const materials_height = Math.ceil(merged.materials.length * 4 / materials_width);
    data = new Float32Array(materials_width * materials_height * 4);
    merged.materials.forEach((m, i) => {
      const albedo = m["color"] || new Vector3(1, 1, 1);
      const ei = m["emissiveIntensity"] !== undefined ? m["emissiveIntensity"] : 1;
      const emissive = m["emissive"] || new Vector3(0, 0, 0);
      emissive.multiplyScalar(ei);
      const metalness = m["metalness"] !== undefined ? m["metalness"] : 0;
      const roughness = m["roughness"] !== undefined ? m["roughness"] : 1;

      data.set([
        m.userData.albedo_index, 
        m.userData.roughness_index,
        m.userData.metalness_index,
        m.userData.normal_index,
        m.userData.emission_index,
        ...albedo.toArray(), 
        ...emissive.toArray(), 
        metalness, 
        roughness, 
        m.transparent ? 1 : 1 - m.opacity,
        m['ior'] || 1.5,
        0
      ], i * 4 * 4)
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
        this.gl.texSubImage3D(this.gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, max_width, max_height, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, get_texture_data(t, max_width, max_height));
      });
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
      this.gl.texParameteri(this.gl.TEXTURE_2D_ARRAY, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
    }
  }

  use(program: WebGLProgram) {
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_positions"), 2);
    this.gl.activeTexture(this.gl.TEXTURE2);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positions);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_normals"), 3);
    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.normals);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_uvs"), 4);
    this.gl.activeTexture(this.gl.TEXTURE4);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uvs);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_materials"), 5);
    this.gl.activeTexture(this.gl.TEXTURE5);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.materials);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_indices"), 6);
    this.gl.activeTexture(this.gl.TEXTURE6);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.indices);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_bvh"), 7);
    this.gl.activeTexture(this.gl.TEXTURE7);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.bvh);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_textures"), 8);
    this.gl.activeTexture(this.gl.TEXTURE8);
    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textures);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_max_texture_size"), this.gl.MAX_TEXTURE_SIZE);
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_bvh_length"), this.bvh_length);
  }
};