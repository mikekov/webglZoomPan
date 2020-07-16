import * as THREE from 'three';

export interface ImageFragment {
	tex: THREE.Texture,
	col: number, // image fragment column in texture
	row: number, // image fragment row in texture
	imageWidth: number, // fragment size in pixels
	imageHeight: number
}

// rectangle to be drawn: locaiton, style and colors
export interface RectangleShape {
	// world coordinates and sizes, Y axis pointing up
	x: number;
	y: number;
	width: number;
	height: number;
	fill?: THREE.Color;
	line?: THREE.Color;
	marker?: THREE.Color;
	lineWidth?: number; // may not be effective in webGL
	hatch?: THREE.Color;
	crosshatch?: boolean;
	image?: ImageFragment;
}

function updateVertices(geometry: THREE.Geometry, rect: {x: number, y: number, width: number, height: number}, zpos: number, scale: number) {
	const pad = 0;
	const point = new THREE.Vector3(rect.x, rect.y, zpos).multiplyScalar(scale);

	geometry.vertices.push(
		new THREE.Vector3(
			point.x - pad,
			point.y - pad,
			point.z
		),
		new THREE.Vector3(
			point.x + rect.width + pad,
			point.y - pad,
			point.z
		),
		new THREE.Vector3(
			point.x + rect.width + pad,
			point.y + rect.height + pad,
			point.z
		),
		new THREE.Vector3(
			point.x - pad,
			point.y + rect.height + pad,
			point.z
		)
	);
}

function updateFaces(geometry: THREE.Geometry) {
	geometry.faces.push(
		// Add the first face (the lower-right triangle)
		new THREE.Face3(
			geometry.vertices.length - 4,
			geometry.vertices.length - 3,
			geometry.vertices.length - 2
		),
		// Add the second face (the upper-left triangle)
		new THREE.Face3(
			geometry.vertices.length - 4,
			geometry.vertices.length - 2,
			geometry.vertices.length - 1
		)
	)
}

// calculate location of the single cell in an atlas texture
function getImageUvData(img: ImageFragment, index: number): {x: number, y: number, w: number, h: number, face: number} {
	const texHeight = img.tex.image.height;
	const texWidth = img.tex.image.width;
	// size of one image in a texture atlas, in texture coordinates
	const width = img.imageWidth / texWidth;
	const height = img.imageHeight / texHeight;
	return {
		w: width,
		h: height,
		x: img.col * width,
		// texture coordinates are 0 at the bottom and 1 at the top, so reversing Y coordinate to start from top
		y: 1 - (img.row + 1) * height,
		face: index * 2
	}
}

function updateFaceVertexUvs(geometry: THREE.Geometry, img: ImageFragment, index: number, materialIndex: number) {
	const uv = getImageUvData(img, index);
	// Use .set() if the given faceVertex is already defined; see:
	// https://github.com/mrdoob/three.js/issues/7179
	if (geometry.faceVertexUvs[0][uv.face]) {
		geometry.faceVertexUvs[0][uv.face][0].set(uv.x, uv.y)
		geometry.faceVertexUvs[0][uv.face][1].set(uv.x + uv.w, uv.y)
		geometry.faceVertexUvs[0][uv.face][2].set(uv.x + uv.w, uv.y + uv.h)
	} else {
		geometry.faceVertexUvs[0][uv.face] = [
			new THREE.Vector2(uv.x, uv.y),
			new THREE.Vector2(uv.x + uv.w, uv.y),
			new THREE.Vector2(uv.x + uv.w, uv.y + uv.h)
		]
	}
	// Map the region of the image described by the lower-left,
	// upper-right, and upper-left vertices to `faceTwo`
	if (geometry.faceVertexUvs[0][uv.face + 1]) {
		geometry.faceVertexUvs[0][uv.face + 1][0].set(uv.x, uv.y)
		geometry.faceVertexUvs[0][uv.face + 1][1].set(uv.x + uv.w, uv.y + uv.h)
		geometry.faceVertexUvs[0][uv.face + 1][2].set(uv.x, uv.y + uv.h)
	} else {
		geometry.faceVertexUvs[0][uv.face + 1] = [
			new THREE.Vector2(uv.x, uv.y),
			new THREE.Vector2(uv.x + uv.w, uv.y + uv.h),
			new THREE.Vector2(uv.x, uv.y + uv.h)
		]
	}
	// Set the material index for the new faces
	geometry.faces[uv.face].materialIndex = materialIndex;
	geometry.faces[uv.face + 1].materialIndex = materialIndex;
}

