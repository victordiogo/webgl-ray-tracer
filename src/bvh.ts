import { Vector3 } from "three";
import { Model } from "./model";

class Interval {
  min: number;
  max: number;
};

class Aabb {
  axes: Interval[] = [new Interval(), new Interval(), new Interval()];

  constructor(a: Vector3, b: Vector3) {
    this.axes[0].min = Math.min(a.x, b.x);
    this.axes[0].max = Math.max(a.x, b.x);
    this.axes[1].min = Math.min(a.y, b.y);
    this.axes[1].max = Math.max(a.y, b.y);
    this.axes[2].min = Math.min(a.z, b.z);
    this.axes[2].max = Math.max(a.z, b.z);
    this.pad_to_minimuns();
  }

  to_array() {
    return [
      this.axes[0].min, this.axes[0].max,
      this.axes[1].min, this.axes[1].max,
      this.axes[2].min, this.axes[2].max
    ];
  }

  longest_axis() {
    const x = this.axes[0].max - this.axes[0].min;
    const y = this.axes[1].max - this.axes[1].min;
    const z = this.axes[2].max - this.axes[2].min;
    if (x > y && x > z) {
      return 0;
    }
    if (y > z) {
      return 1;
    }
    return 2;
  }

  pad_to_minimuns() {
    for (let i = 0; i < 3; ++i) {
      if (this.axes[i].max - this.axes[i].min < 1e-4) {
        this.axes[i].min -= 1e-4;
        this.axes[i].max += 1e-4;
      }
    }
  }

  static from_triangle(a: Vector3, b: Vector3, c: Vector3) {
    const min = new Vector3(
      Math.min(a.x, b.x, c.x),
      Math.min(a.y, b.y, c.y),
      Math.min(a.z, b.z, c.z)
    );
    const max = new Vector3(
      Math.max(a.x, b.x, c.x),
      Math.max(a.y, b.y, c.y),
      Math.max(a.z, b.z, c.z)
    );
    return new Aabb(min, max);
  }


  static merge(a: Aabb, b: Aabb) {
    return new Aabb(
      new Vector3(Math.min(a.axes[0].min, b.axes[0].min), Math.min(a.axes[1].min, b.axes[1].min), Math.min(a.axes[2].min, b.axes[2].min)),
      new Vector3(Math.max(a.axes[0].max, b.axes[0].max), Math.max(a.axes[1].max, b.axes[1].max), Math.max(a.axes[2].max, b.axes[2].max))
    );
  }
}

class BvhNode {
  left_index: number; // negative if leaf
  right_index: number;
  aabb: Aabb;

  constructor(left_index: number, right_index: number, aabb: Aabb) {
    this.left_index = left_index;
    this.right_index = right_index;
    this.aabb = aabb;
  }
};

type Triangles = { triangle_index: number, aabb: Aabb }[];

export class Bvh {
  list: BvhNode[] = [];

  constructor(model: Model) {
    const num_triangles = model.indices.length / 3;
    const triangles: Triangles = [];
    for (let i = 0; i < num_triangles; ++i) {
      const a = model.positions[model.indices[i * 3 + 0].x];
      const b = model.positions[model.indices[i * 3 + 1].x];
      const c = model.positions[model.indices[i * 3 + 2].x];
      triangles.push({ triangle_index: i, aabb: Aabb.from_triangle(a, b, c) });
    }
    const {left_index, right_index, aabb} = this.build(triangles);
    this.list.push(new BvhNode(left_index, right_index, aabb));
  }

  build(triangles: Triangles): { left_index: number, right_index: number, aabb: Aabb } {
    const span = triangles.length;
    
    if (span == 1) {
      const tri = triangles[0];
      const node = new BvhNode(-tri.triangle_index - 1, -tri.triangle_index - 1, tri.aabb);
      this.list.push(node); // left
      this.list.push(node); // right
      return {left_index: this.list.length - 2, right_index: this.list.length - 1, aabb: tri.aabb};
    }
    else if (span == 2) {
      const left_tri = triangles[0];
      const left = new BvhNode(-left_tri.triangle_index - 1, -left_tri.triangle_index - 1, left_tri.aabb);
      const right_tri = triangles[1];
      const right = new BvhNode(-right_tri.triangle_index - 1, -right_tri.triangle_index - 1, right_tri.aabb);
      this.list.push(left);
      this.list.push(right);
      return {left_index: this.list.length - 2, right_index: this.list.length - 1, aabb: Aabb.merge(left_tri.aabb, right_tri.aabb)};
    }

    let bounding_box = triangles[0].aabb;
    for (let i = 1; i < span; ++i) {
      bounding_box = Aabb.merge(bounding_box, triangles[i].aabb);
    }

    const axis = bounding_box.longest_axis();
    triangles.sort((a, b) => a.aabb.axes[axis].min - b.aabb.axes[axis].min);

    const mid = Math.ceil(span / 2);

    const left_data = this.build(triangles.slice(0, mid));
    const left = new BvhNode(left_data.left_index, left_data.right_index, left_data.aabb);
    this.list.push(left);
    const left_index = this.list.length - 1;

    const right_data = this.build(triangles.slice(mid));
    const right = new BvhNode(right_data.left_index, right_data.right_index, right_data.aabb);
    this.list.push(right);
    const right_index = this.list.length - 1;

    return { left_index, right_index, aabb: Aabb.merge(left_data.aabb, right_data.aabb)};
  }
};