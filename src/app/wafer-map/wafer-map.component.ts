import { Component, OnInit, Input, OnDestroy, ViewEncapsulation, ViewChild, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { createWaferShape } from './create-wafer-shape';
import { createPoints } from './create-points';
import { generateDefects, DEFECTS_INACTIVE, RED, GREEN, DEFECTS_ACTIVE, generateDieMap, WAFER, PERIMETER, BACKGND } from '../test';
import { Rectangle, TwoDViewerComponent, ViewerOptions } from '../two-d-viewer/two-d-viewer.component';
import { removeObject } from '../utils/remove-object';

@Component({
	selector: 'mk-wafer-map',
	templateUrl: './wafer-map.component.html',
	styleUrls: ['./wafer-map.component.scss'],
	encapsulation: ViewEncapsulation.None
})
export class WaferMapComponent implements OnInit, OnDestroy, AfterViewInit {
	@Input()
	set defectCount(n: number) {
		if (this._defCount !== n) {
			this._defCount = n;
			if (this._objects.length) {
				this.addDefects();
			}
		}
	}

	@Input()
	set pointSize(s: number) {
		this._dotSize = s;
		this.render();
	}

	@Input()
	set worldCanvas(rect: Rectangle) {
		this._worldRect = rect;
	}

	constructor() {
	}

	addDefects() {
		const diameter = 300;
		if (this._defects) {
			removeObject(this._objects, this._defects);
			this._defects = null;
		}
		const def = generateDefects(diameter, this._defCount, this.offset);
		// defect attribute is used as index to this color palette
		const colorPalette = [DEFECTS_INACTIVE, RED, GREEN];
		const p = createPoints(def, colorPalette, DEFECTS_ACTIVE, this._dotSize, diameter / 2);

		this._defectMaterial = p.material;
		p.points.position.set(0, 0, 900);
		this._defects = p.points;
		this._objects.push(this._defects);
		this.refresh();
	}

	ngOnDestroy() {
	}

	ngOnInit() {
		const circle = createWaferShape(300, 3, 0, WAFER, PERIMETER);
		circle.position.set(0, 0, 100);
		this._objects.push(circle);

		const dies = generateDieMap(300, 10, 12, this.offset, 0.1);
		dies.position.set(0, 0, 110);
		this._objects.push(dies);

		this.addDefects();
	}

	ngAfterViewInit() {
		this.viewer.preRender = () => this.preRender();
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
			this._defectMaterial.uniforms['pointSize'].value = this._dotSize * window.devicePixelRatio;
		}
	}

	private refresh() {
		if (this.viewer) this.viewer.refresh();
	}

	private render() {
		if (this.viewer) this.viewer.render();
	}

	@ViewChild(TwoDViewerComponent, undefined) viewer: TwoDViewerComponent;
	private offset: [number, number] = [-5, 6];
	_defCount = 10;
	_defects: THREE.Points;
	_defectMaterial: THREE.ShaderMaterial;
	_selectionWorldRect: ClientRect;
	_dotSize = 3;
	_worldRect: Rectangle | undefined;
	_objects: THREE.Object3D[] = [];
	_options: ViewerOptions = {minZoom: 1, maxZoom: 1e6, background: new THREE.Color(BACKGND)};
}
