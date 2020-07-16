import { Directive, Input, Output, HostListener, ElementRef, EventEmitter, ApplicationRef } from '@angular/core';

// ktSplitter directive is to be attached to an element that users can move to adjust size of an adjacent element

function isFunction(f: any): boolean {
	return f instanceof Function;
}

@Directive({
	selector: '[mkSplitter]'
})
export class SplitterDirective {
	constructor(private appRef: ApplicationRef) {
		this.setCallbacks();
	}

	// resizing direction: which way to drag slider to make connected element grow
	@Input()
	grow: 'left' | 'right' | 'top' | 'bottom' | undefined;

	// minimum size to report
	@Input() minSize = 0;

	// current size of the element splitter is resizing
	@Input() currentSize = 0;

	// resizing step
	@Input() step = 1;

	// component to resize; splitter will call resizing() & resizingAction() on this component
	@Input() component: { getSize?: () => number; resizingAction?: (arg0: boolean) => void; resizing?: (arg0: number) => void; } | undefined;

	@Input() canResize = true;
	@Input() changeCursor = true;

	// new size
	@Output()
	resizing = new EventEmitter<number>();

	// resizing start (true) and end (false)
	@Output()
	resizingAction = new EventEmitter<boolean>();

	@HostListener('mousedown', ['$event'])
	down(ev: MouseEvent): void {
		if (!this.canResize) return;
		this.drag = true;
		this.captureMouseEvents(ev);
		this.point = {x: ev.x, y: ev.y};
		this.resizingStartStop(true);
		this.storeSize = this.currentSize;
		if (this.component && isFunction(this.component.getSize)) {
			this.storeSize = this.component.getSize!();
		}
	}

	private resizingStartStop(start: boolean) {
		if (!this.canResize) return;
		this.resizingAction.next(start);
		if (this.component && isFunction(this.component.resizingAction)) {
				this.component.resizingAction!(start);
		}
	}

	private getMainElement(): HTMLElement | null {
		this.rootRef = this.appRef.components && this.appRef.components[0] && this.appRef.components[0].injector.get(ElementRef);
		return this.rootRef && this.rootRef.nativeElement;
	}

	// prevent mouse events on a root element to stop other custom cursors on subelements during resizing;
	// leave mouse events on a body to be able to change cursor globally
	private preventGlobalMouseEvents() {
		const main = this.getMainElement();
		// (main || document.body).style['pointer-events'] = 'none';
		(main || document.body).style.pointerEvents = 'none';
	}

	private restoreGlobalMouseEvents() {
		const main = this.getMainElement();
		// (main || document.body).style['pointer-events'] = 'auto';
		(main || document.body).style.pointerEvents = 'auto';
	}

	private setCallbacks() {
		this.mousemoveListener = (ev: MouseEvent) => {
			ev.stopPropagation();
			// report resizing attempt while the user is moving the cursor around
			if (this.drag && this.point) {
				let delta = 0;
				switch (this.grow) {
					case 'right':
						delta = ev.x - this.point.x;
						break;
					case 'left':
						delta = this.point.x - ev.x;
						break;
					case 'bottom':
						delta = ev.y - this.point.y;
						break;
					case 'top':
						delta = this.point.y - ev.y;
						break;
				}
				if (this.step > 0) {
				const step = +this.step || 1;
				let size = this.storeSize + delta;
				const rem = size % step;
				size -= rem;
				if (rem > step / 2) { size += step; }
				const final = Math.max(+this.minSize, size);
				this.resizing.next(final);
				if (this.component && isFunction(this.component.resizing)) {
					this.component.resizing!(final);
				}
				}
				else {
					const size = this.storeSize + delta;
					this.resizing.next(size);
				}
			}
		};

		this.mouseupListener = (e: MouseEvent) => {
			document.body.style.cursor = this.saveCursor;
			this.restoreGlobalMouseEvents();
			document.removeEventListener('mouseup',   this.mouseupListener,   true);
			document.removeEventListener('mousemove', this.mousemoveListener, true);
			e.stopPropagation();

			if (this.drag) {
				this.drag = false;
				this.resizingStartStop(false);
			}
		};
	}

	private captureMouseEvents(e: MouseEvent) {
		this.preventGlobalMouseEvents();
		document.addEventListener('mouseup',   this.mouseupListener,   true);
		document.addEventListener('mousemove', this.mousemoveListener, true);
		e.preventDefault();
		e.stopPropagation();
		this.saveCursor = document.body.style.cursor;
		if (this.changeCursor && this.grow) {
			document.body.style.cursor = /left|right/.test(this.grow) ? 'col-resize' : 'row-resize';
		}
	}

	private drag = false;
	private point: {x: number, y: number} | null = null;
	private storeSize = 0;
	private saveCursor = "";
	private mousemoveListener: any;
	private mouseupListener: any;
	private rootRef: ElementRef | undefined;
}
