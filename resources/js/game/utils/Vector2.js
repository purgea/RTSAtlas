export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static from(obj)       { return new Vector2(obj.x, obj.y); }
  static zero()          { return new Vector2(0, 0); }
  static one()           { return new Vector2(1, 1); }
  static up()            { return new Vector2(0, -1); }
  static down()          { return new Vector2(0,  1); }
  static left()          { return new Vector2(-1, 0); }
  static right()         { return new Vector2( 1, 0); }

  add(v)       { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v)       { return new Vector2(this.x - v.x, this.y - v.y); }
  scale(s)     { return new Vector2(this.x * s,   this.y * s); }
  mul(v)       { return new Vector2(this.x * v.x, this.y * v.y); }
  div(s)       { return new Vector2(this.x / s,   this.y / s); }
  neg()        { return new Vector2(-this.x, -this.y); }

  dot(v)       { return this.x * v.x + this.y * v.y; }
  cross(v)     { return this.x * v.y - this.y * v.x; }

  lengthSq()   { return this.x * this.x + this.y * this.y; }
  length()     { return Math.sqrt(this.lengthSq()); }
  normalize()  { const l = this.length(); return l > 0 ? this.scale(1 / l) : Vector2.zero(); }

  distanceSqTo(v) { return this.sub(v).lengthSq(); }
  distanceTo(v)   { return Math.sqrt(this.distanceSqTo(v)); }

  lerp(v, t)   { return new Vector2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
  floor()      { return new Vector2(Math.floor(this.x), Math.floor(this.y)); }
  ceil()       { return new Vector2(Math.ceil(this.x),  Math.ceil(this.y)); }
  round()      { return new Vector2(Math.round(this.x), Math.round(this.y)); }
  abs()        { return new Vector2(Math.abs(this.x),   Math.abs(this.y)); }
  clamp(min, max) {
    return new Vector2(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y)),
    );
  }

  angle()      { return Math.atan2(this.y, this.x); }
  angleTo(v)   { return Math.atan2(v.y - this.y, v.x - this.x); }

  clone()  { return new Vector2(this.x, this.y); }
  equals(v){ return this.x === v.x && this.y === v.y; }
  toArray(){ return [this.x, this.y]; }
  toObj()  { return { x: this.x, y: this.y }; }
  toString(){ return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`; }

  // Mutating variants for hot paths
  addMut(v)    { this.x += v.x; this.y += v.y; return this; }
  subMut(v)    { this.x -= v.x; this.y -= v.y; return this; }
  scaleMut(s)  { this.x *= s;   this.y *= s;   return this; }
  setMut(x, y) { this.x = x;   this.y = y;    return this; }

  static fromAngle(angle, length = 1) {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  static manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  static chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
}
