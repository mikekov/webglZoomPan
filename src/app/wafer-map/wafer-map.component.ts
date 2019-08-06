import { Component, OnInit, ElementRef, Input, NgZone, OnDestroy, ViewEncapsulation } from '@angular/core';
import * as three from 'three';
import { MapControls } from '../map-controls';
import { Sphere, Material } from 'three';
// import {}

// colors
const WAFER = 0x000000;
const PERIMETER = 0x303030;
const DIE = 0x181818;
const DEFECTS = 0x20c0ff;
const BACKGND = 0x1e1e1e;
// size of defect in logical pixels
const DOT_SIZE = 3;

function createWaferShape(diameter: number): three.Group {
	const N = 200;
	const material = new three.MeshBasicMaterial({ color: WAFER });
	const mesh = new three.Mesh(new three.CircleBufferGeometry(diameter / 2, N), material);
	mesh.position.set(0, 0, -100);

	const m = new three.LineBasicMaterial({linewidth: 2.0, color: PERIMETER});
	const geometry = new three.CircleGeometry(diameter / 2, N);
	geometry.computeBoundingSphere();
	geometry.vertices.shift();
	const m2 = new three.LineLoop(geometry, m);
	m2.position.set(0, 0, -99);

	const group = new three.Group();
	group.add(mesh);
	group.add(m2);
	return group;
}

function generateDieMap(diameter: number, width: number, height: number, offset: [number, number], street: number): three.Group {
	const coords = [];
	const radius = diameter / 2;
	const lines = [];

	for (let y = -radius + offset[1]; y < radius; y += height) {
		for (let x = -radius + offset[0]; x < radius; x += width) {
			if (x * x + y * y > radius * radius) continue;
			if ((x + width) * (x + width) + y * y > radius * radius) continue;
			if (x * x + (y + height) * (y + height) > radius * radius) continue;
			if ((x + width) * (x + width) + (y + height) * (y + height) > radius * radius) continue;

			coords.push(x + street);
			coords.push(y + street);
			coords.push(0);
			coords.push(x + width - 2 * street);
			coords.push(y + street);
			coords.push(0);
			coords.push(x + width - 2 * street);
			coords.push(y + height - 2 * street);
			coords.push(0);

			coords.push(x + street);
			coords.push(y + street);
			coords.push(0);
			coords.push(x + width - 2 * street);
			coords.push(y + height - 2 * street);
			coords.push(0);
			coords.push(x + street);
			coords.push(y + height - 2 * street);
			coords.push(0);
		}
	}
	// const s = new three.Shape();
	const geometry = new three.BufferGeometry();
	geometry.addAttribute('position', new three.Float32BufferAttribute(coords, 3));
	const material = new three.MeshBasicMaterial({color: DIE});
	const mesh = new three.Mesh(geometry, material);
	const group = new three.Group();
	group.add(mesh);
	// group.add(m2);
	return group;
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
	}
