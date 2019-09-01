import { Component, OnInit, ElementRef, Input, NgZone, OnDestroy, ViewEncapsulation, ViewChild } from '@angular/core';
import * as three from 'three';
import { MapControls } from '../map-controls';
import { Material, Vector3 } from 'three';
import { RectangleShape, createRectangles } from './create-rectangles';
import { createWaferShape } from './create-wafer-shape';
import { createPoints } from './create-points';
import { turbo_colormap_data, interpolate_or_clip, interpolateColor, measurements_colormap_data } from '../color-palettes';

// colors
const WAFER = new three.Color(0x000000);
const PERIMETER = new three.Color(0x404040);
const DIE = new three.Color(0x181818);
const HATCH = new three.Color(0x404142);
// const DEFECTS_NORMAL = new three.Color(0xf0f0f0);
const DEFECTS_ACTIVE = new three.Color(0x65ffff);
const DEFECTS_INACTIVE = new three.Color(0x656565);
const BACKGND = 0x1e1e1e;
const RED = new three.Color(0xff0000);
const GREEN = new three.Color(0x00ff40);

function generateDieMap(diameter: number, width: number, height: number, offset: [number, number], street: number): three.Group {
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
				crosshatch: off,
				hatch: HATCH
			});
		}
	}
	return createRectangles(dies);
}

