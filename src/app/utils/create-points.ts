import * as THREE from 'three';

// create a layer with points (point-like events that will be represented by square dots on the screen)
// data - flat array of numbers in form of repeated triples: x, y, attribute
// where x, y are 2D world coordinates and attribute is an index to color palette
// example: [x1, y1, attr1, x2, y2, attr2, ...]
// palette - array of colors; points are colored based on attribute value
// selected - color for selected points
// dotSize - size of points drawn in logical pixels
// boundingSphereRadius - radius of the bounding sphere for all points
//
// Note: to improve legibility of points with attribute values > 0, they are rendered larger and on top of attr = 0 ones
//
export function createPoints(data: number[], palette: THREE.Color[], selected: THREE.Color, dotSize: number, boundingSphereRadius: number):
	{ points: THREE.Points, material: THREE.ShaderMaterial } {
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
	// need to patch bounding sphere, since third number in (x, y, attr) triple is an attribute rather than Z coordinate
	geo.computeBoundingSphere = () => {
		if (geo.boundingSphere === null) { geo.boundingSphere = new THREE.Sphere(); }
		geo.boundingSphere.set(new THREE.Vector3(0, 0, 0), boundingSphereRadius);
	};

	// defect attribute is used as index to this color palette
	const colorPalette = {type: 'v4v', value: palette.map(c => new THREE.Vector4(c.r, c.g, c.b, 1))};
	colorPalette.value.push(new THREE.Vector4(0, 0, 0, 1));	// catch all black

	const material = new THREE.ShaderMaterial({
		depthWrite: true,
		uniforms: {
			pointSize: { value: dotSize * window.devicePixelRatio },
			selectionTest: {value: false},
			bottomLeft: {value: new THREE.Vector2(-100, -100)},
			topRight: {value: new THREE.Vector2(100, 100)},
			activeColor: {value: new THREE.Vector4(selected.r, selected.g, selected.b, 1)},
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
uniform vec4 activeColor;
uniform bool selectionTest;

void main() {
	if (selectionTest && zcolor > 0.0) {
		gl_FragColor = activeColor;
	}
	else {
		gl_FragColor = icolor;
	}
}`
	});
	// this.defectMaterial.depthWrite = false;
	// this.updateAlpha();
	const points = new THREE.Points(geo, material);
	return {points, material};
}
