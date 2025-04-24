import { CoreExtensions } from "./core/CoreExtensions";

import { updateTime } from "../shader/constant";
import { openMessage } from "../message/onMessage";
import { onLoaded } from "../message/postMessage";
import { getData } from "./data/format";
import { HeatSource } from "./subsystem/heatsource";

const timeUpdate = Symbol("timeUpdate");

export class Core3D extends CoreExtensions {
    constructor(domElement) {
        super(domElement);

        this.currentSystem = null;
        this.currentSystemName = "";
        this.currentSystemInfo = {
            type: null,
            id: null,
            deviceInfo: null,
        };
        this.firstLoad = true;
    }

    init() {
        // 添加CSS2DRenderer
        this.initCSS2DRenderer();
        this.initCSS3DRenderer();

        // 添加后处理
        this.initComposer();

        openMessage(this);
        this.beginRender();
    }

    beginRender() {
        if (this.renderEnabled) return;
        if (this.firstLoad) {
            this.setClass();
            this.firstLoad = false;
        } else {
        }
        this.setRenderState(true);
    }

    setClass() {
        this.heatSource = new HeatSource(this); // 热源系统
        this.onRenderQueue.set(timeUpdate, scope => updateTime(scope.delta));
        this.changeSystem("heatSource");
    }

    /**
     * @description 各个系统模块切换
     * @param {string} systemType 系统标识符
     */
    async changeSystem(systemType, info) {
        this.currentSystemInfo = {
            type: null,
            id: null,
            deviceInfo: null,
        };
        const targetSystem = this[systemType];

        const currentSystem = this.currentSystem;

        // 如果目标系统不存在,直接返回,判定目标系统加载完成。
        if (!targetSystem) {
            console.warn(`${systemType}子系统未初始化`);
            return;
        }

        if (currentSystem) {
            // 如果目标系统和当前系统相同，直接返回。
            // if (targetSystem === currentSystem) return; // 会有同场景数据变化情况

            // 当前系统执行离开事件。
            currentSystem.onLeave();
        }

        // 切换渲染的场景
        this.changeScene(targetSystem.scene);

        // 更改当前系统为目标系统
        this.currentSystem = targetSystem;
        this.currentSystemName = systemType;

        // 当前系统执行进入事件，返回Promise。
        await targetSystem.onEnter();

        // 在模型加载完成。将格式化后的场景数据传输到前端。
        onLoaded(getData(this));
    }

    changeScene(scene) {
        this.scene = scene;
    }
    deviceManage(status) {
        this.heatSource.updateDataInfo(status);
    }

    updateSubSystemInfo(info, status) {
        // 当前子系统的展示 主扇/局扇/风门/风窗/测风
        if (status === "remove") {
            this.currentSystem.updateDataInfo(info, status); // 更新当前子系统的数据
        } else {
            this.currentSystem.updateDataInfo(info.deviceInfo, status); // 更新当前子系统的数据
        }
    }

    resetCamera() {
        this.currentSystem.resetCamera();
    }

    stopRender() {
        this.setRenderState(false);
        this.currentSystem.onLeave();
    }
}
