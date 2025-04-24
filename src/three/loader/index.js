import { LoadingManager } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { GbkOBJLoader } from "../../lib/GbkOBJLoader";
import { loadingInstance } from "./loading";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const loadingManager = new LoadingManager(
    function onLoaded() {
        loadingManager.isLoading = false;
        loadingInstance.close();
    },
    function onProgress(url, loaded, total) {
        loadingInstance.service(((100 * loaded) / total).toFixed(2));
    },
    function onError(url) {},
);

loadingManager.isLoading = false;

/**
 * @param {{name:string,path:string,type:string}[]} models 模型路径或者数组
 * @param {(gltf:import("three/examples/jsm/loaders/GLTFLoader").GLTF,path:string)=>{}} onProgress 模型加载回调
 * @param {()=>void} onLoaded
 * @returns {Promise}
 */
export function loadGLTF(models, onProgress, onLoaded) {
    const loader = new GLTFLoader(loadingManager);
    const promises = [];

    loadingInstance.service(0);
    loadingManager.isLoading = true;

    if (models.length === 0) {
        loadingManager.isLoading = false;
        loadingInstance.close();
        onLoaded && onLoaded();
        return;
    }

    models.forEach(model => {
        if (model.type !== ".glb" && model.type !== ".gltf") return;
        const promise = loader
            .loadAsync(model.path)
            .then(gltf => onProgress(gltf, model.name))
            .catch(err => {
                console.log(err);
            });
        promises.push(promise);
    });

    return Promise.all(promises).then(() => {
        onLoaded && onLoaded();
    });
}

export function dracoLoaderGlb(models, onProgress, onLoaded) {
    // 创建DRACOLoader实例
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("./draco/");
    dracoLoader.setDecoderConfig({ type: "js" });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    const promises = [];

    // loadingInstance.service(0);
    // loadingManager.isLoading = true;

    if (models.length === 0) {
        loadingManager.isLoading = false;
        loadingInstance.close();
        onLoaded && onLoaded();
        return;
    }

    models.forEach(model => {
        if (model.type !== ".glb" && model.type !== ".gltf") return;
        const promise = loader
            .loadAsync(model.path)
            .then(gltf => onProgress(gltf, model.name))
            .catch(err => {
                console.log(err);
            });
        promises.push(promise);
    });

    return Promise.all(promises).then(() => {
        onLoaded && onLoaded();
    });
}
/**
 * @param {{name:string,path:string,type:string}[]} models 模型路径或者数组
 * @param {{name: string;vertices: Vector3[];}[]} onProgress 模型加载回调
 * @returns {Promise}
 */
export function loadOBJ(models, onProgress) {
    const loader = new GbkOBJLoader();
    const promises = [];

    models.forEach(model => {
        if (model.type !== ".obj") return;
        /**@type {Promise<{name: string;vertices: Vector3[];}[]} */
        const promise = loader
            .loadAsync(model.path)
            .then(object => onProgress(object, model.name))
            .catch(err => {
                console.log(err);
            });
        promises.push(promise);
    });
    return Promise.all(promises);
}
