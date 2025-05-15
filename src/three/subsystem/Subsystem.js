import { GridHelper, AxesHelper, AnimationMixer, AnimationAction, Sphere, PerspectiveCamera } from "three";
import { SubScene } from "../../three/scene/SubScene";
import { Core3D } from "..";

/**@classdesc 子系统 */
export class Subsystem {
    /**
     * @param {Core3D} core
     */
    constructor(core) {
        //
        this.core = core;
        this.scene = new SubScene();
        this.scene.name = "Scene";
        this.camera = core.camera;
        this.controls = core.controls;
        this.baseCamera = core.baseCamera;
        this.onRenderQueue = core.onRenderQueue;

        /**@type {AnimationMixer[]} 动画混合器数组 */
        this.mixers = [];

        /**@type {AnimationAction[]} 动画实例数组 */
        this.actions = [];

        this.uncaches = [];

        /**@type {Sphere} 相机限制球*/
        this.cameraLimitSphere = null;

        /**@type {Sphere} 控制器限制球*/
        this.controlsLimitSphere = null;
    }

    /**
     * 设置相机和控制器的包围球
     * @param {Sphere} sphere 相机包围球
     * @param {number} [offset=100] 控制器的包围球半径 = sphere.radius - offset
     */
    setSphere(sphere, offset = 100) {
        this.cameraLimitSphere = sphere;
        this.controlsLimitSphere = new Sphere(sphere.center, sphere.radius - offset);
    }

    limitInSphere = () => {
        if (this.cameraLimitSphere && this.camera && this.controls) {
            const position = this.camera.position;
            const target = this.controls.target;
            position.clampSphere(this.cameraLimitSphere);
            target.clampSphere(this.controlsLimitSphere);
            position.y = position.y < 0 ? 0 : position.y;
            target.y = target.y < 0 ? 0 : target.y;
        }
    };

    /**子系统初始化 */
    init() {}

    /**进入子系统执行的回调函数,涉及加载模型,返回Promise。在此执行的操作，希望在离开场景时取消这些操作，以防止内存泄漏。 */
    async onEnter() {}

    /**离开子系统执行的回调函数。希望在此取消那些在进入场景时执行的操作，以防止内存泄漏。 */
    onLeave() {}

    /**子系统模型加载完成执行的回调函数 */
    onLoaded() {}

    /**子系统执行在动画帧中函数 */
    update() {}

    /**子系统添加事件监听 */
    addEvents() {}

    /**子系统移除事件监听 */
    removeEvents() {}

    /**切换子系统灯光（前提是子系统调用了天气模块） */
    changeWeather() {
        console.log("当前子系统未调用天气模块");
    }

    /**切换子系统灯光（前提是子系统调用了天气模块） */
    updateLightingPattern() {
        console.log("当前子系统未调用天气模块");
    }

    /**设置子系统相机漫游状态 */
    setCameraState() {
        console.log("当前子系统没有相机漫游功能");
    }

    /**获取相机漫游控制函数,通过processing函数处理后添加 */
    useCameraState() {
        console.log("没有相机漫游模型");
    }

    /**开启子系统第一人称漫游 */
    beginWander() {
        console.log("当前子系统没有第一人称漫游功能");
    }

    /**
     * @description 设置设备状态
     * @param {boolean} state
     * @param {number} code 设备编号
     */
    setEquipmentState(state, code) {
        console.log("当前子系统没有设备状态控制");
    }

    /**关闭子系统第一人称漫游 */
    endWander() {
        console.log("当前子系统没有第一人称漫游功能");
    }

    initGridHelper(l = 100) {
        const gridHelper = new GridHelper(l);
        this.scene.add(gridHelper);
    }

    initAxesHelper(l = 100) {
        const axesHelper = new AxesHelper(l);
        this.scene.add(axesHelper);
    }

    /**@description 清除动画混合器 *

    /**@description 设置所有动画状态 */
    playActions() {
        this.actions.forEach(action => action.play());
    }

    /**@description 设置动画播放状态，true 播放所有动画，false 停止所有动画 */
    setActionsState(state) {
        this.actions.forEach(action => (action.paused = !state));
    }

    /**更新动画混合器 */
    updateMixers(delta) {
        this.mixers.forEach(mixer => mixer.update(delta));
    }

    clearMixers() {
        // 清除动画
        this.uncaches.forEach(fn => fn());
        this.uncaches.length = 0;
        this.actions.length = 0;
        this.mixers.length = 0;
    }

    add() {
        this.scene.add(...arguments);
    }

    _add() {
        this.scene._add(...arguments);
    }

    dispose() {
        this.scene.dispose();
    }
}
