import { Component, OnInit, Input, OnDestroy, ViewEncapsulation, ViewChild, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { createWaferShape } from '../utils/create-wafer-shape';
import { createPoints } from '../utils/create-points';
import { Rectangle, TwoDViewerComponent, ViewerOptions } from '../two-d-viewer/two-d-viewer.component';
import { disposeObject3D, disposeObjects } from '../utils/remove-object';
import { createRectangles, RectangleShape } from '../utils/create-rectangles';

// wafer geometry - all coordinates are world coordinates (uniform units, unit choice up to client)

// die information used to describe die map
export interface Die {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: THREE.Color;
	hatch?: THREE.Color;
}

export interface DieMap {
	// all visible dies, in no particular order
	map: Die[];
	// if given, die map will be clipped to a circle of (wafer.diameter - 2 * clippingEdge) in size
	// this is partial die support
	clippingEdge?: number;
}

// point event (like defect) consists of three numbers: x, y, attribute
// where x, y are wafer coordiantes, and attribute is used to apply color
export type Points = number[];

export interface PointOptions {
	// point size in logical pixels - each point is presented as a square of this size
	pointSize: number;
	// colors for points; point attribute value is used as an index to the color palette
	colorPalette: THREE.Color[];
	// color of selected points
	selectedColor: THREE.Color;
}

// wafer geometry and styles
export interface WaferOptions {
	// wafer diameter length in world coordinates
	diameter: number;
	// notch position in degries
	orientationAngle: number;
	// color of the wafer
	fill: THREE.Color;
	// color of the wafer outline and notch
	perimeter: THREE.Color;
	// background color
	background: THREE.Color;
	// max zoom factor: how far can wafer be magnified
	maxZoom?: number;
}

@Component({
	selector: 'mk-wafer-map',
	templateUrl: './wafer-map.component.html',
	styleUrls: ['./wafer-map.component.scss'],
	encapsulation: ViewEncapsulation.None
})
export class WaferMapComponent implements OnInit, OnDestroy, AfterViewInit {

	@Input()
	set worldCanvas(rect: Rectangle) {
		this._worldRect = rect;
	}

	@Input()
	set wafer(wafer: WaferOptions) {
		this.setWafer(wafer);
	}

	@Input()
	set dieMap(map: DieMap | null) {
		this.setDieMap(map);
	}

	@Input()
	set pointOptions(p: PointOptions) {
		this._pointOptions = p;
		this.render();
	}

	@Input()
	set points(points: number[]) {
		this.setPoints(points);
	}

	constructor() {
	}

	ngOnDestroy() {
		disposeObjects(this._objects);
	}

	ngOnInit() {
	}

	ngAfterViewInit() {
		this.viewer.preRender = () => this.preRender();
	}

	setWafer(wafer: WaferOptions) {
		if (this._waferOptions === wafer || !wafer) return;

		this._waferOptions = wafer;

		if (wafer) {
			this._options = {
				minZoom: 1,
				maxZoom: wafer.maxZoom || 1e6,
				background: wafer.background
			};
		}

		disposeObject3D(this._wafer);
		this._wafer = createWaferShape(wafer.diameter, wafer.diameter / 100, wafer.orientationAngle, wafer.fill, wafer.perimeter);
		this._wafer.position.set(0, 0, 100);
		this.buildScene();
	}

	setDieMap(dieMap: DieMap | null) {
		if (this._dieMap === dieMap) return;

		this._dieMap = dieMap;
		const waferColor = this._waferOptions && this._waferOptions.fill || new THREE.Color(0);

		disposeObject3D(this._dies);
		this._dies = dieMap ? createRectangles(dieMap.map.map(die =>
			({...die, crosshatch: !!die.hatch, line: waferColor} as RectangleShape)
		)) : null;
		if (this._dies && dieMap.clippingEdge) {
			// add clipping mask
			//
		}
		this._dies.position.set(0, 0, 110);
		this.buildScene();
	}

	setPoints(points: Points) {
		if (this._points === points) return;

		this._points = points;

		disposeObject3D(this._defects);
		this._defects = null;

		const opt = this._pointOptions || {} as PointOptions;
		const colorPalette = opt.colorPalette || [new THREE.Color(0)];
		const dot = opt.pointSize || 2;
		const bounds = this._waferOptions ? this._waferOptions.diameter : 1;

		const p = createPoints(points, colorPalette, colorPalette[0], dot, bounds / 2);

		this._defectMaterial = p.material;
		p.points.position.set(0, 0, 900);
		this._defects = p.points;

		this.buildScene();
	}

	private buildScene() {
		this._objects = [this._wafer, this._dies, this._defects];
	}

	preRender() {
		if (this._defectMaterial) {
			// not used -------------->
			const rect = this._selectionWorldRect;
			const selection = rect && rect.width > 0 && rect.height > 0;
			this._defectMaterial.uniforms['selectionTest'].value = selection ? true : false;
			if (selection) {
				this._defectMaterial.uniforms['topRight'].value = new THREE.Vector2(rect.right, rect.top);
				this._defectMaterial.uniforms['bottomLeft'].value = new THREE.Vector2(rect.left, rect.bottom);
			}
			// <----------------------
			const p = this._pointOptions;
			if (p) {
				this._defectMaterial.uniforms['pointSize'].value = p.pointSize * window.devicePixelRatio;
			}
		}
	}

	private refresh() {
		if (this.viewer) this.viewer.refresh();
	}

	private render() {
		if (this.viewer) this.viewer.render();
	}

	@ViewChild(TwoDViewerComponent, undefined) viewer: TwoDViewerComponent;
	_defCount = 10;
	_defects: THREE.Points;
	_defectMaterial: THREE.ShaderMaterial;
	_selectionWorldRect: ClientRect;
	_worldRect: Rectangle | undefined;
	_objects: THREE.Object3D[] = [];
	_options: ViewerOptions = {minZoom: 1, maxZoom: 1e6};
	_waferOptions: WaferOptions;
	_dieMap: DieMap;
	_pointOptions: PointOptions;
	_wafer: THREE.Object3D;
	_dies: THREE.Object3D;
	_points: number[];
}
