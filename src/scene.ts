import { Bvh } from "./bvh";

import { Mesh } from "three";
import * as Three from "three";

import { Vector2, Vector3, Vector4, BufferAttribute, Material, Texture } from "three";

const g_canvas = document.createElement('canvas');
const g_context = g_canvas.getContext('2d', { willReadFrequently: true });

function get_texture_data(texture: Texture, width: number, height: number) {
  g_canvas.width = width;
  g_canvas.height = height;
  if (!g_context) {
    throw new Error('Failed to get 2d context');
  }
  if (texture.flipY) {
    g_context.translate(0, height);
    g_context.scale(1, -1);
  }
  g_context.drawImage(texture.image, 0, 0, width, height);
  return g_context.getImageData(0, 0, width, height).data;
}
export class Scene extends Three.Scene {
  num_triangles: number = 0;
  environment: Texture;
  meshes_needs_update: boolean = false;
  environment_needs_update: boolean = false;
  environment_intensity_needs_update: boolean = false;

  environment_texture: WebGLTexture | null = null;
  positions_texture: WebGLTexture | null = null;
  normals_texture: WebGLTexture | null = null;
  uvs_texture: WebGLTexture | null = null;
  tangents_texture: WebGLTexture | null = null;
  indices_texture: WebGLTexture | null = null;
  materials_texture: WebGLTexture | null = null;
  bvh_texture: WebGLTexture | null = null;
  textures_texture: WebGLTexture | null = null;

  constructor(environment: Texture) {
    super();
    this.environment = environment;
    this.environment_needs_update = true;
    this.environment_intensity_needs_update = true;
  }

  merge_meshes() {
    const positions: Vector3[] = [];
    const normals: Vector3[] = [];
    const uvs: Vector2[] = [];
    const tangents: Vector3[] = [];
    const indices: Vector4[] = [];
    const materials: Material[] = [];
    const groups: { start: number, count: number, material_index: number }[] = [];
    const textures: Texture[] = [];
    const textures_indices = new Map<string, number>();

    const meshes: Mesh[] = [];
    this.traverse(obj => {
      obj.updateMatrixWorld();
      if (obj instanceof Mesh) {
        meshes.push(obj);
      }
    });

    for (const mesh of meshes) {
      if (!mesh.geometry.getAttribute('normal')) {
        mesh.geometry.computeVertexNormals();
      }

      if (!mesh.geometry.getIndex()) {
        const position = mesh.geometry.getAttribute('position');
        mesh.geometry.setIndex(new BufferAttribute(new Uint16Array(position.count), 1));
        for (let i = 0; i < position.count; ++i) {
          mesh.geometry.getIndex()!.array[i] = i;
        }
      }

      if (!mesh.geometry.getAttribute('tangent') && mesh.geometry.getAttribute('uv')) {
        mesh.geometry.computeTangents();
      }

      const mesh_materials: Material[] = mesh.material instanceof Array ? mesh.material : [mesh.material];

      if (mesh_materials.length === 0) {
        mesh_materials.push(new Material());
      }

      mesh_materials.forEach(m => {
        if (m["map"]) {
          if (!textures_indices.has(m["map"].uuid)) {
            textures_indices.set(m["map"].uuid, textures.length);
            textures.push(m["map"]);
          }
          m.userData.albedo_index = textures_indices.get(m["map"].uuid)!;
        }
        else {
          m.userData.albedo_index = -1;
        }

        if (m["normalMap"]) {
          if (!textures_indices.has(m["normalMap"].uuid)) {
            textures_indices.set(m["normalMap"].uuid, textures.length);
            textures.push(m["normalMap"]);
          }
          m.userData.normal_index = textures_indices.get(m["normalMap"].uuid)!;
        }
        else {
          m.userData.normal_index = -1;
        }

        if (m["roughnessMap"]) {
          if (!textures_indices.has(m["roughnessMap"].uuid)) {
            textures_indices.set(m["roughnessMap"].uuid, textures.length);
            textures.push(m["roughnessMap"]);
          }
          m.userData.roughness_index = textures_indices.get(m["roughnessMap"].uuid)!;
        }
        else {
          m.userData.roughness_index = -1;
        }

        if (m["metalnessMap"]) {
          if (!textures_indices.has(m["metalnessMap"].uuid)) {
            textures_indices.set(m["metalnessMap"].uuid, textures.length);
            textures.push(m["metalnessMap"]);
          }
          m.userData.metalness_index = textures_indices.get(m["metalnessMap"].uuid)!;
        }
        else {
          m.userData.metalness_index = -1;
        }

        if (m["emissiveMap"]) {
          if (!textures_indices.has(m["emissiveMap"].uuid)) {
            textures_indices.set(m["emissiveMap"].uuid, textures.length);
            textures.push(m["emissiveMap"]);
          }
          m.userData.emission_index = textures_indices.get(m["emissiveMap"].uuid)!;
        }
        else {
          m.userData.emission_index = -1;
        }

        materials.push(m);
      });

      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const index = geometry.getIndex()!;
      const position = geometry.getAttribute('position');

      if (geometry.groups.length === 0) {
        geometry.addGroup(0, index.count, 0);
      }

      const group_offset = indices.length;

      for (let group = 0; group < geometry.groups.length; ++group) {
        const start = geometry.groups[group].start;
        const count = geometry.groups[group].count;
        
        const material_index = materials.length - geometry.groups.length + (geometry.groups[group].materialIndex || group);

        groups.push({ start: group_offset + start, count, material_index });

        for (let i = start; i < start + count; ++i) {
          const idx = index.getX(i);
          indices.push(new Vector4(
            idx + positions.length, 
            idx + uvs.length, 
            idx + normals.length, 
            idx + tangents.length)
          );
        }
      }

      for (let i = 0; i < position.count; ++i) {
        positions.push(new Vector3().fromBufferAttribute(position, i));
      }

      const normal = geometry.getAttribute('normal');

      for (let i = 0; i < normal.count; ++i) {
        normals.push(new Vector3().fromBufferAttribute(normal, i));
      }

      const uv = geometry.getAttribute('uv');

      if (uv) {
        for (let i = 0; i < uv.count; ++i) {
          uvs.push(new Vector2().fromBufferAttribute(uv as BufferAttribute, i));
        }
      }

      const tangent = geometry.getAttribute('tangent');

      if (tangent) {
        for (let i = 0; i < tangent.count; ++i) {
          tangents.push(new Vector3().fromBufferAttribute(tangent, i));  
        }
      }
    }

    this.num_triangles = indices.length / 3;

    return { positions, normals, uvs, tangents, indices, materials, groups, textures };
  }

