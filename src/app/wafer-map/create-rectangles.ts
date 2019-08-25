import * as THREE from 'three';

// rectangle to be drawn: locaiton, style and colors
export interface RectangleShape {
	// world coordinates and sizes, Y axis pointing up
	x: number;
	y: number;
	width: number;
	height: number;
	fill?: THREE.Color;
	line?: THREE.Color;
	lineWidth?: number; // may not be effective in webGL
	hatch?: THREE.Color;
	crosshatch?: boolean;
}

// this function creates a 3D object that renders list of rectangles;
// they have colors and style specified in input data
export function createRectangles(rects: RectangleShape[]): THREE.Group {
	const materials = {};
	const lineMaterials = {};
	let crosshatch = null;
	const group = new THREE.Group();

	rects.forEach(rect => {
		const geo = new THREE.PlaneBufferGeometry(rect.width, rect.height);
		const fill = rect.fill;
		let mat = null;
		const x = rect.x + rect.width / 2;
		const y = rect.y + rect.height / 2;

		// select right material
		if (fill && rect.crosshatch && rect.hatch) {
			if (!crosshatch) {
				crosshatch = createCrosshatchMaterial(fill, rect.hatch);
			}
			mat = crosshatch;
		}
		else if (fill && !rect.crosshatch) {
			mat = materials[fill.getHexString()];
			if (!mat) {
				mat = new THREE.MeshBasicMaterial({color: fill});
				materials[fill.getHexString()] = mat;
			}
		}

		if (mat) {
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(x, y, 0);
			group.add(mesh);
		}

		// add outline?
		if (rect.line) {
			mat = lineMaterials[rect.line.getHexString()];
			if (!mat) {
				mat = new THREE.LineBasicMaterial({linewidth: rect.lineWidth || 1, color: rect.line});
				lineMaterials[rect.line.getHexString()] = mat;
			}
			const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat);
			outline.position.set(x, y, 1);
			group.add(outline);
		}
	});

	return group;
}

// material with crosshatch fill
function createCrosshatchMaterial(background: THREE.Color, lines: THREE.Color, spacing?: number): THREE.ShaderMaterial {
	const rotation = new THREE.Matrix3();
	rotation.rotate(Math.PI / 4);

	const diffColor = lines.sub(background);

	const crosshatch = new THREE.ShaderMaterial({
		vertexShader: `
		void main() {
			vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			gl_Position = projectionMatrix * mvPosition;
		}`,
		fragmentShader: `
		uniform mat3 rotate;
		uniform float density;
		uniform vec3 background;
		uniform vec3 diffColor;
		void main() {
			vec2 pos = (rotate * vec3(gl_FragCoord.x, gl_FragCoord.y, 1.0)).xy;
			float dx = mod(pos.x, density) - density / 2.0;
			float dy = mod(pos.y, density) - density / 2.0;
			float d = max(0.0, 1.0 - min(abs(dx), abs(dy)));
			vec3 color = background + d * diffColor;
			gl_FragColor = vec4(color, 1.0);
		}`,
		uniforms: {
			rotate: {value: rotation},
			density: {value: Math.SQRT2 * (spacing || 8)},
			background: {value: new THREE.Vector3(background.r, background.g, background.b)},
			diffColor: {value: new THREE.Vector3(diffColor.r, diffColor.g, diffColor.b)},
		}
	});

	return crosshatch;
}
