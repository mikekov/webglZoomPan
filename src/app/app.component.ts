import { Component } from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {
	constructor() {
		const d = this.diameter + 2;
		this.worldCanvas = { x: -d / 2, y: -d / 2, width: d, height: d };
	}
	defects(n: string) {
		const N = Math.pow(10, +n);
		if (N >= 0 && N <= 1e9) {
			this.defCount = N;
		}
	}

	setDotSize(n: number) {
		this.dotSize = n / 2;
	}

	enableDensity(en) {
		this.density = en;
	}

	diameter = 300;
	density = false;
	dotSize = 3;
	defCount = 100;
	worldCanvas; // = {x: -150, y: -150, width: 300, height: 300};
}
