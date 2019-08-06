import { Component } from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {
	defects(n: string) {
		const N = Math.pow(10, +n);
		if (N >= 0 && N <= 1e9) {
			this.defCount = N;
		}
	}

	defCount = 100;
}
