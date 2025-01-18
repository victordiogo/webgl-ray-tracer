export class Texture {
  image: HTMLImageElement;

  constructor(image: HTMLImageElement) {
    this.image = image;
  }

  data(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2d context');
    }
    // flip image vertically
    context.translate(0, height);
    context.scale(1, -1);
    context.drawImage(this.image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  }

  static async from_file(path: string) : Promise<Texture> {
    const image = new Image();
    image.src = path;
    await image.decode();
    return new Texture(image);
  }
};