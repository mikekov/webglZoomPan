export function disposeObject3D(obj: THREE.Object3D) {
	if (!obj) return;

	const children = obj.children;
	if (children) {
		children.forEach(child => disposeObject3D(child));
	}

	const geometry = obj['geometry'];
	const material = obj['material'];

	if (geometry) {
		geometry.dispose();
	}

	if (material) {
		const texture = material.map;

		if (texture) {
			texture.dispose();
		}

		material.dispose();
	}
}

export function removeObject(array: THREE.Object3D[], object: THREE.Object3D) {
	removeElement(array, object);
	disposeObject3D(object);
}

export function removeElement(array: any[], element: any) {
	if (!array || !array.length) return;

	const pos = array.findIndex(el => el === element);
	if (pos >= 0) array.splice(pos, 1);
}

export function clearScene(scene: THREE.Scene, dispose: boolean) {
	if (!scene) return;

	while (scene.children.length) {
		if (dispose) disposeObject3D(scene.children[0]);

		scene.remove(scene.children[0]);
	}
}
