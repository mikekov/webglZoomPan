import * as THREE from 'three';

// create 3D object in plane z=0 representing wafer
// diameter - in mm
// notchSize - hight in mm
// notchAngle - in degrees; 0 - down, 90 ? TODO
export function createWaferShape(diameter: number, notchSize: number, notchAngle: number, fill: THREE.Color, perimeter: THREE.Color): THREE.Group {
	const vertices: number[] = [];
	vertices.push(0, 0, 0);
	let segments = 200;
	const thetaStart = notchSize / diameter;
	const thetaLength = 2 * (Math.PI - thetaStart);
	const vertex = new THREE.Vector3(0, 0, 0);
	const radius = diameter / 2;
	const nx = radius - notchSize / 2.1;
	const ny = notchSize / 6;
	vertices.push(nx, ny, vertex.z);
	for (let i = 0; i <= segments; ++i) {
		const segment = thetaStart + i / segments * thetaLength;

		vertex.x = radius * Math.cos(segment);
		vertex.y = radius * Math.sin(segment);

		vertices.push(vertex.x, vertex.y, vertex.z);
	}
	vertices.push(nx, -ny, vertex.z);
	vertices.push(radius - notchSize / 2, 0, vertex.z);

	segments = vertices.length / 3 - 1;
	const indices: number[] = [];
	for (let i = 1; i < segments; ++i) {
		indices.push(i, i + 1, 0);
	}
	indices.push(segments, 1, 0);

	const geo = new THREE.BufferGeometry();
	geo.setIndex(indices);
	geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

	const material = new THREE.MeshBasicMaterial({color: fill});
	const wafer = new THREE.Mesh(geo, material);
	wafer.position.set(0, 0, 0);

	const m = new THREE.LineBasicMaterial({linewidth: 2.0, color: perimeter});
	const outline = new THREE.BufferGeometry();
	// remove center point
	for (let i = 0; i < 3; ++i) {	vertices.shift(); }
	outline.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
	const line = new THREE.LineLoop(outline, m);
	line.position.set(0, 0, 1);

	const pointer = new THREE.Shape();
	const d = 3; // 3 mm
	pointer.moveTo(0, 0);
	pointer.lineTo(d, d);
	pointer.lineTo(d, d / 2);
	pointer.lineTo(d / 2, 0);
	pointer.lineTo(d, -d / 2);
	pointer.lineTo(d, -d);
	pointer.closePath();
	const notchPointer = new THREE.Mesh(new THREE.ShapeBufferGeometry(pointer), new THREE.MeshBasicMaterial({color: perimeter}));
	notchPointer.position.set(radius + 0.5, 0, 1);

	const group = new THREE.Group();
	group.add(wafer);
	group.add(line);
	group.add(notchPointer);

	group.rotateZ((notchAngle - 90) / 180 * Math.PI);

	return group;
}
