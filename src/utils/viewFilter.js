import { Vector3, Camera, Object3D, Box3 } from "three";
import { isInView } from ".";

/**
 * 视锥体剔除算法
 * @param {Camera} camera
 * @param {Object3D|Object3D[]} object
 * @returns
 */
export function viewFilter(camera, object) {
    if (Array.isArray(object)) {
        const objectInView = [];
        object.forEach(child => {
            if (isObject3DInView(camera, child)) objectInView.push(child);
        });
        return objectInView;
    } else if (object instanceof Object3D) {
        if (isObject3DInView(camera, object)) return object;
    }

    throw new Error("Expected THREE.Object3D|THREE.Object3D[], but got wrong type");
}

/**
 * @param {Camera} camera
 * @param {Object3D} object
 */
function isObject3DInView(camera, object) {
    const boundingArray = getBoundingArray(object);
    for (let i = 0; i < boundingArray.length; i++) {
        if (isInView(camera, boundingArray[i])) return true;
    }
    return false;
}

/**
 *
 * @param {Object3D} child
 * @returns
 */
function getBoundingArray(child) {
    const { min, max } = new Box3().setFromObject(child);

    const v1 = new Vector3(min.x, min.y, min.z);
    const v2 = new Vector3(min.x, min.y, max.z);
    const v3 = new Vector3(min.x, max.y, min.z);
    const v4 = new Vector3(min.x, max.y, max.z);
    const v5 = new Vector3(max.x, min.y, min.z);
    const v6 = new Vector3(max.x, min.y, max.z);
    const v7 = new Vector3(max.x, max.y, min.z);
    const v8 = new Vector3(max.x, max.y, max.z);

    return [v1, v2, v3, v4, v5, v6, v7, v8];
}
