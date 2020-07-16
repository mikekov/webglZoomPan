/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 * @author ScieCode / http://github.com/sciecode
 * @messingup MikeK
 */

import {
	EventDispatcher,
	MOUSE,
	Quaternion,
	Spherical,
	TOUCH,
	Vector2,
	Vector3,
	Matrix4
} from "three";

const MOUSE_SELECT = 999;

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const OrbitControls = function (this: any, object: { up: Vector3; }, domElement: Element | undefined) {

	this.object = object;

	this.domElement = (domElement !== undefined) ? domElement : document;

	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the object orbits around
	this.target = new Vector3();

	// How far you can dolly in and out ( PerspectiveCamera only )
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// How far you can zoom in and out ( OrthographicCamera only )
	this.minZoom = 0;
	this.maxZoom = Infinity;

	// How far you can orbit vertically, upper and lower limits.
	// Range is 0 to Math.PI radians.
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	// How far you can orbit horizontally, upper and lower limits.
	// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
	this.minAzimuthAngle = - Infinity; // radians
	this.maxAzimuthAngle = Infinity; // radians

	// Set to true to enable damping (inertia)
	// If damping is enabled, you must call controls.update() in your animation loop
	this.enableDamping = false;
	this.dampingFactor = 0.05;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// Set to false to disable zooming
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// Set to false to disable rotating
	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	// Set to false to disable panning
	this.enablePan = true;
	this.panSpeed = 1.0;
	this.screenSpacePanning = false; // if true, pan in screen-space
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// Set to false to disable use of the keys
	this.enableKeys = true;

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40, PLUS: 187, MINUS: 189, RESET_ZOOM: 220 };

	// Mouse buttons
	this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

	// Touch fingers
	this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.zoom0 = this.object.zoom;

	// for rect-select
	this.enableSelect = false;
	this._clickPoint = new Vector2();
	this._upPoint = new Vector2();

	this.limitOffset = function() {};
	//
	// public methods
	//

	// zoom in on a rectangle (specified in screen coordinates)
	this.zoomToRect = function(left: number, right: number, top: number, bottom: number) {
		const w = right - left;
		const h = bottom - top;
		if (w <= 0 || h <= 0) return;
		const sx = scope.domElement.clientWidth / w;
		const sy = scope.domElement.clientHeight / h;
		const s = Math.min(sx, sy);
		const zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * s));
		if (scope.object.zoom !== zoom) {
			const newCenter = scope.screenToWorld((left + right) / 2, (top + bottom) / 2);
			scope.object.zoom = zoom;
			scope.object.updateProjectionMatrix();
			const center = scope.screenToWorld(scope.domElement.clientWidth / 2, scope.domElement.clientHeight / 2);
			panOffset.set(newCenter.x - center.x, newCenter.y - center.y, 0);
			scope.update();
		}
	};

	this.selecting = function(finished: boolean) {};

	this.hasSelectRect = function(): boolean {
		return !scope._clickPoint.equals(scope._upPoint);
	};

	this.getSelectRect = function(world?: boolean): ClientRect {
		const left = Math.min(scope._clickPoint.x, scope._upPoint.x);
		const right = Math.max(scope._clickPoint.x, scope._upPoint.x);
		const top = Math.min(scope._clickPoint.y, scope._upPoint.y);
		const bottom = Math.max(scope._clickPoint.y, scope._upPoint.y);
		if (world) {
			// screen to world
			const p1 = scope.screenToWorld(left, top);
			const p2 = scope.screenToWorld(right, bottom);
			const l = p1.x, r = p2.x, t = p1.y, b = p2.y;

			return {
				left: l, right: r,
				top: t, bottom: b,
				width: r - l,
				height: t - b
			};
		}
		else {
			const rect = scope.domElement.getBoundingClientRect();
			return {
				left: left - rect.left,
				right: right - rect.left,
				top: top - rect.top,
				bottom: bottom - rect.top,
				width: right - left,
				height: bottom - top
			};
		}
	};

	this.screenToWorld = function(screenX: number, screenY: number): { x: number, y: number } {
		const x = (scope.object.left + (screenX / scope.domElement.clientWidth) * (scope.object.right - scope.object.left)) / scope.object.zoom + scope.target.x;
		const y = (scope.object.bottom + ((scope.domElement.clientHeight - screenY) / scope.domElement.clientHeight) * (scope.object.top - scope.object.bottom)) / scope.object.zoom + scope.target.y;
		return { x, y };
	};

	this.clearSelectRect = function(): void {
		scope._clickPoint.set(0, 0);
		scope._upPoint.set(0, 0);
	};

	this.getPolarAngle = function () {
		return spherical.phi;
	};

	this.getAzimuthalAngle = function () {
		return spherical.theta;
	};

	this.saveState = function () {
		scope.target0.copy(scope.target);
		scope.position0.copy(scope.object.position);
		scope.zoom0 = scope.object.zoom;
	};

	this.reset = function () {
		scope.target.copy(scope.target0);
		scope.object.position.copy(scope.position0);
		scope.object.zoom = scope.zoom0;

		scope.object.updateProjectionMatrix();
		scope.dispatchEvent(changeEvent);

		scope.update();

		state = STATE.NONE;
	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function () {
		var offset = new Vector3();

		// so camera.up is the orbit axis
		var quat = new Quaternion().setFromUnitVectors(object.up, new Vector3(0, 1, 0));
		var quatInverse = quat.clone().inverse();

		var lastPosition = new Vector3();
		var lastQuaternion = new Quaternion();

		return function update() {

			var position = scope.object.position;

			offset.copy(position).sub(scope.target);

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion(quat);

			// angle from z-axis around y-axis
			spherical.setFromVector3(offset);

			if (scope.autoRotate && state === STATE.NONE) {
				rotateLeft(getAutoRotationAngle());
			}

			if (scope.enableDamping) {
				spherical.theta += sphericalDelta.theta * scope.dampingFactor;
				spherical.phi += sphericalDelta.phi * scope.dampingFactor;
			} else {
				spherical.theta += sphericalDelta.theta;
				spherical.phi += sphericalDelta.phi;
			}

			// restrict theta to be between desired limits
			spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));
			// restrict phi to be between desired limits
			spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
			spherical.makeSafe();

			spherical.radius *= scale;
			// restrict radius to be between desired limits
			spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

			// move target to panned location

			if (scope.enableDamping === true) {
				scope.target.addScaledVector(panOffset, scope.dampingFactor);
			} else {
				scope.target.add(panOffset);
			}

			offset.setFromSpherical(spherical);

			// rotate offset back to "camera-up-vector-is-up" space
			offset.applyQuaternion(quatInverse);

			position.copy(scope.target).add(offset);

			scope.object.lookAt(scope.target);
			scope.limitOffset(scope.target);

			if (scope.enableDamping === true) {
				sphericalDelta.theta *= (1 - scope.dampingFactor);
				sphericalDelta.phi *= (1 - scope.dampingFactor);

				panOffset.multiplyScalar(1 - scope.dampingFactor);
			} else {
				sphericalDelta.set(0, 0, 0);

				panOffset.set(0, 0, 0);
			}

			scale = 1;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if (zoomChanged ||
				lastPosition.distanceToSquared(scope.object.position) > EPS ||
				8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

				scope.dispatchEvent(changeEvent);

				lastPosition.copy(scope.object.position);
				lastQuaternion.copy(scope.object.quaternion);
				zoomChanged = false;

				scope.clearSelectRect();
				return true;
			}

			return false;
		};
	}();

	this.dispose = function () {
		scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
		scope.domElement.removeEventListener('mousedown', onMouseDown, false);
		scope.domElement.removeEventListener('wheel', onMouseWheel, false);

		scope.domElement.removeEventListener('touchstart', onTouchStart, false);
		scope.domElement.removeEventListener('touchend', onTouchEnd, false);
		scope.domElement.removeEventListener('touchmove', onTouchMove, false);

		document.removeEventListener('mousemove', onMouseMove, false);
		document.removeEventListener('mouseup', onMouseUp, false);

		window.removeEventListener('keydown', onKeyDown, false);

		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
	};

	//
	// internals
	//

	var scope = this;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = {
		NONE: - 1,
		ROTATE: 0,
		DOLLY: 1,
		PAN: 2,
		TOUCH_ROTATE: 3,
		TOUCH_PAN: 4,
		TOUCH_DOLLY_PAN: 5,
		TOUCH_DOLLY_ROTATE: 6,
		SELECT: 7
	};

	var state = STATE.NONE;

	var EPS = 1e-18;

	// current position in spherical coordinates
	var spherical = new Spherical();
	var sphericalDelta = new Spherical();

	var scale = 1;
	var panOffset = new Vector3();
	var zoomChanged = false;

	var rotateStart = new Vector2();
	var rotateEnd = new Vector2();
	var rotateDelta = new Vector2();

	var panStart = new Vector2();
	var panEnd = new Vector2();
	var panDelta = new Vector2();

	var dollyStart = new Vector2();
	var dollyEnd = new Vector2();
	var dollyDelta = new Vector2();

	function getAutoRotationAngle() {
		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
	}

	function getZoomScale() {
		return Math.pow(0.840896415253714543, scope.zoomSpeed);
	}

	function rotateLeft(angle: number) {
		sphericalDelta.theta -= angle;
	}

	function rotateUp(angle: number) {
		sphericalDelta.phi -= angle;
	}

	var panLeft = function () {
		var v = new Vector3();

		return function panLeft(distance: number, objectMatrix: Matrix4) {

			v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
			v.multiplyScalar(- distance);
// console.log('shift x', v.x, distance);
			panOffset.add(v);
// console.log('panoff', panOffset.x);
		};
	}();

	var panUp = function () {
		var v = new Vector3();

		return function panUp(distance: number, objectMatrix: Matrix4) {
			if (scope.screenSpacePanning === true) {
				v.setFromMatrixColumn(objectMatrix, 1);
			} else {
				v.setFromMatrixColumn(objectMatrix, 0);
				v.crossVectors(scope.object.up, v);
			}

			v.multiplyScalar(distance);
			panOffset.add(v);
		};
	}();

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function () {

		var offset = new Vector3();

		return function pan(deltaX: number, deltaY: number) {

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			if (scope.object.isPerspectiveCamera) {

				// perspective
				var position = scope.object.position;
				offset.copy(position).sub(scope.target);
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

				// we use only clientHeight here so aspect ratio does not distort speed
				panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
				panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

			} else if (scope.object.isOrthographicCamera) {
				// orthographic
				panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
				panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);
			} else {
				// camera neither orthographic nor perspective
				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
				scope.enablePan = false;
			}
		};
	}();

	this.panWorldCoord = function(dx: number, dy: number) {
		panOffset.x += dx;
		panOffset.y += dy;
		scope.update();
	};

	function resetZoom() {
		if (scope.object.isOrthographicCamera) {
			// scope.target.set(0, 0, 0);
			// scope.target.x = 0;
			scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, 1));
			scope.object.updateProjectionMatrix();
			// scope.target.x = 0;
			panOffset.set(-scope.target.x, -scope.target.y, 0);
			zoomChanged = true;
		}
	}

	function dollyIn(dollyScale: number) {
		if (scope.object.isPerspectiveCamera) {
			scale /= dollyScale;
		} else if (scope.object.isOrthographicCamera) {
			scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
			scope.object.updateProjectionMatrix();
			zoomChanged = true;
		} else {
			console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
			scope.enableZoom = false;
		}
	}

	function dollyOut(dollyScale: number) {

		if (scope.object.isPerspectiveCamera) {

			scale *= dollyScale;

		} else if (scope.object.isOrthographicCamera) {
			scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
			scope.object.updateProjectionMatrix();
			zoomChanged = true;
		} else {
			console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
			scope.enableZoom = false;
		}
	}

	//
	// event callbacks - update the object state
	//

	function handleMouseDownRotate(event: MouseEvent) {

		//console.log( 'handleMouseDownRotate' );

		rotateStart.set(event.clientX, event.clientY);

	}

	function handleMouseDownDolly(event: any) {

		//console.log( 'handleMouseDownDolly' );

		dollyStart.set(event.clientX, event.clientY);

	}

	function handleMouseDownPan(event: any) {

		//console.log( 'handleMouseDownPan' );

		panStart.set(event.clientX, event.clientY);

	}

	function handleMouseMoveRotate(event: any) {

		//console.log( 'handleMouseMoveRotate' );

		rotateEnd.set(event.clientX, event.clientY);

		rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

		rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

		rotateStart.copy(rotateEnd);

		scope.update();

	}

	function handleMouseMoveDolly(event: any) {

		const x = (scope.object.left + (event.clientX / scope.domElement.clientWidth) * (scope.object.right - scope.object.left)) / scope.object.zoom + scope.target.x;
		const y = (scope.object.top + (event.clientY / scope.domElement.clientHeight) * (scope.object.top - scope.object.bottom)) / scope.object.zoom + scope.target.y;
		//console.log( 'handleMouseMoveDolly' );

		dollyEnd.set(event.clientX, event.clientY);

		dollyDelta.subVectors(dollyEnd, dollyStart);

		if (dollyDelta.y > 0) {

			dollyIn(getZoomScale());

		} else if (dollyDelta.y < 0) {

			dollyOut(getZoomScale());

		}

		dollyStart.copy(dollyEnd);

		const nx = (scope.object.left + (event.clientX / scope.domElement.clientWidth) * (scope.object.right - scope.object.left)) / scope.object.zoom + scope.target.x;
		const ny = (scope.object.top + (event.clientY / scope.domElement.clientHeight) * (scope.object.top - scope.object.bottom)) / scope.object.zoom + scope.target.y;

		scope.update();
// console.log(nx-x, ny-y);
	}

	function handleMouseMovePan(event: any) {

		//console.log( 'handleMouseMovePan' );

		panEnd.set(event.clientX, event.clientY);

		panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

		pan(panDelta.x, panDelta.y);

		panStart.copy(panEnd);

		scope.update();

	}

	function handleMouseUp( /*event*/) {

		// console.log( 'handleMouseUp' );

	}

	function handleMouseWheel(event: any) {

		// console.log( 'handleMouseWheel' );
		const x = (scope.object.left + (event.clientX / scope.domElement.clientWidth) * (scope.object.right - scope.object.left)) / scope.object.zoom + scope.target.x;
		const y = (scope.object.bottom + (event.clientY / scope.domElement.clientHeight) * (scope.object.top - scope.object.bottom)) / scope.object.zoom + scope.target.y;

		if (event.deltaY < 0) {

			dollyOut(getZoomScale());

		} else if (event.deltaY > 0) {

			dollyIn(getZoomScale());

		}

		const nx = (scope.object.left + (event.clientX / scope.domElement.clientWidth) * (scope.object.right - scope.object.left)) / scope.object.zoom + scope.target.x;
		const ny = (scope.object.bottom + (event.clientY / scope.domElement.clientHeight) * (scope.object.top - scope.object.bottom)) / scope.object.zoom + scope.target.y;

		// const v = new Vector3(1, 1, 0);
		// v.unproject(scope.object);

		panOffset.set(x-nx, -(y-ny), 0);

		scope.update();
// console.log(x, y);
// console.log(nx - x, ny - y);

	}

	function handleKeyDown(event: any) {

		// console.log( 'handleKeyDown' );

		var needsUpdate = true;

		switch (event.keyCode) {

			case scope.keys.UP:
				pan(0, scope.keyPanSpeed);
				break;

			case scope.keys.BOTTOM:
				pan(0, - scope.keyPanSpeed);
				break;

			case scope.keys.LEFT:
				pan(scope.keyPanSpeed, 0);
				break;

			case scope.keys.RIGHT:
				pan(- scope.keyPanSpeed, 0);
				break;

			case scope.keys.PLUS:
				dollyOut(getZoomScale());
				break;

			case scope.keys.MINUS:
				dollyIn(getZoomScale());
				break;

			case scope.keys.RESET_ZOOM:
				resetZoom();
				break;

			default:
				needsUpdate = false;
				break;
			}

		if (needsUpdate) {
			// prevent the browser from scrolling on cursor keys
			event.preventDefault();

			scope.update();
		}
	}

	function handleTouchStartRotate(event: any) {

		//console.log( 'handleTouchStartRotate' );

		if (event.touches.length == 1) {

			rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

		} else {

			var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
			var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

			rotateStart.set(x, y);

		}

	}

	function handleTouchStartPan(event: any) {

		//console.log( 'handleTouchStartPan' );

		if (event.touches.length == 1) {

			panStart.set(event.touches[0].pageX, event.touches[0].pageY);

		} else {

			var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
			var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

			panStart.set(x, y);

		}

	}

	function handleTouchStartDolly(event: any) {

		//console.log( 'handleTouchStartDolly' );

		var dx = event.touches[0].pageX - event.touches[1].pageX;
		var dy = event.touches[0].pageY - event.touches[1].pageY;

		var distance = Math.sqrt(dx * dx + dy * dy);

		dollyStart.set(0, distance);

	}

	function handleTouchStartDollyPan(event: any) {

		//console.log( 'handleTouchStartDollyPan' );

		if (scope.enableZoom) handleTouchStartDolly(event);

		if (scope.enablePan) handleTouchStartPan(event);

	}

	function handleTouchStartDollyRotate(event: any) {

		//console.log( 'handleTouchStartDollyRotate' );

		if (scope.enableZoom) handleTouchStartDolly(event);

		if (scope.enableRotate) handleTouchStartRotate(event);

	}

	function handleTouchMoveRotate(event: any) {

		//console.log( 'handleTouchMoveRotate' );

		if (event.touches.length == 1) {

			rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

		} else {

			var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
			var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

			rotateEnd.set(x, y);

		}

		rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

		rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

		rotateStart.copy(rotateEnd);

	}

	function handleTouchMovePan(event: any) {

		//console.log( 'handleTouchMoveRotate' );

		if (event.touches.length == 1) {

			panEnd.set(event.touches[0].pageX, event.touches[0].pageY);

		} else {

			var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
			var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

			panEnd.set(x, y);

		}

		panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

		pan(panDelta.x, panDelta.y);

		panStart.copy(panEnd);

	}

	function handleTouchMoveDolly(event: any) {

		//console.log( 'handleTouchMoveRotate' );

		var dx = event.touches[0].pageX - event.touches[1].pageX;
		var dy = event.touches[0].pageY - event.touches[1].pageY;

		var distance = Math.sqrt(dx * dx + dy * dy);

		dollyEnd.set(0, distance);

		dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

		dollyIn(dollyDelta.y);

		dollyStart.copy(dollyEnd);

	}

	function handleTouchMoveDollyPan(event: any) {

		//console.log( 'handleTouchMoveDollyPan' );

		if (scope.enableZoom) handleTouchMoveDolly(event);

		if (scope.enablePan) handleTouchMovePan(event);

	}

	function handleTouchMoveDollyRotate(event: any) {

		//console.log( 'handleTouchMoveDollyPan' );

		if (scope.enableZoom) handleTouchMoveDolly(event);

		if (scope.enableRotate) handleTouchMoveRotate(event);

	}

	function handleTouchEnd( /*event*/) {

		//console.log( 'handleTouchEnd' );

	}


	function handleMouseUpSelect(event: MouseEvent) {
		if (scope.enableSelect === false) return;

		scope._upPoint.set(event.clientX, event.clientY);
		scope.selecting(true);
	}

	function handleMouseDownSelect(event: MouseEvent) {
		if (scope.enableSelect === false) return;

		scope._clickPoint.set(event.clientX, event.clientY);
		scope._upPoint.copy(scope._clickPoint);
		scope.selecting(false);
	}

	function handleMouseMoveSelect(event: MouseEvent) {
		if (scope.enableSelect === false) return;

		scope._upPoint.set(event.clientX, event.clientY);
		scope.selecting(false);
	}

	//
	// event handlers - FSM: listen for events and reset state
	//

	function onMouseDown(event: any) {

		if (scope.enabled === false) return;

		// Prevent the browser from scrolling.

		event.preventDefault();

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.

		scope.domElement.focus ? scope.domElement.focus() : window.focus();

		switch (event.button) {
			case 0:
				switch (scope.mouseButtons.LEFT) {
					case MOUSE.ROTATE:
						if (event.ctrlKey || event.metaKey || event.shiftKey) {
							if (scope.enablePan === false) return;
							handleMouseDownPan(event);
							state = STATE.PAN;
						} else {
							if (scope.enableRotate === false) return;
							handleMouseDownRotate(event);
							state = STATE.ROTATE;
						}
						break;

					case MOUSE.PAN:
						if (event.ctrlKey || event.metaKey || event.shiftKey) {
							if (scope.enableRotate === false) return;
							handleMouseDownRotate(event);
							state = STATE.ROTATE;
						} else {
							if (scope.enablePan === false) return;
							handleMouseDownPan(event);
							state = STATE.PAN;
						}
						break;

					case MOUSE_SELECT:
						if (scope.enableSelect === false) return;
						handleMouseDownSelect(event);
						state = STATE.SELECT;
						break;

					default:
						state = STATE.NONE;
				}
				break;

			case 1:
				switch (scope.mouseButtons.MIDDLE) {
					case MOUSE.DOLLY:
						if (scope.enableZoom === false) return;
						handleMouseDownDolly(event);
						state = STATE.DOLLY;
						break;

					case MOUSE.PAN:
						if (scope.enablePan === false) return;
						handleMouseDownPan(event);
						state = STATE.PAN;
						break;

					default:
						state = STATE.NONE;
				}
				break;

			case 2:
				switch (scope.mouseButtons.RIGHT) {
					case MOUSE.ROTATE:
						if (scope.enableRotate === false) return;
						handleMouseDownRotate(event);
						state = STATE.ROTATE;
						break;

					case MOUSE.PAN:
						if (scope.enablePan === false) return;
						handleMouseDownPan(event);
						state = STATE.PAN;
						break;

					default:
						state = STATE.NONE;
				}
				break;
		}

		if (state !== STATE.NONE) {
			document.addEventListener('mousemove', onMouseMove, false);
			document.addEventListener('mouseup', onMouseUp, false);

			scope.dispatchEvent(startEvent);
		}
	}

	function onMouseMove(event: any) {
		if (scope.enabled === false) return;

		event.preventDefault();

		switch (state) {
			case STATE.ROTATE:
				if (scope.enableRotate === false) return;
				handleMouseMoveRotate(event);
				break;

			case STATE.DOLLY:
				if (scope.enableZoom === false) return;
				handleMouseMoveDolly(event);
				break;

			case STATE.PAN:
				if (scope.enablePan === false) return;
				handleMouseMovePan(event);
				break;

			case STATE.SELECT:
				if (scope.enableSelect === false) return;
				handleMouseMoveSelect(event);
				break;
		}

		// const x = (scope.object.left + (event.clientX / scope.domElement.clientWidth) * (scope.object.right - scope.object.left)) / scope.object.zoom + scope.target.x;
		// const y = (scope.object.top + (event.clientY / scope.domElement.clientHeight) * (scope.object.top - scope.object.bottom)) / scope.object.zoom + scope.target.y;
		// scope.object
		// console.log(x, y, scope.target);
	}

	function onMouseUp(event: any) {

		if (scope.enabled === false) return;

		if (state === STATE.SELECT) {
			handleMouseUpSelect(event);
		}
		// handleMouseUp(event);

		document.removeEventListener('mousemove', onMouseMove, false);
		document.removeEventListener('mouseup', onMouseUp, false);

		scope.dispatchEvent(endEvent);

		state = STATE.NONE;

	}

	function onMouseWheel(event: any) {

		if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return;

		event.preventDefault();
		event.stopPropagation();

		scope.dispatchEvent(startEvent);

		handleMouseWheel(event);

		scope.dispatchEvent(endEvent);

	}

	function onKeyDown(event: any) {

		if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

		handleKeyDown(event);

	}

	function onTouchStart(event: any) {

		if (scope.enabled === false) return;

		event.preventDefault();

		switch (event.touches.length) {

			case 1:

				switch (scope.touches.ONE) {

					case TOUCH.ROTATE:

						if (scope.enableRotate === false) return;

						handleTouchStartRotate(event);

						state = STATE.TOUCH_ROTATE;

						break;

					case TOUCH.PAN:

						if (scope.enablePan === false) return;

						handleTouchStartPan(event);

						state = STATE.TOUCH_PAN;

						break;

					default:

						state = STATE.NONE;

				}

				break;

			case 2:

				switch (scope.touches.TWO) {

					case TOUCH.DOLLY_PAN:

						if (scope.enableZoom === false && scope.enablePan === false) return;

						handleTouchStartDollyPan(event);

						state = STATE.TOUCH_DOLLY_PAN;

						break;

					case TOUCH.DOLLY_ROTATE:

						if (scope.enableZoom === false && scope.enableRotate === false) return;

						handleTouchStartDollyRotate(event);

						state = STATE.TOUCH_DOLLY_ROTATE;

						break;

					default:

						state = STATE.NONE;

				}

				break;

			default:

				state = STATE.NONE;

		}

		if (state !== STATE.NONE) {

			scope.dispatchEvent(startEvent);

		}

	}

	function onTouchMove(event: any) {

		if (scope.enabled === false) return;

		event.preventDefault();
		event.stopPropagation();

		switch (state) {

			case STATE.TOUCH_ROTATE:

				if (scope.enableRotate === false) return;

				handleTouchMoveRotate(event);

				scope.update();

				break;

			case STATE.TOUCH_PAN:

				if (scope.enablePan === false) return;

				handleTouchMovePan(event);

				scope.update();

				break;

			case STATE.TOUCH_DOLLY_PAN:

				if (scope.enableZoom === false && scope.enablePan === false) return;

				handleTouchMoveDollyPan(event);

				scope.update();

				break;

			case STATE.TOUCH_DOLLY_ROTATE:

				if (scope.enableZoom === false && scope.enableRotate === false) return;

				handleTouchMoveDollyRotate(event);

				scope.update();

				break;

			default:

				state = STATE.NONE;

		}

	}

	function onTouchEnd(event: any) {

		if (scope.enabled === false) return;

		// handleTouchEnd(event);

		scope.dispatchEvent(endEvent);

		state = STATE.NONE;

	}

	function onContextMenu(event: any) {

		if (scope.enabled === false) return;

		event.preventDefault();

	}

	//

	scope.domElement.addEventListener('contextmenu', onContextMenu, false);

	scope.domElement.addEventListener('mousedown', onMouseDown, false);
	scope.domElement.addEventListener('wheel', onMouseWheel, false);

	scope.domElement.addEventListener('touchstart', onTouchStart, false);
	scope.domElement.addEventListener('touchend', onTouchEnd, false);
	scope.domElement.addEventListener('touchmove', onTouchMove, false);

	window.addEventListener('keydown', onKeyDown, false);

	// force an update at start

	this.update();

};

