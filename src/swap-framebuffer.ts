export class SwapFramebuffer {
  first: boolean = true;
  framebuffers: WebGLFramebuffer[];
  textures: WebGLTexture[];
  gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, width: number, height: number, texture_32f: boolean) {
    this.textures = [this.create_texture(gl, width, height, texture_32f), this.create_texture(gl, width, height, texture_32f)];
    this.framebuffers = [this.create_framebuffer(gl, this.textures[0]), this.create_framebuffer(gl, this.textures[1])];
    this.gl = gl;
  }
  
  get screen_texture() {
    return this.textures[this.first ? 0 : 1];
  }

  get offscreen_texture() {
    return this.textures[this.first ? 1 : 0];
  }

  swap() {
    this.first = !this.first;
  }

  use() {
    if (this.first) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[0]);
    } 
    else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[1]);
    }
  }

  destroy() {
    this.gl.deleteFramebuffer(this.framebuffers[0]);
    this.gl.deleteFramebuffer(this.framebuffers[1]);
    this.gl.deleteTexture(this.textures[0]);
    this.gl.deleteTexture(this.textures[1]);
  }  

  create_texture(gl: WebGL2RenderingContext, width: number, height: number, texture_32f: boolean): WebGLTexture {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const format = texture_32f ? gl.RGBA32F : gl.RGBA16F;
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  create_framebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture) : WebGLFramebuffer {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer is incomplete');
    }
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  
    return framebuffer;
  }
};