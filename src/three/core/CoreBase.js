import * as THREE from "three";

import Stats from "three/examples/jsm/libs/stats.module";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { Postprocessing } from "../components/postprocessing";

import MemoryManager from "./../../lib/memoryManager";
import DEFAULT from "../../config/index.json";

const memory = new MemoryManager();
THREE.Object3D.prototype.deleteSelf = function () {
    memory.track(this);
    memory.dispose();
};
const _$vec3 = new THREE.Vector3();
/**
 * @param {THREE.Sphere} sphere 将向量限制在球内
 */
THREE.Vector3.prototype.clampSphere = function (sphere) {
    if (this.distanceTo(sphere.center) > sphere.radius) {
        _$vec3.subVectors(this, sphere.center).normalize();
        _$vec3.setLength(sphere.radius);
        this.addVectors(sphere.center, _$vec3);
    }
};

//
const { innerWidth, innerHeight, devicePixelRatio } = window;

export class CoreBase {
    /**@type { THREE.Scene } 场景 */
    #scene;

    /**@type { THREE.Scene } 场景 */
    #baseScene;

    /**@type { THREE.WebGLRenderer } 渲染器 */
    #renderer;

    /**@type { THREE.PerspectiveCamera } 相机 */
    #camera;

    /**@type { THREE.PerspectiveCamera } 相机 */
    #baseCamera;

    /**@type { OrbitControls } 相机控制器 */
    #controls;

    /**@type { HTMLElement } DOM对象 */
    #domElement;

    /**@type { Postprocessing } 后处理 */
    #postprocessing;

    /**@type { THREE.Clock } 时钟 */
    clock;

    #renderEnabled;
    /**@type { THREE.AmbientLight} 平行光 */
    #ambientLight;
    /**@type { THREE.DirectionalLight} 平行光 */
    #directionalLight;
    /**@type { Stats} 性能监视器 */
    #stats;

    #onresizeQueue;
    /**@type { Map<string, ( width:number,height:number ) => void>} 渲染时，执行的任务队列 */
    #onRenderQueue;
    /**@type { Map<string, ( param: this ) => void>} 相机视角发生改变时，执行的任务队列 */

    get onresizeQueue() {
        return this.#onresizeQueue;
    }

    /**@type {  Map<string, ( param: this ) => void>} 渲染时，执行的任务队列 */
    get onRenderQueue() {
        return this.#onRenderQueue;
    }

    get scene() {
        return this.#scene;
    }

    set scene(value) {
        if (!(value instanceof THREE.Scene)) return;
        // 切换场景释放上一个场景的内存

        this.#scene.dispose && this.#scene.dispose();

        this.#scene = value;

        if (this.#postprocessing) {
            this.#postprocessing.composer.setMainScene(value);
        }
    }

    get camera() {
        return this.#camera;
    }

    set camera(value) {
        if (!(value instanceof THREE.Camera)) return;
        this.#camera = value;

        if (this.#postprocessing) {
            this.#postprocessing.composer.setMainCamera(value);
        }
    }

    get renderer() {
        return this.#renderer;
    }

    get controls() {
        return this.#controls;
    }

    get domElement() {
        return this.#domElement;
    }

    get ambientLight() {
        return this.#ambientLight;
    }

    get directionalLight() {
        return this.#directionalLight;
    }

    get postprocessing() {
        return this.#postprocessing;
    }

    /** @param {boolean} bool 设置缓存，默认为false*/
    set cache(bool) {
        THREE.Cache.enabled = bool;
    }

    get renderEnabled() {
        return this.#renderEnabled;
    }

    get baseScene() {
        return this.#baseScene;
    }

    get baseCamera() {
        return this.#baseCamera;
    }

