import { Component, OnInit, ViewEncapsulation, Input, ElementRef, NgZone, ViewChild, Output, EventEmitter } from '@angular/core';
import * as THREE from 'three';
import ResizeObserver from 'resize-observer-polyfill';
import { MapControls } from '../map-controls';
import { clearScene } from '../utils/remove-object';

// 2D viewer using webGL
// supports zooming and panning

export interface ViewerOptions {
	minZoom?: number;
	maxZoom?: number;
	zoomSpeed?: number;
	background?: THREE.Color;
	cameraZPosition?: number;
}

export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

@Component({
	selector: 'mk-two-d-viewer',
	templateUrl: './two-d-viewer.component.html',
	styleUrls: ['./two-d-viewer.component.scss'],
	encapsulation: ViewEncapsulation.None
})
export class TwoDViewerComponent implements OnInit {

	// dimensions of the working area in world coordinates; unitless
	// Y axis points up
	@Input()
	set workAreaRect(rect: Rectangle) {
		this._worldRect = rect;
	}

	// options to customize viewer
	@Input() options: ViewerOptions | undefined;

	// list of objects to show in a viewer
	@Input()
	set objects(o: THREE.Object3D[]) {
		this.setObjects(o);
	}

	// what action should mouse left-click drag perform
	@Input()
	set tool(tool: Tool) {
		this.setTool(tool);
	}

	// current zoom level, where 1 means that workAreaRect fits the viewport
	@Output() zoom = new EventEmitter<number>();

	// selection rectangle in world coordinates fires after user lasso-selects
	@Output() selectionRectangle = new EventEmitter<Rectangle>();

	constructor(el: ElementRef, private zone: NgZone) {
		this._el = el.nativeElement;
	}

	// call this function before rendering scene
	public preRender: Function;

	// rebuild scene if _objects array items change
	public refresh() {
		this.syncScene(this._objects);
	}

	ngOnDestroy() {
		if (this._resize) {
			this._resize.unobserve(this._el);
		}
		clearScene(this._scene, true);
		// dispose of resources
		[this._renderer, this._scene, /*this.defectMaterial,*/ this._controls]
			.filter(obj => obj && obj.dispose)
			.forEach(obj => obj.dispose());
	}

	// size of canvas in pixels
	@ViewChild('canvasArea', undefined) _canvasArea: ElementRef;
	private get viewportSize(): { w: number, h: number } {
		if (!this._canvasArea) return { w: 0, h: 0 };
		const w = this._canvasArea.nativeElement.clientWidth;
		const h = this._canvasArea.nativeElement.clientHeight;
		return { w, h };
	}

	// set camera size in world coordinates matching aspect ratio of canvas element
	private updateCameraSize() {
		const size = this.viewportSize;
		const camera = this._camera;
		let l = 0, r = 0, b = 0, t = 0;
		if (this._worldRect) {
			const rect = this._worldRect;
			l = rect.x;
			r = l + rect.width;
			b = rect.y;
			t = b + rect.height;
		}
		else {
			const workArea = this._scene && this._scene.children && this._scene.children[0];
			if (workArea) {
				const bbox = new THREE.Box3().setFromObject(workArea);
				l = bbox.min.x;
				r = bbox.max.x;
				b = bbox.min.y;
				t = bbox.max.y;
			}
		}
		const w = r - l;
		const h = t - b;

		if (w <= 0 || h <= 0 || size.w <= 0 || size.h <= 0) {
			camera.left = 0;
			camera.right = 0;
			camera.top = 0;
			camera.bottom = 0;
		}
		else {
			const sw = size.w / w;
			const sh = size.h / h;
			const ex = sw > sh ? w * (sw / sh - 1) / 2 : 0;
			const ey = sw < sh ? h * (sh / sw - 1) / 2 : 0;

			camera.left = l - ex;
			camera.right = r + ex;
			camera.bottom = b - ey;
			camera.top = t + ey;
		}
		camera.updateProjectionMatrix();
	}

	ngOnInit() {
		const opt = this.options || {};
		this._scene.background = new THREE.Color(opt.background || 0x000000);

		this._camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0, 1000);
		this._camera.position.set(0, 0, opt.cameraZPosition || 999);

		this._renderer = new THREE.WebGLRenderer({antialias: false, alpha: false});
		this._renderer.setPixelRatio(window.devicePixelRatio);

		const resize = () => {
			this.updateCameraSize();
			const size = this.viewportSize;
			this._renderer.setSize(size.w, size.h, true);
			this.render();
		};
		resize();

		this._el.appendChild(this._renderer.domElement);