  update_environment(gl: WebGL2RenderingContext, program: WebGLProgram) {
    if (!this.environment_needs_update) {
      return false;
    }

    gl.deleteTexture(this.environment_texture);

    this.environment_texture = gl.createTexture();
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_environment'), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.environment_texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.environment.image.width, this.environment.image.height, 0, gl.RGBA, gl.FLOAT, this.environment.image.data);
    const param = gl.getExtension('OES_texture_float_linear') ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    this.environment_needs_update = false;

    return true;
  }

  update_environment_intensity(gl: WebGL2RenderingContext, program: WebGLProgram) {
    if (!this.environment_intensity_needs_update) {
      return false;
    }

    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, 'u_environment_intensity'), this.environmentIntensity);
    this.environment_intensity_needs_update = false;
    return true;
  }
  
  update_meshes(gl: WebGL2RenderingContext, program: WebGLProgram) {
    if (!this.meshes_needs_update) {
      return false;
    }

    gl.deleteTexture(this.positions_texture);
    gl.deleteTexture(this.normals_texture);
    gl.deleteTexture(this.uvs_texture);
    gl.deleteTexture(this.tangents_texture);
    gl.deleteTexture(this.indices_texture);
    gl.deleteTexture(this.materials_texture);
    gl.deleteTexture(this.bvh_texture);
    gl.deleteTexture(this.textures_texture);

    const merged_meshes = this.merge_meshes();
    const bvh = new Bvh(merged_meshes.positions, merged_meshes.indices, merged_meshes.groups);
    
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "u_max_texture_size"), gl.MAX_TEXTURE_SIZE);
    gl.uniform1i(gl.getUniformLocation(program, "u_bvh_length"), bvh.list.length);

    function set_texture_data(texture: WebGLTexture, data: Float32Array, width: number, height: number, internal_format: number, format: number) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal_format, width, height, 0, format, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    // positions
    let width = Math.min(gl.MAX_TEXTURE_SIZE, merged_meshes.positions.length);
    let height = Math.ceil(merged_meshes.positions.length / width);
    let data = new Float32Array(width * height * 3);
    merged_meshes.positions.forEach((p, i) => data.set(p.toArray(), i * 3));
    this.positions_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_positions"), 2);
    gl.activeTexture(gl.TEXTURE2);
    set_texture_data(this.positions_texture, data, width, height, gl.RGB32F, gl.RGB);
    
    // normals
    width = Math.min(gl.MAX_TEXTURE_SIZE, merged_meshes.normals.length);
    height = Math.ceil(merged_meshes.normals.length / width);
    data = new Float32Array(width * height * 3);
    merged_meshes.normals.forEach((n, i) => data.set(n.toArray(), i * 3));
    this.normals_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_normals"), 3);
    gl.activeTexture(gl.TEXTURE3);
    set_texture_data(this.normals_texture, data, width, height, gl.RGB32F, gl.RGB);

    // uvs
    width = Math.min(gl.MAX_TEXTURE_SIZE, merged_meshes.uvs.length);
    height = Math.ceil(merged_meshes.uvs.length / width);
    data = new Float32Array(width * height * 2);
    merged_meshes.uvs.forEach((uv, i) => data.set(uv.toArray(), i * 2));
    this.uvs_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_uvs"), 4);
    gl.activeTexture(gl.TEXTURE4);
    set_texture_data(this.uvs_texture, data, width, height, gl.RG32F, gl.RG);

    // tangents
    width = Math.min(gl.MAX_TEXTURE_SIZE, merged_meshes.tangents.length);
    height = Math.ceil(merged_meshes.tangents.length / width);
    data = new Float32Array(width * height * 3);
    merged_meshes.tangents.forEach((t, i) => data.set(t.toArray(), i * 3));
    this.tangents_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_tangents"), 5);
    gl.activeTexture(gl.TEXTURE5);
    set_texture_data(this.tangents_texture, data, width, height, gl.RGB32F, gl.RGB);

    // indices
    width = Math.min(gl.MAX_TEXTURE_SIZE, merged_meshes.indices.length);
    height = Math.ceil(merged_meshes.indices.length / width);
    data = new Float32Array(width * height * 4);
    merged_meshes.indices.forEach((i, j) => data.set(i.toArray(), j * 4));
    this.indices_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_indices"), 6);
    gl.activeTexture(gl.TEXTURE6);
    set_texture_data(this.indices_texture, data, width, height, gl.RGBA32F, gl.RGBA);
    
    // materials
    width = Math.min(gl.MAX_TEXTURE_SIZE, merged_meshes.materials.length * 4);
    height = Math.ceil(merged_meshes.materials.length * 4 / width);
    data = new Float32Array(width * height * 4);
    merged_meshes.materials.forEach((m, i) => {
      const albedo = m["color"] || new Vector3(1, 1, 1);
      const ei = m["emissiveIntensity"] !== undefined ? m["emissiveIntensity"] : 1;
      const emissive = m["emissive"] || new Vector3(0, 0, 0);
      emissive.multiplyScalar(ei);
      const metalness = m["metalness"] !== undefined ? m["metalness"] : 0;
      const roughness = m["roughness"] !== undefined ? m["roughness"] : 1;
      const opacity = m.opacity >= 0.99 ? m["transmission"] !== undefined ? 1 - m["transmission"] : 1 : m.opacity;
      
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
        opacity,
        m['ior'] || 1,
        0
      ], i * 4 * 4)
    });
    this.materials_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_materials"), 7);
    gl.activeTexture(gl.TEXTURE7);
    set_texture_data(this.materials_texture, data, width, height, gl.RGBA32F, gl.RGBA);
    
    // bvh
    width = Math.min(gl.MAX_TEXTURE_SIZE, bvh.list.length * 2);
    height = Math.ceil(bvh.list.length * 2 / width);
    data = new Float32Array(width * height * 4);
    bvh.list.forEach((node, i) => {
      data.set([node.left_index, node.material_index, ...node.aabb.to_array()], i * 8);
    });
    this.bvh_texture = gl.createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "u_bvh"), 8);
    gl.activeTexture(gl.TEXTURE8);
    set_texture_data(this.bvh_texture, data, width, height, gl.RGBA32F, gl.RGBA);
    
    gl.uniform1i(gl.getUniformLocation(program, "u_textures"), 9);
    gl.activeTexture(gl.TEXTURE9);
    if (merged_meshes.textures.length > 0) {
      let max_width = 0;
      let max_height = 0;
      merged_meshes.textures.forEach(t => {
        max_width = Math.max(max_width, t.image.width);
        max_height = Math.max(max_height, t.image.height);
      });
      
      this.textures_texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textures_texture);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, max_width, max_height, merged_meshes.textures.length);
      merged_meshes.textures.forEach((t, i) => {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, max_width, max_height, 1, gl.RGBA, gl.UNSIGNED_BYTE, get_texture_data(t, max_width, max_height));
      });
    }
    else {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }

    this.meshes_needs_update = false;
    return true;
  }
};