import { Vector3 } from "three";

export type RayData = {
  initial_position: Vector3,
  step_x: Vector3,
  step_y: Vector3
};

export class Camera {
  polar_angle: number;
  azimuthal_angle: number;
  radial_distance: number;
  aspect_ratio: number;
  look_at: Vector3;
  vfov: number;
  focus_distance: number;
  defocus_angle: number;

  // angle in degrees
  constructor(
    polar_angle: number, 
    azimuthal_angle: number, 
    radial_distance: number, 
    aspect_ratio: number,
    look_at: Vector3, 
    vfov: number, 
    focus_distance: number, 
    defocus_angle: number
  ) {
    this.polar_angle = polar_angle;
    this.azimuthal_angle = azimuthal_angle;
    this.radial_distance = radial_distance;
    this.aspect_ratio = aspect_ratio;
    this.look_at = look_at;
    this.vfov = vfov;
    this.focus_distance = focus_distance;
    this.defocus_angle = defocus_angle;
  }

  get position() : Vector3 {
    const polar_angle = this.polar_angle * Math.PI / 180;
    const azimuthal_angle = this.azimuthal_angle * Math.PI / 180;
    const x = this.radial_distance * Math.sin(polar_angle) * Math.sin(azimuthal_angle);
    const y = this.radial_distance * Math.cos(polar_angle);
    const z = this.radial_distance * Math.sin(polar_angle) * Math.cos(azimuthal_angle);
    return new Vector3(x, y, z).add(this.look_at);
  }

  get defocus_radius() : number {
    return this.focus_distance * Math.tan(0.5 * this.defocus_angle * Math.PI / 180);
  }

  get uvw() : [Vector3, Vector3, Vector3] {
    const w = this.position.clone().sub(this.look_at).normalize();
    const u = new Vector3(0, 1, 0).cross(w).normalize();
    const v = w.clone().cross(u);
    return [u, v, w];
  }

  get viewport() : { width: number, height: number } {
    const height = 2 * this.focus_distance * Math.tan(0.5 * this.vfov * Math.PI / 180);
    const width = this.aspect_ratio * height;
    return { width, height };
  }

  ray_data(width: number, height: number) : RayData {
    const [u, v, w] = this.uvw;
    const step_x = u.clone().multiplyScalar(this.viewport.width / width);
    const step_y = v.clone().multiplyScalar(this.viewport.height / height);
    const initial_position = this.position.clone()
      .sub(u.clone().multiplyScalar(0.5 * this.viewport.width))
      .sub(v.clone().multiplyScalar(0.5 * this.viewport.height))
      .sub(w.clone().multiplyScalar(this.focus_distance))
      .add(step_x.clone().multiplyScalar(0.5))
      .add(step_y.clone().multiplyScalar(0.5));

    return { initial_position, step_x, step_y };
  }
}