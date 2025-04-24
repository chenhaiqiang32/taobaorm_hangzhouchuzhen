import {
    Mesh,
    Group,
    Vector3,
    BufferGeometry,
    Material,
    MeshStandardMaterial,
    AnimationMixer,
    MeshLambertMaterial,
    DoubleSide,
    TextureLoader,
    RepeatWrapping,
    PointLight,
    SpotLight,
} from "three";
import { createInstanceMesh } from "../../lib/InstanceMesh";
import { edgeFade, water2, glass, glassNight } from "../../shader/functions";
import { Lake } from "../../lib/blMeshes";
import { Subsystem } from "../subsystem";
import { uncache } from "../../utils/uncache";

/**
 * 默认设置实例化树木材质属性
 * @param {Mesh<BufferGeometry,Material>} mesh
 * @returns
 */
function _default_setTreeAttribute(mesh) {
    if (!mesh.isMesh) return;
    mesh.material = new MeshLambertMaterial({ map: mesh.material.map });
    mesh.castShadow = true;
    mesh.material.side = DoubleSide;
    mesh.material.alphaTest = 0.4;
    mesh.material.metalness = 0.0;
    mesh.material.roughness = 1.0;
    mesh.material.needsUpdate = true;
}

/**
 * 默认设置通用材质属性
 * @param {Mesh<BufferGeometry,MeshStandardMaterial>} mesh
 * @returns
 */
function _default_setAttribute(mesh) {
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.material.metalness = 0.2;
    mesh.material.roughness = 0.8;
    mesh.material.needsUpdate = true;
    mesh.castShadow = true;
}

/**
 * 默认阴影
 * @param {Mesh<BufferGeometry,MeshStandardMaterial>} mesh
 * @returns
 */