		const controls = new MapControls(this._camera, this._renderer.domElement);
		controls.enableRotate = false;
		controls.minZoom = opt.minZoom || 1;
		controls.maxZoom = opt.maxZoom || 1e8;
		controls.zoomSpeed = opt.zoomSpeed || 4;
		controls.screenSpacePanning = true;
		controls.keyPanSpeed = 10 * window.devicePixelRatio;
		controls.addEventListener('change', () => { this.render(); });
		controls.enableDamping = false;
		controls.enableSelect = true;
		controls.selecting = (finished: boolean) => {
			if (this._tool === 'none') return;

			this.zone.run(() => {
				this._selectionWorldRect = controls.getSelectRect(true);
				if (finished) {
					const rect = controls.getSelectRect();
					this.selectionRectangle.next({x: rect.left, y: rect.bottom, width: rect.width, height: rect.height});
					if (this._tool === 'zoom') {
						controls.zoomToRect(rect.left, rect.right, rect.top, rect.bottom);
					}
					controls.clearSelectRect();
				}
				this.render();
			});
		};
		controls.limitOffset = (target: THREE.Vector3) => this.limitOffset(target);
		this._controls = controls;
		this.updateCurrentTool(this._tool);

		this._resize = new ResizeObserver(e => {
			this.zone.run(() => { resize(); });
		});
		this._resize.observe(this._el);

		this.render();
	}

	private setObjects(objects: THREE.Object3D[]) {
		this._objects = objects;
		if (!objects) return;

		const scene = this._scene;
		let same = true;
		if (objects.length === scene.children.length) {
			for (let i = 0; objects.length; ++i) {
				const a = objects[i];
				const b = scene.children[i];
				if (a !== b) {
					same = false;
					break;
				}
			}
		}
		else {
			same = false;
		}

		if (same) return;

		this.syncScene(objects);
	}

	private syncScene(objects: THREE.Object3D[]) {
		const scene = this._scene;
		// remove objects, do not dispose
		clearScene(scene, false);

		if (objects) objects.forEach(ob => scene.add(ob));

		this.render();
	}

	// limit camera panning to work area
	private limitOffset(target: THREE.Vector3) {
		const camera = this._camera;
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

	render() {
		if (this._renderer) {
			if (this.preRender) {
				this.preRender(this);
			}
			this._renderer.render(this._scene, this._camera);
		}
		if (this._camera) {
			if (this._zoom !== this._camera.zoom) {
				this._zoom = this._camera.zoom;
				this.zoom.next(this._zoom);
			}
		}
		// if (this.renderer) console.log(this.renderer.info);
	}

	get selectRect(): ClientRect {
		return this._controls && this._controls.getSelectRect();
	}

	get selecting(): boolean {
		return this._controls && this._controls.enableSelect && this._controls.hasSelectRect();
	}

	// viewport size in world coordinates
	getViewportArea() {
		const camera = this._camera;
		if (!camera) return { width: 0, height: 0 };
		return {
			width: (camera.right - camera.left) / camera.zoom,
			height: (camera.top - camera.bottom) / camera.zoom
		};
	}

	// viewport position in world coordinates
	getViewportPosition() {
		const camera = this._camera;
		if (!camera) return { x: 0, y: 0 };
		// const m = camera.matrixWorld.elements;
		const pos = camera.position;
		return {
			x: (camera.left + camera.right) / 2 + pos.x, // m[12],
			y: (camera.top + camera.bottom) / 2 + pos.y // m[13]
		};
	}

	get workArea(): { left: number, right: number, top: number, bottom: number } {
		const w = this._worldRect;
		return w && { left: w.x, right: w.x + w.width, bottom: w.y, top: w.y + w.height } || { left: 0, right: 0, top: 0, bottom: 0 };
	}

	scrollTo(xy: string, pos: number) {
		if (!this._camera) return;

		const vp = this.getViewportPosition();

		switch (xy) {
			case 'x':
				this._controls.panWorldCoord(pos - vp.x, 0);
				break;
			case 'y':
				this._controls.panWorldCoord(0, pos - vp.y);
				break;
		}
		this._controls.update();
	}

	private setTool(tool: Tool) {
		if (this._tool === tool) return;

		this._tool = tool;
		this.updateCurrentTool(tool);
	}

	private updateCurrentTool(tool: Tool) {
		const c = this._controls;
		if (c) {
			c.enableSelect = tool !== 'none';
		}
	}

	_controls: MapControls;
	_camera: THREE.OrthographicCamera;
	_scene = new THREE.Scene();
	_objects: THREE.Object3D[];
	_renderer: THREE.WebGLRenderer;
	_el: HTMLElement;
	_selectionWorldRect: ClientRect;
	_resize: ResizeObserver;
	_zoom = 0;
	_worldRect: Rectangle | undefined;
	_tool: Tool = 'zoom';
}

type Tool = 'none' | 'zoom' | 'select';
