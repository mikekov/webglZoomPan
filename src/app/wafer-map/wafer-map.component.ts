import { Component, OnInit, ElementRef, Input, NgZone, OnDestroy, ViewEncapsulation } from '@angular/core';
import * as three from 'three';
import { MapControls } from '../map-controls';
import { Sphere, Material } from 'three';

// colors
const WAFER = 0x000000;
const PERIMETER = 0x404040;
const DIE = 0x181818;
const DEFECTS_NORMAL = new three.Color(0xf0f0f0);
const DEFECTS_ACTIVE = new three.Color(0x65ffff);
const DEFECTS_INACTIVE = new three.Color(0x656565);
const BACKGND = 0x1e1e1e;
const RED = new three.Color(0xff0000);
const GREEN = new three.Color(0x00ff40);
// size of defect in logical pixels
// const DOT_SIZE = 3;

// create 3D object in plane z=0 representing wafer
// diameter - in mm
// notchSize - hight in mm
// notchAngle - in degrees; 0 - down, 90 ? TODO
function createWaferShape(diameter: number, notchSize: number, notchAngle: number): three.Group {
	const vertices: number[] = [];
	vertices.push(0, 0, 0);
	let segments = 200;
	const thetaStart = notchSize / diameter;
	const thetaLength = 2 * (Math.PI - thetaStart);
	const vertex = new three.Vector3(0, 0, 0);
	const radius = diameter / 2;
	const nx = radius - notchSize / 2.1;
	const ny = notchSize / 6;
	vertices.push(nx, ny, vertex.z);
	for (let i = 0; i <= segments; ++i) {
		const segment = thetaStart + i / segments * thetaLength;

		vertex.x = radius * Math.cos(segment);
		vertex.y = radius * Math.sin(segment);

		vertices.push(vertex.x, vertex.y, vertex.z);
	}
	vertices.push(nx, -ny, vertex.z);
	vertices.push(radius - notchSize / 2, 0, vertex.z);

	segments = vertices.length / 3 - 1;
	const indices: number[] = [];
	for (let i = 1; i < segments; ++i) {
		indices.push(i, i + 1, 0);
	}
	indices.push(segments, 1, 0);

	const geo = new three.BufferGeometry();
	geo.setIndex(indices);
	geo.addAttribute('position', new three.Float32BufferAttribute(vertices, 3));

	const material = new three.MeshBasicMaterial({color: WAFER});
	const wafer = new three.Mesh(geo, material);
	wafer.position.set(0, 0, 0);

	const m = new three.LineBasicMaterial({linewidth: 2.0, color: PERIMETER});
	const outline = new three.BufferGeometry();
	// remove center point
	for (let i = 0; i < 3; ++i) {	vertices.shift(); }
	outline.addAttribute('position', new three.Float32BufferAttribute(vertices, 3));
	const perimeter = new three.LineLoop(outline, m);
	perimeter.position.set(0, 0, 1);

	const pointer = new three.Shape();
	const d = 3; // 3 mm
	pointer.moveTo(0, 0);
	pointer.lineTo(d, d);
	pointer.lineTo(d, d / 2);
	pointer.lineTo(d / 2, 0);
	pointer.lineTo(d, -d / 2);
	pointer.lineTo(d, -d);
	pointer.closePath();
	const notchPointer = new three.Mesh(new three.ShapeBufferGeometry(pointer), new three.MeshBasicMaterial({color: PERIMETER}));
	notchPointer.position.set(radius + 0.5, 0, 1);

	const group = new three.Group();
	group.add(wafer);
	group.add(perimeter);
	group.add(notchPointer);

	group.rotateZ((notchAngle - 90) / 180 * Math.PI);

	return group;
}

