import { Vector3 } from "three";
import { load_text_file } from "./load-text-file";

class Vertex {
  constructor() {
    
  }
};

class Mesh {
  constructor() {
    
  }
};

class Model {
  constructor() {
    
  }
};

export async function import_obj(obj_path: string) : Promise<Model> {
  const file = await load_text_file(obj_path);
  const positions: Vector3[] = [];
  const normals: Vector3[] = [];
  const uvs: Vector3[] = [];
  

  return new Model();
}

class ModelTextures {
  positions: WebGLTexture;
  normals: WebGLTexture;
  uvs: WebGLTexture;
  width: number;

  constructor(positions: WebGLTexture, normals: WebGLTexture, uvs: WebGLTexture, width: number) {
    this.positions = positions;
    this.normals = normals;
    this.uvs = uvs;
    this.width = width;
  }
};

function model_to_textures(gl: WebGL2RenderingContext, model: Triangle[]) : ModelTextures {
  let width = Math.min(gl.MAX_TEXTURE_SIZE, model.length * 3);
  let height = Math.ceil(model.length * 3 / width);

  const positions = new Float32Array(width * height * 3);
  const normals = new Float32Array(width * height * 3);
  const uvs = new Float32Array(width * height * 2);

  for (let i = 0; i < model.length; ++i) {
    const triangle = model[i];
    positions.set(triangle.a.position.toArray(), i * 9);
    positions.set(triangle.b.position.toArray(), i * 9 + 3);
    positions.set(triangle.c.position.toArray(), i * 9 + 6);
    normals.set(triangle.a.normal.toArray(), i * 9);
    normals.set(triangle.b.normal.toArray(), i * 9 + 3);
    normals.set(triangle.c.normal.toArray(), i * 9 + 6);
    uvs.set(triangle.a.uv.toArray(), i * 6);
    uvs.set(triangle.b.uv.toArray(), i * 6 + 2);
    uvs.set(triangle.c.uv.toArray(), i * 6 + 4);
  }

  const positions_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, positions_texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, width, height, 0, gl.RGB, gl.FLOAT, positions);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  const normals_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, normals_texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, width, height, 0, gl.RGB, gl.FLOAT, normals);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  const uvs_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, uvs_texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, uvs);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  return new ModelTextures(
    positions_texture,
    normals_texture,
    uvs_texture,
    width
  );
}