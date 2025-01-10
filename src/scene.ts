import { Material, Model } from "./model";

export class Scene {
  models: Model[] = [];
  gl: WebGL2RenderingContext;
  positions: WebGLTexture; 
  normals: WebGLTexture;
  uvs: WebGLTexture;
  materials: WebGLTexture;
  textures: WebGLTexture[] = [];
  num_triangles: number;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  add(model: Model) : void {
    this.models.push(model);
  }

  merge_models() : Model {
    const merged = new Model();

    for (const model of this.models) {
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
        merged.materials.push(new Material(merged.textures.length + m.texture_index))
      });
      merged.textures.push(...model.textures);
    }
    
    return merged;
  }
  
  update() {
    const merged = this.merge_models();

    this.num_triangles = merged.positions.length / 3;

    const positions_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.positions.length);
    const positions_height = Math.ceil(merged.positions.length / positions_width);

    this.positions = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positions);
    let data = new Float32Array(positions_width * positions_height * 3);
    merged.positions.forEach((p, i) => data.set(p.toArray(), i * 3));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB32F, positions_width, positions_height, 0, this.gl.RGB, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    
    this.normals = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.normals);
    data = new Float32Array(positions_width * positions_height * 3);
    merged.normals.forEach((n, i) => data.set(n.toArray(), i * 3));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB32F, positions_width, positions_height, 0, this.gl.RGB, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    this.uvs = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.uvs);
    data = new Float32Array(positions_width * positions_height * 2);
    merged.uvs.forEach((uv, i) => data.set(uv.toArray(), i * 2));
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RG32F, positions_width, positions_height, 0, this.gl.RG, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    const materials_width = Math.min(this.gl.MAX_TEXTURE_SIZE, merged.materials.length);
    const materials_height = Math.ceil(merged.materials.length / materials_width);

    this.materials = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.materials);
    data = new Float32Array(materials_width * materials_height);
    merged.materials.forEach((m, i) => data[i] = m.texture_index);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R32F, materials_width, materials_height, 0, this.gl.RED, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    this.textures = merged.textures.map(t => t.to_gl_texture(this.gl));
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

    this.textures.forEach((t, i) => {
      this.gl.uniform1i(this.gl.getUniformLocation(program, `u_textures[${i}]`), 5 + i)
      this.gl.activeTexture(this.gl.TEXTURE5 + i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    });

    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_num_triangles"), this.num_triangles);
    this.gl.uniform1i(this.gl.getUniformLocation(program, "u_max_texture_size"), this.gl.MAX_TEXTURE_SIZE);
  }
};