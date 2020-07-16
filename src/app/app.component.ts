import { Component, OnInit, AfterViewInit } from '@angular/core';
import { WaferOptions, DieMap, PointOptions } from './wafer-map/wafer-map.component';
import { WAFER, PERIMETER, BACKGND, generateDieMap, DEFECTS_INACTIVE, RED, GREEN, generateDefects } from './test';
import * as THREE from 'three';
import { HttpClient } from '@angular/common/http';


@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
	constructor(private http: HttpClient) {
		const d = this.diameter + 2;
		this.worldCanvas = { x: -d / 2, y: -d / 2, width: d, height: d };
	}

	ngOnInit() {
		this.wafer = {
			diameter: 300,
			orientationAngle: 180,
			fill: WAFER,
			perimeter: PERIMETER,
			background: new THREE.Color(BACKGND),
		};

		this.dieMap = {
			map: this.genDieMap(this.colormap),
			clippingEdge: 3
		};

		this.pointOptions = {
			pointSize: 2,
			colorPalette: [DEFECTS_INACTIVE, RED, GREEN],
			selectedColor: null
		};

		// test on-line source
		// this.http.get("http://localhost:5990/r1/defects/xyattr?layout=wafer").subscribe(d => {
		// 	this.defects = d as number[];
		// });

		this.genDefects("3");
	}

	ngAfterViewInit() {}

	genDieMap(colors) {
		return generateDieMap(this.diameter, 10, 12, [-5, 6], 0.1, colors);
	}

	genDefects(n: string) {
		const N = Math.pow(10, +n);
		if (N >= 0 && N <= 1e9) {
			this.defCount = N;
			const def = generateDefects(this.diameter, this.defCount, [-5, 6]);
			this.defects = def;
		}
	}

	setDotSize(n: number) {
		if (this.pointOptions) {
			this.pointOptions = {...this.pointOptions, pointSize: n / 2};
		}
		this.dotSize = n / 2;
	}

	enableColors(en) {
		this.colormap = en;
		if (this.dieMap) {
			this.dieMap = {...this.dieMap, map: this.genDieMap(en)};
		}
	}

	defSlider(): number {
		return Math.log10(this.defCount);
	}

	dotSlider(): number {
		return this.dotSize * 2;
	}

	diameter = 300;
	colormap = true;
	dotSize = 3;
	defCount = 100;
	worldCanvas: { x: number; y: number; width: number; height: number; };
	wafer: WaferOptions;
	dieMap: DieMap;
	pointOptions: PointOptions;
	defects: number[];
}
