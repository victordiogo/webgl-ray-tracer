import { Bvh } from "./bvh";
import { TextureData } from "./texture-data";

import { Mesh, Vector2, Vector3, BufferAttribute, Material, Texture } from "three";
import * as Three from "three";

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
  texture_params_texture: WebGLTexture | null = null;
  textures_texture: WebGLTexture | null = null;

  constructor(environment: Texture) {
    super();
    this.environment = environment;
    this.environment_needs_update = true;
    this.environment_intensity_needs_update = true;
  }

  merge_meshes(max_texture_size: number) {
    let num_attributes = 0;
    let num_uvs = 0;
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

        if (!obj.geometry.getAttribute('uv')) {
          const position = obj.geometry.getAttribute('position');
          obj.geometry.setAttribute('uv', new BufferAttribute(new Float32Array(position.count * 2), 2));
        }
        
        if (!obj.geometry.getAttribute('tangent')) {
          obj.geometry.computeTangents();
        }

        if (obj.material instanceof Array && obj.material.length == 0) {
          obj.material.push(new Material());
        }
        
        num_attributes += obj.geometry.getAttribute('position').count;
        num_uvs += obj.geometry.getAttribute('uv').count;
        num_indices += obj.geometry.getIndex()!.count;
        num_materials += obj.material instanceof Array ? obj.material.length : 1;
        
        meshes.push(obj);
      }
    });

    console.log(num_uvs, num_attributes)

    const positions = new TextureData(num_attributes, 1, 3, max_texture_size);
    const normals = new TextureData(num_attributes, 1, 3, max_texture_size);
    const uvs = new TextureData(num_attributes, 1, 2, max_texture_size);
    const tangents = new TextureData(num_attributes, 1, 3, max_texture_size);
    const indices = new TextureData(num_indices, 1, 1, max_texture_size);
    const materials = new TextureData(num_materials, 5, 4, max_texture_size);
    const material_indices = new TextureData(num_indices / 3, 1, 1, max_texture_size);
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

      mesh_materials.forEach(m => {
        let albedo_index = -1;
        let normal_index = -1;
        let roughness_index = -1;
        let metalness_index = -1;
        let emission_index = -1;
        let opacity_index = -1;
        let transmission_index = -1;

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

        if (m["alphaMap"]) {
          if (!textures_indices.has(m["alphaMap"].uuid)) {
            textures_indices.set(m["alphaMap"].uuid, textures.length);
            textures.push(m["alphaMap"]);
          }
          opacity_index = textures_indices.get(m["alphaMap"].uuid)!;
        }

        if (m["transmissionMap"]) {
          if (!textures_indices.has(m["transmissionMap"].uuid)) {
            textures_indices.set(m["transmissionMap"].uuid, textures.length);
            textures.push(m["transmissionMap"]);
          }
          transmission_index = textures_indices.get(m["transmissionMap"].uuid)!;
        }

        const albedo = m["color"] || new Vector3(1, 1, 1);
        const ei = m["emissiveIntensity"] !== undefined ? m["emissiveIntensity"] : 1;
        const emissive = m["emissive"] || new Vector3(0, 0, 0);
        emissive.multiplyScalar(ei);
        const metalness = m["metalness"] !== undefined ? m["metalness"] : 0;
        const roughness = m["roughness"] !== undefined ? m["roughness"] : 1;
        const transmission = m["transmission"] !== undefined ? m["transmission"] : 0;

        materials.data.set([
          albedo_index, 
          roughness_index,
          metalness_index,
          normal_index,
          emission_index,
          opacity_index,
          transmission_index,
          m.opacity,
          ...albedo.toArray(), 
          transmission,
          ...emissive.toArray(), 
          m['ior'] || 1,
          roughness, 
          metalness, 
          0, 0
        ], materials_offset);

        materials_offset += 20;
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
        
        const material_index = (materials_offset / 20) - geometry.groups.length + (geometry.groups[group].materialIndex || group);

        for (let i = start; i < start + count; ++i) {
          if (i % 3 === 0) {
            material_indices.data[material_indices_offset++] = material_index;
          }

          const idx = index.getX(i);
          indices.data.set([idx + positions_offset / 3], indices_offset);
          ++indices_offset;
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

      for (let i = 0; i < uv.count; ++i) {
        uvs.data.set(new Vector2().fromBufferAttribute(uv as BufferAttribute, i).toArray(), uvs_offset);
        uvs_offset += 2;
      }

      const tangent = geometry.getAttribute('tangent');

      for (let i = 0; i < tangent.count; ++i) {
        tangents.data.set(new Vector3().fromBufferAttribute(tangent, i).toArray(), tangents_offset);
        tangents_offset += 3;  
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
    gl.deleteTexture(this.material_indices_texture);
    gl.deleteTexture(this.bvh_texture);
    gl.deleteTexture(this.texture_params_texture);
    gl.deleteTexture(this.textures_texture);

    const { positions, uvs, normals, tangents, indices, num_indices, materials, material_indices, textures } = this.merge_meshes(gl.MAX_TEXTURE_SIZE);
    const bvh = new Bvh(positions.data, indices.data, num_indices);
    
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "u_max_texture_size"), gl.MAX_TEXTURE_SIZE);
    gl.uniform1i(gl.getUniformLocation(program, "u_bvh_length"), bvh.list.length);

    // positions
    gl.uniform1i(gl.getUniformLocation(program, "u_positions"), 2);
    gl.activeTexture(gl.TEXTURE2);
    this.positions_texture = positions.create_texture(gl);
    
    // normals
    gl.uniform1i(gl.getUniformLocation(program, "u_normals"), 3);
    gl.activeTexture(gl.TEXTURE3);
    this.normals_texture = normals.create_texture(gl);
    
    // uvs
    gl.uniform1i(gl.getUniformLocation(program, "u_uvs"), 4);
    gl.activeTexture(gl.TEXTURE4);
    this.uvs_texture = uvs.create_texture(gl);
    
    // tangents
    gl.uniform1i(gl.getUniformLocation(program, "u_tangents"), 5);
    gl.activeTexture(gl.TEXTURE5);
    this.tangents_texture = tangents.create_texture(gl);
    
    // indices
    gl.uniform1i(gl.getUniformLocation(program, "u_indices"), 6);
    gl.activeTexture(gl.TEXTURE6);
    this.indices_texture = indices.create_texture(gl);
    
    // materials
    gl.uniform1i(gl.getUniformLocation(program, "u_materials"), 7);
    gl.activeTexture(gl.TEXTURE7);
    this.materials_texture = materials.create_texture(gl);

    // material indices
    gl.uniform1i(gl.getUniformLocation(program, "u_material_indices"), 10);
    gl.activeTexture(gl.TEXTURE10);
    this.material_indices_texture = material_indices.create_texture(gl);
 
    // bvh
    const bvh_data = new TextureData(bvh.list.length, 2, 4, gl.MAX_TEXTURE_SIZE);
    bvh.list.forEach((node, i) => bvh_data.data.set([node.left_index, node.parent_index, ...node.aabb.to_array()], i * 8));
    gl.uniform1i(gl.getUniformLocation(program, "u_bvh"), 8);
    gl.activeTexture(gl.TEXTURE8);
    this.bvh_texture = bvh_data.create_texture(gl);
    
    // texture params
    const texture_params = new TextureData(textures.length, 2, 4, gl.MAX_TEXTURE_SIZE);

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
        texture_params.data.set([
          t.image.width / max_width, t.image.height / max_height, 
          t.flipY ? 1 : 0, 
          t.rotation,
          t.repeat.x, t.repeat.y,
          t.offset.x, t.offset.y,
        ], i * 8);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, t.image.width, t.image.height, 1, gl.RGBA, gl.UNSIGNED_BYTE, t.image);
      });
    }
    else {
      this.textures_texture = null;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }

    gl.uniform1i(gl.getUniformLocation(program, "u_texture_params"), 11);
    gl.activeTexture(gl.TEXTURE11);
    this.texture_params_texture = texture_params.create_texture(gl);

    this.meshes_needs_update = false;
    return true;
  }
};