function generateDieMap(diameter: number, width: number, height: number, offset: [number, number], street: number): three.Group {
	const coords = [];
	const radius = diameter / 2;
	// const lines = [];

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
		const geo = new three.BufferGeometry();
		geo.addAttribute('position', new three.Float32BufferAttribute(def, 3));
		geo.computeBoundingSphere = () => {
			if (geo.boundingSphere === null) { geo.boundingSphere = new Sphere(); }
			geo.boundingSphere.set(new three.Vector3(0, 0, 0), diameter / 2);
		};

		// defect attribute is used as index to this color palette
		const colorPalette = {type: 'v4v', value: [
			new three.Vector4(DEFECTS_INACTIVE.r, DEFECTS_INACTIVE.g, DEFECTS_INACTIVE.b, 1),
			new three.Vector4(RED.r, RED.g, RED.b, 1),
			new three.Vector4(GREEN.r, GREEN.g, GREEN.b, 1),
			new three.Vector4(0, 0, 0, 1), // catch all black
		]};

		this.defectMaterial = new three.ShaderMaterial({
			transparent: true,
			blending: three.AdditiveBlending,
			depthWrite: false,
			uniforms: {
				pointSize: { value: this.dotSize * window.devicePixelRatio },
				pointAlpha: { value: this.enableAlphaBlending ? 0.5 : 1.0 },
				selectionTest: {value: false},
				bottomLeft: {value: new three.Vector2(-100, -100)},
				topRight: {value: new three.Vector2(100, 100)},
				normalColor: {value: new three.Vector4(DEFECTS_NORMAL.r, DEFECTS_NORMAL.g, DEFECTS_NORMAL.b, 1)},
				activeColor: {value: new three.Vector4(DEFECTS_ACTIVE.r, DEFECTS_ACTIVE.g, DEFECTS_ACTIVE.b, 1)},
				inactiveColor: {value: new three.Vector4(DEFECTS_INACTIVE.r, DEFECTS_INACTIVE.g, DEFECTS_INACTIVE.b, 1)},
				palette: colorPalette
			},
			vertexShader: `
varying float zcolor;
varying vec4 icolor;
uniform float pointSize;
uniform vec2 topRight;
uniform vec2 bottomLeft;
uniform bool selectionTest;
uniform vec4 palette[${colorPalette.value.length}];

void main() {
	// position x/y is 2D location, wheras z is an attribute; passing z to gl_Position to bring some defects forward
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, position.z / 10000.0, 1.0);
	gl_PointSize = position.z > 0.0 ? 1.5 * pointSize : pointSize;
	// zcolor = 0.0;
	if (selectionTest) {
		// bounding selection box test:
		if (position.x >= bottomLeft.x && position.x <= topRight.x && position.y >= bottomLeft.y && position.y <= topRight.y) {
			zcolor = 1.0; // inside box
		}
		else {
			zcolor = 0.0; // outside box
		}
	}
	// z contains defect's attribute
	float attrib = clamp(position.z, 0.0, ${colorPalette.value.length}.0);
	icolor = palette[int(attrib)];
}`,
			fragmentShader: `
varying float zcolor;
varying vec4 icolor;
uniform float pointAlpha;
uniform vec4 activeColor;
uniform vec4 inactiveColor;
uniform vec4 normalColor;
uniform bool selectionTest;

void main() {
	// discard;
	if (selectionTest) {
		if (zcolor > 0.0) {
			gl_FragColor = activeColor * pointAlpha;
		}
		else {
			gl_FragColor = inactiveColor * pointAlpha;
		}
	}
	else {
		gl_FragColor = icolor * pointAlpha;
	}
}`
		});
		// this.defectMaterial.depthWrite = false;
		this.updateAlpha();
		const points = new three.Points(geo, this.defectMaterial);
		points.position.set(0, 0, 900);
		this.scene.add(points);
		this._defects = points;
		// if (this.renderer) this.renderer.clear();
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
		}
		camera.updateProjectionMatrix();
	}

	ngOnInit() {
		this.scene = new three.Scene();
		this.scene.background = new three.Color(BACKGND);

		const circle = createWaferShape(300, 3, 0);
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
		controls.minZoom = 0.1;
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
		this.controls = controls;

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
			this.defectMaterial.uniforms['pointAlpha'].value = this.enableAlphaBlending ? 0.5 : 1.0;
			this.defectMaterial.transparent = this.enableAlphaBlending;
			this.defectMaterial.blending = this.enableAlphaBlending ? three.AdditiveBlending : three.NormalBlending;
			this.defectMaterial.depthWrite = this.enableAlphaBlending ? false : true;
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
	_resize: ResizeObserver;
	_zoom = 0;
	dotSize = 3;
	enableAlphaBlending = false;
	_worldRect: Rectangle | undefined;
}
