import { Material, Model } from "./model";

import { Vector2, Vector3 } from "three";
import { Texture } from "./texture";

export class Scene {
  positions: Vector3[] = [];
  normals: Vector3[] = [];
  uvs: Vector2[] = [];
  materials: Material[] = [];
  textures: Texture[] = [];
  
  gl: WebGL2RenderingContext;
  uniforms: {
    positions: WebGLTexture; 
    normals: WebGLTexture;
    uvs: WebGLTexture;
    materials: WebGLTexture;
    textures: WebGLTexture[];
    positions_width: number;
    materials_width: number; 
  };

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  add(model: Model) {
    this.positions.push(...model.positions);
    this.normals.push(...model.normals);
    this.uvs.push(...model.uvs);
    const materials = model.materials.map(m => new Material(this.textures.length + m.texture_index));
    this.materials.push(...materials);
    this.textures.push(...model.textures);
  }

  update() {
    if (this.uniforms) {
      this.gl.deleteTexture(this.uniforms.positions);
      this.gl.deleteTexture(this.uniforms.normals);
      this.gl.deleteTexture(this.uniforms.uvs);
      this.gl.deleteTexture(this.uniforms.materials);
      this.uniforms.textures.forEach(t => this.gl.deleteTexture(t));
    }

    const positions_width = Math.min(this.gl.MAX_TEXTURE_SIZE, this.positions.length);
    let positions_height = Math.ceil(this.positions.length / positions_width);
    const positions = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, positions);
    let data = new Float32Array(positions_width * positions_height * 3);
    this.positions.map(p => p.toArray()).flat().forEach((v, i) => data[i] = v);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB32F, positions_width, positions_height, 0, this.gl.RGB, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    
    const normals = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, normals);
    data = new Float32Array(positions_width * positions_height * 3);
    this.normals.map(n => n.toArray()).flat().forEach((v, i) => data[i] = v);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB32F, positions_width, positions_height, 0, this.gl.RGB, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    const uvs = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, uvs);
    data = new Float32Array(positions_width * positions_height * 2);
    this.uvs.map(uv => uv.toArray()).flat().forEach((v, i) => data[i] = v);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RG32F, positions_width, positions_height, 0, this.gl.RG, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    const materials_width = Math.min(this.gl.MAX_TEXTURE_SIZE, this.materials.length);
    let materials_height = Math.ceil(this.materials.length / materials_width);
    const materials = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, materials);
    data = new Float32Array(materials_width * materials_height);
    this.materials.forEach((m, i) => data[i] = m.texture_index);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R32F, materials_width, materials_height, 0, this.gl.RED, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    const textures = this.textures.map(t => t.create_texture(this.gl));

    this.uniforms = {
      positions,
      normals,
      uvs,
      materials,
      textures,
      positions_width,
      materials_width
    };
  }

  set_uniforms(program: WebGLProgram) {
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_positions"), 1);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uniforms.positions);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_normals"), 2);
    this.gl.activeTexture(this.gl.TEXTURE2);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uniforms.normals);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_uvs"), 3);
    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uniforms.uvs);

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_materials"), 4);
    this.gl.activeTexture(this.gl.TEXTURE4);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uniforms.materials);

    this.uniforms.textures.forEach((t, i) => {
      this.gl.uniform1i(this.gl.getUniformLocation(program, `u_textures[${i}]`), 5 + i)
      this.gl.activeTexture(this.gl.TEXTURE5 + i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    });

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_positions_width"), this.uniforms.positions_width);
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_materials_width"), this.uniforms.materials_width);
  }

};