import { Component, OnInit, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';

@Component({
	selector: 'mk-scrollbar',
	templateUrl: './scrollbar.component.html',
	styleUrls: ['./scrollbar.component.scss']
})
export class ScrollbarComponent implements OnInit {
	@Input()
	set orientation(o: 'horz' | 'vert') {
		const horz = o === 'horz';
		this._orientationClass.horz = horz;
		this._orientationClass.vert = !horz;
	}
	@Input()
	set range(minmax: [number, number]) {
		this._minimum = minmax[0];
		this._maximum = minmax[1];
		this.changePosition(this._position, false);
	}
	@Input() lineSize = 50;
	@Input()
	set pageSize(size: number) {
		this._pageSize = size;
		this.changePosition(this._position, false);
	}
	@Input()
	set position(n: number) {
		this.changePosition(n, false);
	}
	@Output() scrollTo = new EventEmitter<number>();

	constructor(elementRef: ElementRef) {
		this.el = elementRef.nativeElement;
	}

	ngOnInit() {
	}

	lineUp() {
		this._scroll(1);
	}

	lineDown() {
		this._scroll(-1);
	}

	scrollBy(delta: number) {
		this.changePosition(this._position + delta, true);
	}

	private track(): {from: number, to: number, span: number} {
		const p = this.getPageSize() / 2;
		const from = this._minimum + p;
		const to = this._maximum - p;
		return {from, to, span: to - from};
	}

	private changePosition(newPos: number, notify: boolean) {
		const track = this.track();
		const pos = track.span > 0 ? Math.max(track.from, Math.min(newPos, track.to)) : 0;
		if (pos !== this._position) {
			this._position = pos;

			if (notify) {
				if (!this._notifying) {
					this._notifying = true;
					this.scrollTo.next(pos);
					this._notifying = false;
				}
			}
		}
	}

	private getPageSize(): number {
		if (this._pageSize > 0) return this._pageSize;

		const rect = this.el.getBoundingClientRect();
		return rect && (this._vert ? rect.height : rect.width) || this.lineSize;
	}

	_scroll(dir: number) {
		let amount = this.lineSize;
		if (dir === 2 || dir === -2) {
			dir /= 2;
			amount = this.getPageSize();
		}
		this.changePosition(this._position + dir * amount, true);
	}

	// thumb location as a percentage 0..100
	_thumbLocation(): number {
		const track = this.track();
		const f = track.span > 0 ? (this._position - track.from) / track.span : 0;
		return f * 100 - f * this._thumbSize();
	}

	_thumbSize(): number {
		const range = this._maximum - this._minimum;
		if (range <= 0) return 0;

		const page = this.getPageSize();
		const s = 100 * page / range;
		if (s >= 100) return 0; // hide it when content fits in a viewport
		return Math.max(s, 3);
	}

	private thumbTravel(): number {
		if (!this.trackElement || !this.thumbElement) return 0;
		const track = this.trackElement.nativeElement.getBoundingClientRect();
		const thumb = this.thumbElement.nativeElement.getBoundingClientRect();
		if (this._vert) {
			return track && thumb && track.height - thumb.height || 0;
		}
		else {
			return track && thumb && track.width - thumb.width || 0;
		}
	}

	self() { return this; }

	getSize(): number {
		const track = this.track();
		const t = this.thumbTravel();
		const currentPos = track.span && (this._position - track.from) * t / track.span || 0;
		return currentPos;
	}

	_thumbMoved(pos: number) {
		const t = this.thumbTravel();
		if (t > 0) {
			const track = this.track();
			const p = pos / t * track.span + track.from;
			this.changePosition(p, true);
		}
	}

	get _vert(): boolean {
		return this._orientationClass.vert;
	}

	_orientationClass = {
		horz: false,
		vert: true
	};
	@ViewChild('track', undefined) trackElement;
	@ViewChild('thumb', undefined) thumbElement;
	_position = 0;
	_maximum = 0;
	_minimum = 0;
	_pageSize = 0;
	el: HTMLElement;
	_notifying = false;
	_thumbActive = false;
}