//*
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
//*/

	return pos;
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

	constructor(el: ElementRef, private zone: NgZone) {
		this.el = el.nativeElement;
	}

	addDefects() {
		// return;
		const diameter = 300;
		if (this._defects) {
			this.scene.remove(this._defects);
			this._defects.geometry.dispose();
			(this._defects.material as Material).dispose();
			this._defects = null;
		}
		const def = generateDefects(diameter, this._defCount, this.offset);
		const geo = new three.BufferGeometry();
		geo.addAttribute('position', new three.Float32BufferAttribute(def, 2));
		geo.computeBoundingSphere = () => {
			if (geo.boundingSphere === null) { geo.boundingSphere = new Sphere(); }
			geo.boundingSphere.set(new three.Vector3(0, 0, 0), diameter / 2);
		};
		// try { geo.computeBoundingSphere(); } catch (e) {
			// console.log('fehler', e);
		// }
		// const material = new three.PointsMaterial({ size: 2.4, color: 0x20c0ff });
		this.defectMaterial = new three.ShaderMaterial({
			uniforms: {
				// time: { value: 1.0 },
				// resolution: { value: new three.Vector2() },
				pointSize: { value: DOT_SIZE * window.devicePixelRatio },
				defColor: {value: DEFECTS},
				bottomLeft: {value: new three.Vector2(-100, -100)},
				topRight: {value: new three.Vector2(100, 100)},
			},
			vertexShader: `
varying float zcolor;
uniform float pointSize;
uniform vec2 topRight;
uniform vec2 bottomLeft;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = pointSize;
	if (position.x >= bottomLeft.x && position.x <= topRight.x && position.y >= bottomLeft.y && position.y <= topRight.y) {
	// if (position.x >= bottomLeft.x && position.y >= bottomLeft.y) {
		zcolor = 1.0; // inside box
	}
	else {
		zcolor = 0.0; // outside box
	}
}`,
			fragmentShader: `
varying float zcolor;

void main() {
	if (zcolor > 0.0) {
		gl_FragColor = vec4(0.0, 0.6, 1.0, 1.0);
	}
	else {
		gl_FragColor = vec4(0.4, 0.4, 0.4, 1.0);
	}
}`
		});
		const points = new three.Points(geo, this.defectMaterial);
		this.scene.add(points);
		this._defects = points;
		this.render();
	}

	ngOnDestroy() {
		if (this._resize) {
			this._resize.unobserve(this.el);
		}
	}

	private get viewportSize(): {w: number, h: number} {
		const w = this.el.clientWidth;
		const h = this.el.clientHeight;
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
			// camera.left = -size.w / 4;
			// camera.right = size.w / 4;
			// camera.top = size.h / 4;
			// camera.bottom = -size.h / 4;
		}
		camera.updateProjectionMatrix();
	}

	ngOnInit() {
		this.scene = new three.Scene();
		this.scene.background = new three.Color(BACKGND);

		const circle = createWaferShape(300);
		circle.position.set(0, 0, -99);
		this.scene.add(circle);

		const dies = generateDieMap(300, 10, 12, this.offset, 0.1);
		dies.position.set(0, 0, -90);
		this.scene.add(dies);

/*
		const def = generateDefects(300, this._defCount, this.offset);
		const geo = new three.BufferGeometry();
		geo.addAttribute('position', new three.Float32BufferAttribute(def, 3));
		const material = new three.PointsMaterial({size: 2.4, color: 0x20e0ff});
		const points = new three.Points(geo, material);
		this.scene.add(points);
*/
		this.addDefects();

		this.camera = new three.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
		this.updateCameraSize();
		this.camera.position.set(0, 0, 99);

		this.renderer = new three.WebGLRenderer({antialias: false, alpha: false});
		this.renderer.setPixelRatio(window.devicePixelRatio);
		const vsize = this.viewportSize;
		this.renderer.setSize(vsize.w, vsize.h);
		this.el.appendChild(this.renderer.domElement);

		const controls = new MapControls(this.camera, this.renderer.domElement);
		controls.enableRotate = false;
		controls.minZoom = 0.1;
		controls.maxZoom = 1e8;
		controls.zoomSpeed = 4;
		controls.screenSpacePanning = true;
		controls.addEventListener('change', () => { this.render(); });
		controls.enableDamping = false;
		controls.enableSelect = true;
		controls.selecting = (finished: boolean) => { this.zone.run(() => {
			this._selectionWorldRect = controls.getSelectRect(true);
			if (finished) controls.clearSelectRect();
			this.render();
		}); };
		this.controls = controls;
		// console.log(this.camera['zoom']);

		if (ResizeObserver) {
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

	render() {
		if (this._selectionWorldRect) { // this.controls && this.controls.hasSelectRect() && this.defectMaterial) {
			const rect = this._selectionWorldRect; // this.controls.getSelectRect(true);
			this.defectMaterial.uniforms['topRight'].value = new three.Vector2(rect.right, rect.top);
			this.defectMaterial.uniforms['bottomLeft'].value = new three.Vector2(rect.left, rect.bottom);
		}
		if (this.renderer) this.renderer.render(this.scene, this.camera);
		if (this.camera) this._zoom = this.camera.zoom;
		if (this.renderer) console.log(this.renderer.info);
	}

	get selectRect(): ClientRect {
		return this.controls && this.controls.getSelectRect();
	}

	get selecting(): boolean {
		return this.controls && this.controls.enableSelect && this.controls.hasSelectRect();
	}

	controls: MapControls;
	private offset: [number, number] = [-5, 6];
	_circle: three.Mesh;
	camera: three.OrthographicCamera;
	scene: three.Scene;
	renderer: three.WebGLRenderer;
	el: HTMLElement;
	_defCount = 10;
	_defects: three.Points;
	defectMaterial: three.ShaderMaterial;
	_selectionWorldRect: ClientRect;
	// _selectRect: ClientRect = {width: 100, height: 40, top: 400, left: 500, bottom: 440, right: 600 };
	// _selecting = true;
	_resize: ResizeObserver;
	_zoom = 0;
}