function generateDefects(diameter: number, count: number, offset): number[] {
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

export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

@Component({
	selector: 'mk-wafer-map',
	templateUrl: './wafer-map.component.html',
	styleUrls: ['./wafer-map.component.scss'],
	encapsulation: ViewEncapsulation.None
})
export class WaferMapComponent implements OnInit, OnDestroy {
	@Input()
	set defectCount(n: number) {
		if (this._defCount !== n) {
			this._defCount = n;
			if (this.scene) {
				this.addDefects();
			}
		}
	}

	@Input()
	set pointSize(s: number) {
		this.dotSize = s;
		this.render();
	}

	@Input()
	set alphaBlending(enable: boolean) {
		this.enableAlphaBlending = enable;
		this.render();
	}

	@Input()
	set worldCanvas(rect: Rectangle) {
		this._worldRect = rect;
	}

	constructor(el: ElementRef, private zone: NgZone) {
		this.el = el.nativeElement;
	}

	addDefects() {
		const diameter = 300;
		if (this._defects) {
			this.scene.remove(this._defects);
			this._defects.geometry.dispose();
			(this._defects.material as Material).dispose();
			this._defects = null;
		}
		const def = generateDefects(diameter, this._defCount, this.offset);
		// defect attribute is used as index to this color palette
		const colorPalette = [DEFECTS_INACTIVE, RED, GREEN];
		const p = createPoints(def, colorPalette, DEFECTS_ACTIVE, this.dotSize, diameter / 2);

		this.defectMaterial = p.material;
		p.points.position.set(0, 0, 900);
		this.scene.add(p.points);
		this._defects = p.points;
		this.render();
	}

	ngOnDestroy() {
		if (this._resize) {
			this._resize.unobserve(this.el);
		}
		// dispose of resources
		[this.renderer, this.scene, this.defectMaterial, this.controls]
			.filter(obj => obj && obj.dispose)
			.forEach(obj => obj.dispose());
	}

	@ViewChild('canvasArea', undefined) _canvasArea: ElementRef;
	private get viewportSize(): {w: number, h: number} {
		if (!this._canvasArea) return {w: 0, h: 0};
		const w = this._canvasArea.nativeElement.clientWidth;
		const h = this._canvasArea.nativeElement.clientHeight;
		return {w, h};
	}

	private updateCameraSize() {
		const size = this.viewportSize;
		const camera = this.camera;
		const workArea = this.scene && this.scene.children && this.scene.children[0];
		let w = 0, h = 0;
		if (workArea) {
			const bbox = new three.Box3().setFromObject(workArea);
			w = bbox.max.x - bbox.min.x;
			h = bbox.max.y - bbox.min.y;
		}
		if (w <= 0 || h <= 0 || size.w <= 0 || size.h <= 0) {
			camera.left = 0;
			camera.right = 0;
			camera.top = 0;
			camera.bottom = 0;
		}
		else {
			const sw = size.w / w;
			const sh = size.h / h;

			if (sh >= sw) {
				camera.left = -w / 2;
				camera.right = w / 2;
				camera.top = (h / 2) * sh / sw;
				camera.bottom = -(h / 2) * sh / sw;
			}
			else {
				camera.left = (-w / 2) * sw / sh;
				camera.right = (w / 2) * sw / sh;
				camera.top = h / 2;
				camera.bottom = -h / 2;
			}
		}
		camera.updateProjectionMatrix();
	}

	ngOnInit() {
		this.scene = new three.Scene();
		this.scene.background = new three.Color(BACKGND);

		const circle = createWaferShape(300, 3, 0, WAFER, PERIMETER);
		circle.position.set(0, 0, 100);
		this.scene.add(circle);

		const dies = generateDieMap(300, 10, 12, this.offset, 0.1);
		dies.position.set(0, 0, 110);
		this.scene.add(dies);

		this.addDefects();

		this.camera = new three.OrthographicCamera(0, 0, 0, 0, 0, 1000);
		this.updateCameraSize();
		this.camera.position.set(0, 0, 999);
		// this.camera.lookAt(0, 0, 0);

		this.renderer = new three.WebGLRenderer({antialias: false, alpha: true});
		this.renderer.setPixelRatio(window.devicePixelRatio);
		const vsize = this.viewportSize;
		this.renderer.setSize(vsize.w, vsize.h);
		this.el.appendChild(this.renderer.domElement);

		const controls = new MapControls(this.camera, this.renderer.domElement);
		controls.enableRotate = false;
		controls.minZoom = 1;
		controls.maxZoom = 1e8;
		controls.zoomSpeed = 4;
		controls.screenSpacePanning = true;
		controls.keyPanSpeed = 10 * window.devicePixelRatio;
		controls.addEventListener('change', () => { this.render(); });
		controls.enableDamping = false;
		controls.enableSelect = true;
		controls.selecting = (finished: boolean) => { this.zone.run(() => {
			this._selectionWorldRect = controls.getSelectRect(true);
			if (finished) {
				const rect = controls.getSelectRect();
				controls.zoomToRect(rect.left, rect.right, rect.top, rect.bottom);
				controls.clearSelectRect();
			}
			this.render();
		}); };
		controls.limitOffset = (target: three.Vector3) => this.limitOffset(target);
		this.controls = controls;

		if (window['ResizeObserver']) {
			this._resize = new ResizeObserver((e) => { this.zone.run(() => {
				// console.log('resize', e[0].contentRect, this.el.clientWidth, this.el.clientHeight);
				if (this.renderer) {
					this.updateCameraSize();
					const size = this.viewportSize;
					this.renderer.setSize(size.w, size.h, true);
					this.render();
				}
			}); });
			this._resize.observe(this.el);
		}
		this.render();
	}

	private limitOffset(target: three.Vector3) {
		const camera = this.camera;
		if (!camera) return;

		const area = this.workArea;
		const x = target.x;
		const y = target.y;
		const z = camera.zoom;

		const aw = area.right - area.left;
		const r = camera.right / z;
		const l = camera.left / z;
		const vw = r - l;
		let dx = x;
		if (vw < aw) {
			if (l + x < area.left) {
				dx += area.left - (l + x);
			}
			else if (r + x > area.right) {
				dx -= r + x - area.right;
			}
		}
		else {
			dx = 0;
		}

		const ah = area.top - area.bottom;
		const t = camera.top / z;
		const b = camera.bottom / z;
		const vh = t - b;
		let dy = y;
		if (vh < ah) {
			if (b + y < area.bottom) {
				dy += area.bottom - (b + y);
			}
			else if (t + y > area.top) {
				dy -= t + y - area.top;
			}
		}
		else {
			dy = 0;
		}

		if (dx !== x || dy !== y) {
			target.x = dx;
			target.y = dy;
			target.z = 0;
			camera.position.x = dx;
			camera.position.y = dy;
		}
	}

	updateAlpha() {
		if (this.defectMaterial) {
			const rect = this._selectionWorldRect;
			const selection = rect && rect.width > 0 && rect.height > 0;
			this.defectMaterial.uniforms['selectionTest'].value = selection ? true : false;
			if (selection) {
				this.defectMaterial.uniforms['topRight'].value = new three.Vector2(rect.right, rect.top);
				this.defectMaterial.uniforms['bottomLeft'].value = new three.Vector2(rect.left, rect.bottom);
			}
			this.defectMaterial.uniforms['pointSize'].value = this.dotSize * window.devicePixelRatio;
			// this.defectMaterial.uniforms['pointAlpha'].value = this.enableAlphaBlending ? 0.5 : 1.0;
			// this.defectMaterial.transparent = this.enableAlphaBlending;
			// this.defectMaterial.blending = this.enableAlphaBlending ? three.AdditiveBlending : three.NormalBlending;
			// this.defectMaterial.depthWrite = this.enableAlphaBlending ? false : true;
		}
	}

	render() {
		this.updateAlpha();
		// if (this.defectMaterial) {
		// 	const rect = this._selectionWorldRect;
		// 	if (rect) {
		// 		this.defectMaterial.uniforms['topRight'].value = new three.Vector2(rect.right, rect.top);
		// 		this.defectMaterial.uniforms['bottomLeft'].value = new three.Vector2(rect.left, rect.bottom);
		// 	}
		// 	this.defectMaterial.uniforms['pointSize'].value = this.dotSize * window.devicePixelRatio;
		// 	this.defectMaterial.uniforms['pointAlpha'].value = this.enableAlphaBlending ? 0.5 : 1.0;
		// }
		if (this.renderer) {
			// this.renderer.
			this.renderer.render(this.scene, this.camera);
		}
		if (this.camera) this._zoom = this.camera.zoom;
		// if (this.renderer) console.log(this.renderer.info);
	}

	get selectRect(): ClientRect {
		return this.controls && this.controls.getSelectRect();
	}

	get selecting(): boolean {
		return this.controls && this.controls.enableSelect && this.controls.hasSelectRect();
	}

	getViewportArea() {
		const camera = this.camera;
		if (!camera) return {width: 0, height: 0};
		return {
			width: (camera.right - camera.left) / camera.zoom,
			height: (camera.top - camera.bottom) / camera.zoom
		};
	}

	getViewportPosition() {
		const camera = this.camera;
		if (!camera) return {x: 0, y: 0};
		// const m = camera.matrixWorld.elements;
		const pos = camera.position;
		return {
			x: (camera.left + camera.right) / 2 + pos.x, // m[12],
			y: (camera.top + camera.bottom) / 2 + pos.y // m[13]
		};
	}

	get workArea(): {left: number, right: number, top: number, bottom: number} {
		const w = this._worldRect;
		return w && {left: w.x, right: w.x + w.width, bottom: w.y, top: w.y + w.height} || {left: 0, right: 0, top: 0, bottom: 0};
	}

	scrollTo(xy: string, pos: number) {
		if (!this.camera) return;

		const vp = this.getViewportPosition();

		switch (xy) {
			case 'x':
				this.controls.panWorldCoord(pos - vp.x, 0);
				break;
			case 'y':
				this.controls.panWorldCoord(0, pos - vp.y);
				break;
		}
		this.controls.update();
	}

	controls: MapControls;
	private offset: [number, number] = [-5, 6];
	camera: three.OrthographicCamera;
	scene: three.Scene;
	renderer: three.WebGLRenderer;
	el: HTMLElement;
	_defCount = 10;
	_defects: three.Points;
	defectMaterial: three.ShaderMaterial;
	_selectionWorldRect: ClientRect;
	_resize: ResizeObserver;
	_zoom = 0;
	dotSize = 3;
	enableAlphaBlending = false;
	_worldRect: Rectangle | undefined;
}
