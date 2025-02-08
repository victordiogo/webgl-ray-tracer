import { Bvh } from "./bvh";

import { Mesh } from "three";
import * as Three from "three";

import { Vector2, Vector3, BufferAttribute, Material, Texture } from "three";

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
  material_indices_texture: WebGLTexture | null = null;
  bvh_texture: WebGLTexture | null = null;
  textures_texture: WebGLTexture | null = null;

  constructor(environment: Texture) {
    super();
    this.environment = environment;
    this.environment_needs_update = true;
    this.environment_intensity_needs_update = true;
  }

  merge_meshes(max_texture_size: number) {
    let num_positions = 0;
    let num_normals = 0;
    let num_uvs = 0;
    let num_tangents = 0;
    let num_indices = 0;
    let num_materials = 0;
    
    const meshes: Mesh[] = [];
    this.traverse(obj => {
      obj.updateMatrixWorld();
      if (obj instanceof Mesh) {
        if (!obj.geometry.getAttribute('normal')) {
          obj.geometry.computeVertexNormals();
        }
        
        if (!obj.geometry.getIndex()) {
          const position = obj.geometry.getAttribute('position');
          obj.geometry.setIndex(new BufferAttribute(new Uint16Array(position.count), 1));
          for (let i = 0; i < position.count; ++i) {
            obj.geometry.getIndex()!.array[i] = i;
          }
        }
        
        if (!obj.geometry.getAttribute('tangent') && obj.geometry.getAttribute('uv')) {
          obj.geometry.computeTangents();
        }
        
        num_positions += obj.geometry.getAttribute('position').count;
        num_normals += obj.geometry.getAttribute('normal').count;
        num_uvs += obj.geometry.getAttribute('uv') ? obj.geometry.getAttribute('uv').count : 0;
        num_tangents += obj.geometry.getAttribute('tangent') ? obj.geometry.getAttribute('tangent').count : 0;
        num_indices += obj.geometry.getIndex()!.count;
        num_materials += obj.material instanceof Array ? obj.material.length : 1;
        
        meshes.push(obj);
      }
    });

    class TextureData {
      data: Float32Array;
      width: number;
      height: number;

      constructor(length: number, pixels_per_element: number, floats_per_pixel: number) {
        this.width = Math.min(max_texture_size, length * pixels_per_element);
        this.height = Math.ceil(length * pixels_per_element / this.width);
        this.data = new Float32Array(this.width * this.height * floats_per_pixel);
      }
    };

    const positions = new TextureData(num_positions, 1, 3);
    const normals = new TextureData(num_normals, 1, 3);
    const uvs = new TextureData(num_uvs, 1, 2);
    const tangents = new TextureData(num_tangents, 1, 3);
    const indices = new TextureData(num_indices, 1, 4);
    const materials = new TextureData(num_materials, 4, 4);
    const material_indices = new TextureData(num_indices / 3, 1, 1);
    const textures: Texture[] = [];
    const textures_indices = new Map<string, number>();

    let positions_offset = 0;
    let normals_offset = 0;
    let uvs_offset = 0;
    let tangents_offset = 0;
    let indices_offset = 0;
    let materials_offset = 0;
    let material_indices_offset = 0;

    for (const mesh of meshes) {
      const mesh_materials: Material[] = mesh.material instanceof Array ? mesh.material : [mesh.material];
      
      if (mesh_materials.length === 0) {
        mesh_materials.push(new Material());
      }

      mesh_materials.forEach(m => {
        let albedo_index = -1;
        let normal_index = -1;
        let roughness_index = -1;
        let metalness_index = -1;
        let emission_index = -1;

        if (m["map"]) {
          if (!textures_indices.has(m["map"].uuid)) {
            textures_indices.set(m["map"].uuid, textures.length);
            textures.push(m["map"]);
          }
          albedo_index = textures_indices.get(m["map"].uuid)!;
        }

        if (m["normalMap"]) {
          if (!textures_indices.has(m["normalMap"].uuid)) {
            textures_indices.set(m["normalMap"].uuid, textures.length);
            textures.push(m["normalMap"]);
          }
          normal_index = textures_indices.get(m["normalMap"].uuid)!;
        }

        if (m["roughnessMap"]) {
          if (!textures_indices.has(m["roughnessMap"].uuid)) {
            textures_indices.set(m["roughnessMap"].uuid, textures.length);
            textures.push(m["roughnessMap"]);
          }
          roughness_index = textures_indices.get(m["roughnessMap"].uuid)!;
        }

        if (m["metalnessMap"]) {
          if (!textures_indices.has(m["metalnessMap"].uuid)) {
            textures_indices.set(m["metalnessMap"].uuid, textures.length);
            textures.push(m["metalnessMap"]);
          }
          metalness_index = textures_indices.get(m["metalnessMap"].uuid)!;
        }

        if (m["emissiveMap"]) {
          if (!textures_indices.has(m["emissiveMap"].uuid)) {
            textures_indices.set(m["emissiveMap"].uuid, textures.length);
            textures.push(m["emissiveMap"]);
          }
          emission_index = textures_indices.get(m["emissiveMap"].uuid)!;
        }

        const albedo = m["color"] || new Vector3(1, 1, 1);
        const ei = m["emissiveIntensity"] !== undefined ? m["emissiveIntensity"] : 1;
        const emissive = m["emissive"] || new Vector3(0, 0, 0);
        emissive.multiplyScalar(ei);
        const metalness = m["metalness"] !== undefined ? m["metalness"] : 0;
        const roughness = m["roughness"] !== undefined ? m["roughness"] : 1;
        const opacity = m.opacity >= 0.99 ? m["transmission"] !== undefined ? 1 - m["transmission"] : 1 : m.opacity;

        materials.data.set([
          albedo_index, 
          roughness_index,
          metalness_index,
          normal_index,
          emission_index,
          ...albedo.toArray(), 
          ...emissive.toArray(), 
          metalness, 
          roughness, 
          opacity,
          m['ior'] || 1,
          0
        ], materials_offset);

        materials_offset += 16;
      });

      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const index = geometry.getIndex()!;
      const position = geometry.getAttribute('position');

      if (geometry.groups.length === 0) {
        geometry.addGroup(0, index.count, 0);
      }

      for (let group = 0; group < geometry.groups.length; ++group) {
        const start = geometry.groups[group].start;
        const count = geometry.groups[group].count;
        
        const material_index = (materials_offset / 16) - geometry.groups.length + (geometry.groups[group].materialIndex || group);

        for (let i = start; i < start + count; ++i) {
          if (i % 3 === 0) {
            material_indices.data[material_indices_offset++] = material_index;
          }

          const idx = index.getX(i);
          indices.data.set([
            idx + positions_offset / 3, 
            idx + uvs_offset / 2, 
            idx + normals_offset / 3, 
            idx + tangents_offset / 3,
          ], indices_offset);
          indices_offset += 4;
        }
      }

      for (let i = 0; i < position.count; ++i) {
        positions.data.set(new Vector3().fromBufferAttribute(position, i).toArray(), positions_offset);
        positions_offset += 3;
      }

      const normal = geometry.getAttribute('normal');

      for (let i = 0; i < normal.count; ++i) {
        normals.data.set(new Vector3().fromBufferAttribute(normal, i).toArray(), normals_offset);
        normals_offset += 3;
      }

      const uv = geometry.getAttribute('uv');

      if (uv) {
        for (let i = 0; i < uv.count; ++i) {
          uvs.data.set(new Vector2().fromBufferAttribute(uv as BufferAttribute, i).toArray(), uvs_offset);
          uvs_offset += 2;
        }
      }

      const tangent = geometry.getAttribute('tangent');

      if (tangent) {
        for (let i = 0; i < tangent.count; ++i) {
          tangents.data.set(new Vector3().fromBufferAttribute(tangent, i).toArray(), tangents_offset);
          tangents_offset += 3;  
        }
      }
    }

    this.num_triangles = num_indices / 3;

    return { positions, normals, uvs, tangents, indices, num_indices, materials, material_indices, textures };
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

    const { positions, uvs, normals, tangents, indices, num_indices, materials, material_indices, textures } = this.merge_meshes(gl.MAX_TEXTURE_SIZE);
    const bvh = new Bvh(positions.data, indices.data, num_indices);
    
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "u_max_texture_size"), gl.MAX_TEXTURE_SIZE);
    gl.uniform1i(gl.getUniformLocation(program, "u_bvh_length"), bvh.list.length);

    function create_texture(data: Float32Array, width: number, height: number, internal_format: number, format: number) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal_format, width, height, 0, format, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return texture;
    }

    // positions
    gl.uniform1i(gl.getUniformLocation(program, "u_positions"), 2);
    gl.activeTexture(gl.TEXTURE2);
    this.positions_texture = create_texture(positions.data, positions.width, positions.height, gl.RGB32F, gl.RGB);
    
    // normals
    gl.uniform1i(gl.getUniformLocation(program, "u_normals"), 3);
    gl.activeTexture(gl.TEXTURE3);
    this.normals_texture = create_texture(normals.data, normals.width, normals.height, gl.RGB32F, gl.RGB);
    
    // uvs
    gl.uniform1i(gl.getUniformLocation(program, "u_uvs"), 4);
    gl.activeTexture(gl.TEXTURE4);
    this.uvs_texture = create_texture(uvs.data, uvs.width, uvs.height, gl.RG32F, gl.RG);
    
    // tangents
    gl.uniform1i(gl.getUniformLocation(program, "u_tangents"), 5);
    gl.activeTexture(gl.TEXTURE5);
    this.tangents_texture = create_texture(tangents.data, tangents.width, tangents.height, gl.RGB32F, gl.RGB);
    
    // indices
    gl.uniform1i(gl.getUniformLocation(program, "u_indices"), 6);
    gl.activeTexture(gl.TEXTURE6);
    this.indices_texture = create_texture(indices.data, indices.width, indices.height, gl.RGBA32F, gl.RGBA);
    
    // materials
    gl.uniform1i(gl.getUniformLocation(program, "u_materials"), 7);
    gl.activeTexture(gl.TEXTURE7);
    this.materials_texture = create_texture(materials.data, materials.width, materials.height, gl.RGBA32F, gl.RGBA);

    // material indices
    gl.uniform1i(gl.getUniformLocation(program, "u_material_indices"), 10);
    gl.activeTexture(gl.TEXTURE10);
    this.material_indices_texture = create_texture(material_indices.data, material_indices.width, material_indices.height, gl.R32F, gl.RED);
 
    // bvh
    const width = Math.min(gl.MAX_TEXTURE_SIZE, bvh.list.length * 2);
    const height = Math.ceil(bvh.list.length * 2 / width);
    const data = new Float32Array(width * height * 4);
    bvh.list.forEach((node, i) => data.set([node.left_index, node.parent_index, ...node.aabb.to_array()], i * 8));
    gl.uniform1i(gl.getUniformLocation(program, "u_bvh"), 8);
    gl.activeTexture(gl.TEXTURE8);
    this.bvh_texture = create_texture(data, width, height, gl.RGBA32F, gl.RGBA);
    
    gl.uniform1i(gl.getUniformLocation(program, "u_textures"), 9);
    gl.activeTexture(gl.TEXTURE9);
    if (textures.length > 0) {
      let max_width = 0;
      let max_height = 0;
      textures.forEach(t => {
        max_width = Math.max(max_width, t.image.width);
        max_height = Math.max(max_height, t.image.height);
      });
      
      this.textures_texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textures_texture);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, max_width, max_height, textures.length);
      textures.forEach((t, i) => {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, max_width, max_height, 1, gl.RGBA, gl.UNSIGNED_BYTE, get_texture_data(t, max_width, max_height));
      });
    }
    else {
      this.textures_texture = null;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }

    this.meshes_needs_update = false;
    return true;
  }
};