    /**
     * @constructor
     * @param {HTMLElement | HTMLCanvasElement | undefined} domElement
     */
    constructor(domElement) {
        this.clock = new THREE.Clock();
        this.delta = 0;

        this.#onresizeQueue = new Map();
        this.#onRenderQueue = new Map();

        this.#domElement = domElement;

        this.#renderEnabled = false;

        this.#scene = new THREE.Scene();
        this.#baseScene = this.#scene;

        this.#camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 30000);
        this.#baseCamera = this.#camera;

        /**@type {THREE.WebGLRendererParameters} */
        const webGLRendererParameters = {
            logarithmicDepthBuffer: true,
            powerPreference: "high-performance",
        };
        if (domElement instanceof HTMLCanvasElement) {
            webGLRendererParameters.canvas = domElement;
        } else if (domElement instanceof HTMLElement) {
            const canvas = document.createElement("canvas");
            webGLRendererParameters.canvas = canvas;
            domElement.appendChild(canvas);
        } else {
            const canvas = document.createElement("canvas");
            webGLRendererParameters.canvas = canvas;
            document.body.appendChild(canvas);
        }
        this.#domElement = webGLRendererParameters.canvas;
        this.#domElement.oncontextmenu = e => false;

        this.#renderer = new THREE.WebGLRenderer(webGLRendererParameters);
        this.#renderer.setSize(innerWidth, innerHeight);
        this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.#renderer.shadowMap.enabled = DEFAULT.shadow.enabled;
        this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.#renderer.setPixelRatio(devicePixelRatio);
        this.#renderer.domElement.removeAttribute("data-engine");
        // todo 背景透明
        this.#renderer.setClearColor(0x000000, 0);

        this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
        this.#controls.data = {};
        this.#controls.target.set(0, 0, 0);
        this.#onRenderQueue.set(Symbol(), () => this.#controls.update());

        // 控制器初始化会改变相机的位置。
        this.#camera.position.set(...DEFAULT.camera.position);
        this.#camera.lookAt(0, 0, 0);

        this.#initLight();

        document.oncontextmenu = () => false;

        window.addEventListener("resize", () => {
            const { innerWidth, innerHeight } = window;

            this.#camera.aspect = innerWidth / innerHeight;
            this.#camera.updateProjectionMatrix();
            this.#renderer.setSize(innerWidth, innerHeight);

            this.#onresizeQueue.forEach(fn => fn(innerWidth, innerHeight));
        });
        // this.initStats();
    }

    #initLight() {
        this.#ambientLight = new THREE.AmbientLight();
        this.#scene.add(this.#ambientLight);

        this.#directionalLight = new THREE.DirectionalLight();
        this.#scene.add(this.#directionalLight);
    }

    /**@param {THREE.Scene} scene 设置默认灯光*/
    setDefaultLight(scene) {
        scene._add(this.#ambientLight.clone(), this.#directionalLight.clone());
    }

    initComposer() {
        this.#postprocessing = new Postprocessing(this.#renderer, this.#scene, this.#camera);
        this.#onresizeQueue.set(Symbol(), this.#postprocessing.resize);
    }

    initStats() {
        this.#stats = new Stats();
        document.body.appendChild(this.#stats.dom);

        this.#onRenderQueue.set(Symbol(), param => param.#stats.update());
    }
    initGridHelper() {
        const gridHelper = new THREE.GridHelper(100);
        this.#scene.add(gridHelper);
    }
    initAxesHelper() {
        const axesHelper = new THREE.AxesHelper(100);
        this.#scene.add(axesHelper);
    }

    animate = () => {
        this.delta = this.clock.getDelta();

        this.#onRenderQueue.forEach(fn => fn(this));

        // this.logMemory();

        this.render();
    };

    logMemory() {
        console.log(this.#renderer.info.memory.geometries, this.#renderer.info.memory.textures);
    }

    render() {
        if (this.#postprocessing) {
            this.#postprocessing.composer.render();
        } else {
            this.#renderer.render(this.#scene, this.#camera);
        }
    }

    setRenderState = state => {
        const _state = !!state;
        this.#renderer.setAnimationLoop(_state ? this.animate : null);
        this.#controls.enabled = _state;
        this.#renderEnabled = _state;
    };
}
