import * as three from 'three';
import { RectangleShape, createRectangles } from './wafer-map/create-rectangles';
import { interpolate_or_clip, turbo_colormap_data } from './color-palettes';

// colors
export const WAFER = new three.Color(0x000000);
export const PERIMETER = new three.Color(0x404040);
export const DIE = new three.Color(0x181818);
export const HATCH = new three.Color(0x404142);
// const DEFECTS_NORMAL = new three.Color(0xf0f0f0);
export const DEFECTS_ACTIVE = new three.Color(0x65ffff);
export const DEFECTS_INACTIVE = new three.Color(0x656565);
export const BACKGND = 0x1e1e1e;
export const RED = new three.Color(0xff0000);
export const GREEN = new three.Color(0x00ff40);

export function generateDieMap(diameter: number, width: number, height: number, offset: [number, number], street: number): three.Group {
	const radius = diameter / 2;
	const w = width - 2 * street;
	const h = height - 2 * street;
	const dies: RectangleShape[] = [];
	const rotation = new three.Matrix3();
	rotation.rotate(-Math.PI / 4);

	let i = 0;
	for (let y = -radius + offset[1]; y < radius; y += height) {
		for (let x = -radius + offset[0]; x < radius; x += width) {
			if (x * x + y * y > radius * radius) continue;
			if ((x + width) * (x + width) + y * y > radius * radius) continue;
			if (x * x + (y + height) * (y + height) > radius * radius) continue;
			if ((x + width) * (x + width) + (y + height) * (y + height) > radius * radius) continue;

			const v = new three.Vector2(x, y);
			const r = v.applyMatrix3(rotation);
			const grad = (1 + r.x / radius) / 2;
			// const color = interpolateColor(measurements_colormap_data, grad);
			const color = interpolate_or_clip(turbo_colormap_data, grad);
			const off = i++ % 2 !== 0;
			dies.push({
				x: x + street,
				y: y + street,
				width: w,
				height: h,
				fill: off ? DIE : new three.Color(color[0], color[1], color[2]),
				line: WAFER,
				crosshatch: off,
				hatch: HATCH
			});
		}
	}
	return createRectangles(dies);
}

export function generateDefects(diameter: number, count: number, offset): number[] {
	const pos = [];
	if (!count) return pos;

	const radius = diameter / 2;
	const point = () => {
		let r = Math.random();
		r = 1 - r * r;
		r *= radius;
		const a = Math.random() * Math.PI * 2;
		return [Math.sin(a) * r, Math.cos(a) * r];
	};

	for (let i = 0; i < count; ++i) {
		let p;
		do {
			p = point();
		} while ((radius + offset[0] + p[0]) % 10 < 1.5 || (radius + offset[1] + p[1]) % 12 < 1.5 || p[0]*p[0]+p[1]*p[1]>(radius-2)*(radius-2));
		pos.push(p[0] - 1.0);
		pos.push(p[1] - 0.5);
		// pos.push(-1 + i / count);
		// simulate attribute
		if (i % 1234 === 0) {
			pos.push(1);
		}
		else {
			pos.push(i % 123 === 0 ? 2 : 0);
		}
	}
/*
// defects at nm distances
pos.push(0);
pos.push(0);
pos.push(0);
pos.push(0.001);
pos.push(0.002);
pos.push(0);
pos.push(-0.0001);
pos.push(-0.0002);
pos.push(0);
pos.push(0.00001);
pos.push(-0.00002);
pos.push(0);
pos.push(-0.000001);
pos.push(0.000002);
pos.push(0);
*/

	return pos;
}