function addTriangle(geometry: THREE.Geometry, rect: RectangleShape, size: number) {
	const point = new THREE.Vector3(rect.x + rect.width, rect.y, 0);
	geometry.vertices.push(
		new THREE.Vector3(
			point.x,
			point.y, // + rect.height,
			point.z
		),
		new THREE.Vector3(
			point.x - size,
			point.y, // + rect.height,
			point.z
		),
		new THREE.Vector3(
			point.x,
			point.y + size,// + rect.height - size,
			point.z
		),
	);
	geometry.faces.push(
		new THREE.Face3(
			geometry.vertices.length - 1,
			geometry.vertices.length - 2,
			geometry.vertices.length - 3
		)
	)
}


// this function creates a 3D object that renders list of rectangles;
// they have colors and style specified in input data
export function createRectangles(rects: RectangleShape[]): THREE.Group {
	const materials: {[key: string]: THREE.Material} = {};
	const lineMaterials: {[key: string]: THREE.Material} = {};
	const markerMesh: {[key: string]: THREE.Mesh} = {};
	let crosshatch: THREE.ShaderMaterial | null = null;
	const group = new THREE.Group();
	const imageGeometry = new THREE.Geometry();
	let index = 0;

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
		else if (rect.image) {
			const scale = 1;
			updateVertices(imageGeometry, rect, 0, scale);
			updateFaces(imageGeometry);
			let materialIndex = 0;
			updateFaceVertexUvs(imageGeometry, rect.image, index, materialIndex);
			index++;
		}
		else if (fill && !rect.crosshatch) {
			mat = materials[fill.getHexString()];
			if (!mat) {
				mat = new THREE.MeshBasicMaterial({color: fill});
				materials[fill.getHexString()] = mat;
			}
		}

		if (rect.marker) {
			let mesh = markerMesh[rect.marker.getHexString()];
			if (!mesh) {
				const geometry = new THREE.Geometry;
				const material = new THREE.MeshBasicMaterial({color: rect.marker});
				mesh = new THREE.Mesh(geometry, material);
				mesh.position.set(0, 0, 0.9);
				markerMesh[rect.marker.getHexString()] = mesh;
			}
			// add marker
			addTriangle(mesh.geometry as THREE.Geometry, rect, Math.min(rect.width, rect.height) * 0.25);
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

	if (index > 0) {
		// add images; collect textures
		//TODO
		const texture = rects[0].image?.tex;
		const material = new THREE.MeshBasicMaterial({map: texture});

		// Combine the image geometry and material list into a mesh
		const mesh = new THREE.Mesh(imageGeometry, material);
		// Store the index position of the image and the mesh
		// mesh.userData.meshIndex = this.meshes.length;
		// Set the position of the image mesh in the x,y,z dimensions
		mesh.position.set(0, 0, 0.5);
		// Add the image to the scene
		// this.scene.add(mesh);
		group.add(mesh);

		// const textures = _.
	}

	// add markers, if any
	for (let mesh of Object.values(markerMesh)) {
		if (mesh) group.add(mesh as THREE.Mesh);
	}

	return group;
}

// material with crosshatch fill
function createCrosshatchMaterial(background: THREE.Color, lines: THREE.Color, spacing?: number): THREE.ShaderMaterial {
	const rotation = new THREE.Matrix3();
	rotation.rotate(Math.PI / 4);

	const diffColor = lines.clone().sub(background);

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
			// float dist = gl_FragCoord.x * gl_FragCoord.y;
			// if (dist > 288.0 * 288.0) discard;
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
