export class Texture {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  index: number;

  constructor(width: number, height: number, data: Uint8ClampedArray, index: number = 0) {
    this.width = width;
    this.height = height;
    this.data = data;
    this.index = index;
  }

  static async from_image(path: string) : Promise<Texture> {
    const image = new Image();
    image.src = path;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error("Failed to get canvas 2d context");
    }
    // flip image vertically
    context.translate(0, image.height);
    context.scale(1, -1);
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    return new Texture(image.width, image.height, data);
  }

  to_gl_texture(gl: WebGL2RenderingContext) : WebGLTexture {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }
};