function setShadow(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

/**
 * 获得字符串上的参数值
 * @param {string} string
 * @param {string} key
 * @returns {number|undefined}
 */
function getOptionValue(string, key) {
    const start = string.indexOf(key);
    if (start !== -1) {
        let end = string.indexOf("&", start + key.length);
        if (end === -1) {
            end = string.length;
        }
        let value = string.substring(start + key.length, end);
        if (value.indexOf("0x") !== -1 || value.indexOf("0X") !== -1) {
            value = parseInt(value, 16);
        } else {
            value = parseFloat(value);
        }
        return value;
    }
}

/**
 * 加载实例化模型
 * @param {Group} model
 * @param {(mesh: Mesh<BufferGeometry,Material>)=>void} setAttribute
 * @param {number} scale
 * @returns
 */
function loadInstancedModel(model, setAttribute, scale = 1) {
    const group = new Group();

    const instanceMap = {};
    const instancePositionMap = {};
    const instanceRotationMap = {};

    const v = new Vector3();

    function setInstanceArray(child) {
        child.getWorldPosition(v);

        const key = child.name.split("_")[0];
        instancePositionMap[key] = instancePositionMap[key] || [];
        instancePositionMap[key].push(v.clone());

        instanceRotationMap[key] = instanceRotationMap[key] || [];
        instanceRotationMap[key].push(child.rotation);
    }

    model.children.forEach(group => {
        if (group.name.includes("坐标")) {
            group.traverse(setInstanceArray);
        } else {
            group.children.forEach(ins => (instanceMap[ins.name] = ins));
        }
    });

    Object.keys(instanceMap).forEach(key => {
        const instance = instanceMap[key];
        const ins = createInstanceMesh(instance, instancePositionMap[key], instanceRotationMap[key], scale);
        group.add(ins);
        if (ins instanceof Group) {
            ins.traverse(setAttribute);
        } else if (ins instanceof Mesh) {
            setAttribute(ins);
        }
    });
    return group;
}

/**
 * 处理需要进行实例化的树木模型
 * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
 * @param {(mesh: Mesh<BufferGeometry,Material>)=>void} setAttribute 自定义设置属性
 */
function processingInstancedTree(gltf, setAttribute = undefined) {
    const model = gltf.scene;
    return loadInstancedModel(model, setAttribute || _default_setTreeAttribute);
}

/**
 * 处理需要进行实例化的通用模型
 * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
 * @param {(mesh: Mesh<BufferGeometry,Material>)=>void} setAttribute 自定义设置属性
 */
function processingInstancedModel(gltf, setAttribute = undefined) {
    const model = gltf.scene;
    return loadInstancedModel(model, setAttribute || _default_setAttribute);
}

/**
 * 处理合并过后的树木模型
 * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
 * @param {(mesh: Mesh<BufferGeometry,Material>)=>void} setAttribute 自定义设置属性
 */
function processingMergedTree(gltf, setAttribute = undefined) {
    const model = gltf.scene;
    model.traverse(setAttribute || _default_setTreeAttribute);
    return model;
}

/**
 * 处理通用模型
 * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
 * @param {Subsystem} system 系统环境
 * @param {(mesh:Mesh<BufferGeometry,MeshStandardMaterial>)=>void} postprocess  在公共处理之后的后处理
 * @param {(mesh:Mesh<BufferGeometry,MeshStandardMaterial>)=>void} [preprocess=undefined] 在公共处理之前的预处理
 */
function processingCommonModel(gltf, system, postprocess = undefined, preprocess = undefined) {
    const model = gltf.scene;

    model.traverse(child => {
        if (child instanceof Mesh) {
            /**@type {MeshStandardMaterial} */
            const material = child.material;
            const lastName = material.name.split("-").pop();
            setShadow(child);
            preprocess && preprocess(child);

            // if (material.name.includes("镜面水")) {
            //     child.visible = false;

            //     // 传入child可以生成任意多边形湖面
            //     const lake = new Lake(child);
            //     lake.position.copy(child.position);

            //     // 欧拉角旋转
            //     lake.rotation.z = child.rotation.y;

            //     renderQueue.set(Symbol(), lake.update);
            //     system.add(lake);
            // }
            if (material.name.includes("water_others_0020.002")) {
                water2(material);
            }

            if (material.name.includes("边缘虚化")) {
                edgeFade(material);
            }

            postprocess && postprocess(child);
            material.needsUpdate = true;
        }
    });

    return model;
}

/**
 * 处理包含动画的模型，并将其播放。仅针对管控项目。
 * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
 * @param {Subsystem} system 系统环境
 */
function processingAnimations(gltf, system) {
    const animations = gltf.animations;
    if (animations.length > 0) {
        const model = gltf.scene;
        const mixer = new AnimationMixer(model);
        for (let i = 0; i < animations.length; i++) {
            let animatesName = animations[i].name;
            let nameId = animatesName.split("_")[0];
            system.actions.push(mixer.clipAction(animations[i]));
            if (!system.actionsObj[nameId]) {
                system.actionsObj[nameId] = [];
            }
            system.actionsObj[nameId].push(mixer.clipAction(animations[i]));
        }
        system.mixers.push(mixer);
        system.uncaches.push(() => uncache(animations, mixer, model));
    }
}

/**
 * 处理相机漫游模型。仅针对管控项目。
 * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
 */
function processingCameraAnimation(gltf, system) {
    const wanderCamera = gltf.cameras[0];
    const model = gltf.scene;

    const baseCamera = system.baseCamera;
    const renderQueue = system.onRenderQueue || system.core.onRenderQueue;

    // 设置漫游相机属性为系统相机属性

    const { fov, aspect, near, far } = system.camera;
    wanderCamera.fov = fov;
    wanderCamera.aspect = aspect;
    wanderCamera.near = near;
    wanderCamera.far = far;
    wanderCamera.updateProjectionMatrix();

    const target = model.children[0].position;

    const cameraMixer = new AnimationMixer(model);
    const cameraAction = cameraMixer.clipAction(gltf.animations[0]);
    const uuid = wanderCamera.uuid;

    let timer;

    /**动画帧更新函数 */
    function update(param) {
        if (!cameraAction.paused) {
            cameraMixer.update(param.delta);
            wanderCamera.lookAt(target);
            wanderCamera.updateWorldMatrix();
        }
    }

    /**切换相机状态 */
    function updateCameraState() {
        clearTimeout(timer);
        // 如果当前相机为漫游相机
        if (baseCamera !== system.core.camera) {
            cameraAction.paused = true;
            system.core.camera = baseCamera;
            system.postprocessing.composer.setMainCamera(system.core.camera);
        }

        timer = setTimeout(() => {
            system.core.camera = wanderCamera;
            cameraAction.play();
            cameraAction.paused = false;
            system.postprocessing.composer.setMainCamera(system.core.camera);
        }, 10000);
    }
    /**开始事件，加入渲染队列 */
    function begin() {
        system.core.domElement.addEventListener("mousemove", updateCameraState);
        renderQueue.set(uuid, update);
    }
    /**移除事件，从渲染队列移除 */
    function stop() {
        system.core.domElement.removeEventListener("mousemove", updateCameraState);
        renderQueue.delete(uuid);
        clearTimeout(timer);
    }

    const useCameraState = () => {
        return { begin, updateCameraState, stop };
    };

    system.useCameraState = useCameraState;

    return useCameraState;
}

export {
    processingInstancedTree,
    processingCommonModel,
    processingMergedTree,
    processingInstancedModel,
    processingAnimations,
    processingCameraAnimation,
};