OrbitControls.prototype = Object.create(EventDispatcher.prototype);
OrbitControls.prototype.constructor = OrbitControls;

Object.defineProperties(OrbitControls.prototype, {

	center: {

		get: function () {

			console.warn('THREE.OrbitControls: .center has been renamed to .target');
			return this.target;

		}

	},

	// backward compatibility

	noZoom: {

		get: function () {

			console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
			return !this.enableZoom;

		},

		set: function (value) {

			console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
			this.enableZoom = !value;

		}

	},

	noRotate: {

		get: function () {

			console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
			return !this.enableRotate;

		},

		set: function (value) {

			console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
			this.enableRotate = !value;

		}

	},

	noPan: {

		get: function () {

			console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
			return !this.enablePan;

		},

		set: function (value) {

			console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
			this.enablePan = !value;

		}

	},

	noKeys: {

		get: function () {

			console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
			return !this.enableKeys;

		},

		set: function (value) {

			console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
			this.enableKeys = !value;

		}

	},

	staticMoving: {

		get: function () {

			console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
			return !this.enableDamping;

		},

		set: function (value) {

			console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
			this.enableDamping = !value;

		}

	},

	dynamicDampingFactor: {

		get: function () {

			console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
			return this.dampingFactor;

		},

		set: function (value) {

			console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
			this.dampingFactor = value;

		}

	}

});

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
// This is very similar to OrbitControls, another set of touch behavior
//
//    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - left mouse, or arrow keys / touch: one-finger move
// interface MapControls {
	// enableRotate: boolean;
// }

var MapControls = function (this: any, object: THREE.Object3D, domElement: Element) {

	OrbitControls.call(this, object, domElement);

	this.mouseButtons.LEFT = MOUSE_SELECT; // MOUSE.LEFT; // MOUSE.PAN;
	this.mouseButtons.RIGHT = MOUSE.PAN; // MOUSE.ROTATE;
	this.mouseButtons.MIDDLE = MOUSE.PAN;

	this.touches.ONE = TOUCH.PAN;
	this.touches.TWO = TOUCH.DOLLY_ROTATE;

};

MapControls.prototype = Object.create(EventDispatcher.prototype);
MapControls.prototype.constructor = MapControls;


export { OrbitControls, MapControls };
