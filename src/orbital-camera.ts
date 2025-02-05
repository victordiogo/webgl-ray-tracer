import { PerspectiveCamera, Vector3 } from "three";

export class OrbitalCamera extends PerspectiveCamera{
  needs_update: boolean;
  polar_angle: number;
  azimuthal_angle: number;
  radial_distance: number;
  render_width: number;
  render_height: number;
  look_at: Vector3;
  focus_distance: number;
  defocus_angle: number;

  // angle in degrees
  constructor(
    polar_angle: number, 
    azimuthal_angle: number, 
    radial_distance: number, 
    render_width: number,
    render_height: number,
    look_at: Vector3, 
    vfov: number, 
    focus_distance: number, 
    defocus_angle: number
  ) {
    super(vfov, render_width / render_height, 0.1, 1000);
    this.needs_update = true;
    this.polar_angle = polar_angle;
    this.azimuthal_angle = azimuthal_angle;
    this.radial_distance = radial_distance;
    this.render_width = render_width;
    this.render_height = render_height;
    this.look_at = look_at;
    this.focus_distance = focus_distance;
    this.defocus_angle = defocus_angle;
  }

  update_position() {
    const polar_angle = this.polar_angle * Math.PI / 180;
    const azimuthal_angle = this.azimuthal_angle * Math.PI / 180;
    const x = this.radial_distance * Math.sin(polar_angle) * Math.sin(azimuthal_angle);
    const y = this.radial_distance * Math.cos(polar_angle);
    const z = this.radial_distance * Math.sin(polar_angle) * Math.cos(azimuthal_angle);
    this.position.copy(new Vector3(x, y, z).add(this.look_at));
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
  
  get aspect_ratio() : number {
    return this.render_width / this.render_height;
  }
  
  get_viewport() : { width: number, height: number } {
    const height = 2 * this.focus_distance * Math.tan(0.5 * this.fov * Math.PI / 180);
    const width = this.aspect_ratio * height;
    return { width, height };
  }
  
  update(gl: WebGL2RenderingContext, program: WebGLProgram) {
    if (!this.needs_update) {
      return false;
    }

    this.update_position();
    this.lookAt(this.look_at);
    const [u, v] = this.uvw;
    gl.useProgram(program);
    gl.uniform3fv(gl.getUniformLocation(program, 'u_right'), u.toArray());
    gl.uniform3fv(gl.getUniformLocation(program, 'u_up'), v.toArray());
    gl.uniform1f(gl.getUniformLocation(program, 'u_defocus_radius'), this.defocus_radius);
    gl.uniform3fv(gl.getUniformLocation(program, 'u_initial_position'), this.initial_ray_data.position.toArray());
    gl.uniform3fv(gl.getUniformLocation(program, 'u_step_x'), this.initial_ray_data.step_x.toArray());
    gl.uniform3fv(gl.getUniformLocation(program, 'u_step_y'), this.initial_ray_data.step_y.toArray());
    gl.uniform3fv(gl.getUniformLocation(program, 'u_look_from'), this.position.toArray());
    this.needs_update = false;
    return true;
  }

  get initial_ray_data() : { position: Vector3, step_x: Vector3, step_y: Vector3 } {
    const [u, v, w] = this.uvw;
    const viewport = this.get_viewport();
    const step_x = u.clone().multiplyScalar(viewport.width / this.render_width);
    const step_y = v.clone().multiplyScalar(viewport.height / this.render_height);
    const position = this.position.clone()
      .sub(u.clone().multiplyScalar(0.5 * viewport.width))
      .sub(v.clone().multiplyScalar(0.5 * viewport.height))
      .sub(w.clone().multiplyScalar(this.focus_distance))
      .add(step_x.clone().multiplyScalar(0.5))
      .add(step_y.clone().multiplyScalar(0.5));

    return { position, step_x, step_y };
  }
}