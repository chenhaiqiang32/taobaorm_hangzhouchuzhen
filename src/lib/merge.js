import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import * as THREE from "three";

let visibleF = [];

export function merge(object) {
  const resource = {};
  // 数组
  if (Array.isArray(object)) {
    object.forEach(item => {
      mergeTraverse(item, resource);
    });
  }

  // Object3D对象
  if (object instanceof THREE.Object3D) {
    mergeTraverse(object, resource);
  }

  // 结果
  const result = new THREE.Group();
  Object.keys(resource).forEach(key => {
    const mergeGeometry = mergeGeometries(resource[key].geometries, true);
    result.add(new THREE.Mesh(mergeGeometry, resource[key].materials));
  });

  visibleF.forEach(item => {
    result.add(item);
  });
  visibleF = [];

  return result;
}

function mergeTraverse(model, resource) {
  model.traverse(child => {
    if (!child.visible) {
      visibleF.push(child);
      return;
    }
    if (child instanceof THREE.Mesh) {
      const attr = Object.keys(child.geometry.attributes).toString();
      if (!resource[attr]) {
        resource[attr] = {
          geometries: [],
          materials: [],
        };
      }

      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      resource[attr].geometries.push(geometry);
      resource[attr].materials.push(child.material);
    } else {
      child.updateMatrixWorld();
    }
  });
}
