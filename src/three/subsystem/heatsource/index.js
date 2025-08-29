import * as THREE from "three";
import * as TWEEN from "three/examples/jsm/libs/tween.module";
import { Subsystem } from "../Subsystem";
import { dracoLoaderGlb, loadOBJ } from "../../loader";
import { modelsList } from "@/assets/models";
import { Core3D } from "../..";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { processingCommonModel, processingAnimations } from "../../processing";
import { FlowLight } from "../../../lib/blMeshes";
import { PlatformCircle } from "../../../lib/PlatformCircle";
import { LabelEntity } from "../../../lib/LabelEntity";
import { shaderModify } from "../../../shader/shaderModify";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Reflector } from "../../../lib/Reflector";
import { getBoxAndSphere } from "../../../utils";
import BoxModel from "../../../lib/boxModel";
import { fresnelColorBlue } from "../../../shader/paramaters";
import MemoryManager from "../../../lib/memoryManager";
import { createCSS2DObject } from "./../../../lib/CSSObject";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { openWebsocket } from "../../../message/websocket";
import { TweenControls } from "../../../lib/tweenControls";
import { postWeb3dDeviceCode } from "../../../message/postMessage";

export const fan = Symbol();

// camera limit SPHERE

/**@type {OrbitControls} */
const controlsParameters = {
    maxPolarAngle: Math.PI / 2.2,
    // enablePan: false,
    // enableZoom: false
};

/**@classdesc 包含场景，子系统特有的功能，系统的切换（包含主场景和子场景切换） */
export class HeatSource extends Subsystem {
    /** @param {Core3D} core*/
    constructor(core) {
        super(core);
        new THREE.TextureLoader().load("./textures/sky/sunny.jpg", e => {
            this.core.scene.background = e;
            this.core.scene.backgroundRotation.setFromVector3(new THREE.Vector3(0, 0, 0));
        });
        this.glassMaterials = [];
        this.tweenControls = new TweenControls(this);
        this.modelsEquip = {}; // 设备模型 shuju
        this.statusColor = { 1: "#33ff33", 2: "#faa755", 3: "#a1a3a6", 4: "#ed1941" };
        this.buildingModels = {}; // 车间模型 shuju
        this.jixiebi = {}; // 机械臂模型 shuju
        this.webData = {}; // 存储的前端推送的数据
        this.css2ddoms = {};
        this.switchSceneObj = { name: "home", object3d: null }; // 存储的当前切换的对象模型
        this.actionsObj = {};
        this.rotateObj = null;
        this.css2d = this.createDefault();
        this.css2d.visible = false;
        this.add(this.css2d);
        this.boxModelObj = new BoxModel(core);
        this.postprocessing = core.postprocessing;
        this.elapsedTime = 0;
        this.labelGroup = new THREE.Group();
        this.canAnimate = true; // 是否可以动画

        /** @type {FlowLight[]} */
        this.flowLights = [];
        this.bloomLights = [];
        this.ground = null;
        this.raycastEvents = [];
        this.tweenCode = null;
        this.shaderColor = {
            wall: new THREE.Color(0.4431, 0.4784, 0.502),
            shan: new THREE.Color(0.9569, 0.9843, 0.5882),
            dian: new THREE.Color(0.0588, 0.1373, 0.9686),
            skinCheck: new THREE.Color(0.2275, 0.9961, 0.7922),
        };
        this.scene.fog = new THREE.FogExp2("ffffff", 0.0001); // 启用雾气

        // 漫游相关属性
        this.isRoaming = false; // 是否正在漫游
        this.roamingPath = []; // 漫游路径点
        this.currentPathIndex = 0; // 当前路径点索引
        this.roamingSpeed = 0.001; // 漫游速度
        this.roamingTween = null; // 漫游动画
        this.originalCameraPosition = null; // 原始相机位置
        this.originalControlsTarget = null; // 原始控制器目标点

        // 建筑透明度控制
        this.buildingMaterials = []; // 存储建筑材质
        this.originalBuildingOpacities = []; // 存储原始透明度
        this.originalBuildingTransparent = []; // 存储原始transparent属性
        this.roamingBuildingOpacity = 0.2; // 漫游时建筑透明度

        // this.createDiv();
        openWebsocket(this);
    }
    toDoDevice(device) {
        device.forEach(child => {
            const { deviceId, status } = child;
            if (deviceId) {
                this.controlsAnimate(deviceId, status);
            }
        });
    }
    createDiv() {
        let div = document.createElement("div");
        div.innerText = "A014动画运行";
        div.onclick = () => {
            this.controlsAnimate("A014", 1);
        };
        div.className = "animateFun";
        document.body.appendChild(div);

        let div2 = document.createElement("div");
        div2.innerText = "A014暂停动画";
        div2.onclick = () => {
            this.controlsAnimate("A014", -1);
        };
        div2.className = "animateFun2";
        document.body.appendChild(div2);

        let div3 = document.createElement("div");
        div3.innerText = "A014关闭";
        div3.onclick = () => {
            this.controlsAnimate("A014", 0);
        };
        div3.className = "animateFun3";
        document.body.appendChild(div3);

        // 漫游控制按钮
        let roamingStart = document.createElement("div");
        roamingStart.innerText = "开始漫游";
        roamingStart.onclick = () => {
            this.startRoaming();
        };
        roamingStart.className = "roamingFun";
        roamingStart.style.cssText =
            "position: fixed; top: 120px; right: 20px; background: #4CAF50; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(roamingStart);

        let roamingStop = document.createElement("div");
        roamingStop.innerText = "停止漫游";
        roamingStop.onclick = () => {
            this.stopRoaming();
        };
        roamingStop.className = "roamingFun2";
        roamingStop.style.cssText =
            "position: fixed; top: 160px; right: 20px; background: #f44336; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(roamingStop);

        let roamingPause = document.createElement("div");
        roamingPause.innerText = "暂停漫游";
        roamingPause.onclick = () => {
            this.pauseRoaming();
        };
        roamingPause.className = "roamingFun3";
        roamingPause.style.cssText =
            "position: fixed; top: 200px; right: 20px; background: #ff9800; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(roamingPause);

        let roamingResume = document.createElement("div");
        roamingResume.innerText = "恢复漫游";
        roamingResume.onclick = () => {
            this.resumeRoaming();
        };
        roamingResume.className = "roamingFun4";
        roamingResume.style.cssText =
            "position: fixed; top: 240px; right: 20px; background: #2196F3; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(roamingResume);

        // 速度控制
        let speedFast = document.createElement("div");
        speedFast.innerText = "加速";
        speedFast.onclick = () => {
            this.setRoamingSpeed(1.5);
        };
        speedFast.className = "speedFun";
        speedFast.style.cssText =
            "position: fixed; top: 280px; right: 20px; background: #9C27B0; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(speedFast);

        let speedSlow = document.createElement("div");
        speedSlow.innerText = "减速";
        speedSlow.onclick = () => {
            this.setRoamingSpeed(0.7);
        };
        speedSlow.className = "speedFun2";
        speedSlow.style.cssText =
            "position: fixed; top: 320px; right: 20px; background: #607D8B; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(speedSlow);

        // 平滑漫游按钮
        let smoothRoaming = document.createElement("div");
        smoothRoaming.innerText = "平滑漫游";
        smoothRoaming.onclick = () => {
            this.startSmoothRoaming();
        };
        smoothRoaming.className = "smoothRoamingFun";
        smoothRoaming.style.cssText =
            "position: fixed; top: 360px; right: 20px; background: #E91E63; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(smoothRoaming);

        // 路径可视化按钮
        let pathVisualization = document.createElement("div");
        pathVisualization.innerText = "显示路径";
        pathVisualization.onclick = () => {
            const pathLine = this.getPathVisualization();
            if (pathLine) {
                this.add(pathLine);
                // 3秒后自动移除
                setTimeout(() => {
                    this.remove(pathLine);
                }, 3000);
            }
        };
        pathVisualization.className = "pathVisualizationFun";
        pathVisualization.style.cssText =
            "position: fixed; top: 400px; right: 20px; background: #795548; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(pathVisualization);

        // 状态显示
        let statusDisplay = document.createElement("div");
        statusDisplay.id = "roamingStatus";
        statusDisplay.style.cssText =
            "position: fixed; top: 440px; right: 20px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; font-size: 12px; z-index: 1000;";
        document.body.appendChild(statusDisplay);

        // 建筑透明度控制按钮
        let buildingTransparent = document.createElement("div");
        buildingTransparent.innerText = "建筑透明";
        buildingTransparent.onclick = () => {
            this.setBuildingOpacity(0.2, 1000);
        };
        buildingTransparent.className = "buildingTransparentFun";
        buildingTransparent.style.cssText =
            "position: fixed; top: 480px; right: 20px; background: #00BCD4; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(buildingTransparent);

        let buildingOpaque = document.createElement("div");
        buildingOpaque.innerText = "建筑不透明";
        buildingOpaque.onclick = () => {
            this.restoreBuildingOpacity(1000);
        };
        buildingOpaque.className = "buildingOpaqueFun";
        buildingOpaque.style.cssText =
            "position: fixed; top: 520px; right: 20px; background: #FF5722; color: white; padding: 10px; border-radius: 5px; cursor: pointer; z-index: 1000;";
        document.body.appendChild(buildingOpaque);

        // 定期更新状态显示
        setInterval(() => {
            const status = this.getRoamingStatus();
            statusDisplay.innerHTML = `
                漫游状态: ${status.isRoaming ? "进行中" : "停止"}<br>
                当前点: ${status.currentIndex}/${status.totalPoints}<br>
                速度: ${status.speed.toFixed(2)}
            `;
        }, 1000);
    }
    controlsAnimate(id, status) {
        // 0:关闭 1:开启 -1:暂停
        if (!this.actionsObj[id]) {
            return;
        }
        this.actionsObj[id].forEach(action => {
            if (status == 0) {
                // 关闭
                action.paused = false;
                action.stop();
            }
            if (status == 1) {
                // 开启
                action.paused = false;
                action.play();
            }
            if (status == -1) {
                // 暂停
                action.paused = true;
                action.play();
            }
        });
    }
    createDefault() {
        let changeDom = document.getElementsByClassName("device-info-container-box")[0].cloneNode(true);
        const css2d = createCSS2DObject(changeDom);
        css2d.center.set(0.5, 1);
        css2d.scale.set(0.1, 0.1, 0.1);
        css2d.rotation.y = -Math.PI / 2;
        return css2d;
    }
    setEnvironment(type = "room", options = {}) {
        // 先清理现有环境
        this.clearEnvironment();

        switch (type) {
            case "room":
                // 使用 RoomEnvironment
                const pmremGenerator = new THREE.PMREMGenerator(this.core.renderer);
                this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.8).texture;
                // this.scene.background = SunnyTexture;
                console.log("已设置 RoomEnvironment");
                break;

            case "hdr":
                // 使用 HDR 环境贴图
                this.setHDRSky();
                break;

            case "default":
                // 使用默认环境
                // this.scene.background = SunnyTexture;
                console.log("已设置默认环境");
                break;

            default:
                console.warn(`未知的环境类型: ${type}`);
                break;
        }

        // 更新所有材质的环境贴图
        this.updateAllMaterialsEnvironment();
    }
    setHDRSky() {
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load("./hdr1.hdr", texture => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.environment = texture;
        });
    }
    /**
     * 更新所有材质的环境贴图
     */
    updateAllMaterialsEnvironment() {
        this.scene.traverse(object => {
            if (object.isMesh && object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        this.setupMaterialEnvironment(material);
                    });
                } else {
                    this.setupMaterialEnvironment(object.material);
                }
            }
        });
    }
    /**
     * 设置单个材质的环境贴图
     * @param {THREE.Material} material
     */
    setupMaterialEnvironment(material) {
        if (material && (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)) {
            if (this.scene.environment) {
                material.envMap = this.scene.environment;
                material.envMapIntensity = 0.8;
                material.needsUpdate = true;
            }
        }
    }
    /**
     * 清理环境贴图资源
     */
    clearEnvironment() {
        if (this.scene.environment) {
            this.scene.environment.dispose();
            this.scene.environment = null;
        }
        if (this.scene.background) {
            this.scene.background.dispose();
            this.scene.background = null;
        }
    }
    createDom(deviceId) {
        if (!this.webData[deviceId]) {
            return false;
        }
        if (!this.css2ddoms[deviceId]) {
            let changeDom = document.getElementsByClassName("device-info-container-box")[0].cloneNode(true);
            let titleName = changeDom.getElementsByClassName("jiexibiname"); // 标题名字
            let equipStatus = changeDom.getElementsByClassName("jixiebistatus"); // 状态文字
            this.getDomInfo(titleName, equipStatus, deviceId);

            const css2d = createCSS2DObject(changeDom);
            css2d.center.set(0.5, 1);
            css2d.scale.set(0.1, 0.1, 0.1);
            css2d.rotation.y = -Math.PI / 2;
            this.css2ddoms[deviceId] = css2d;
            return css2d;
        } else {
            let changeDom = this.css2ddoms[deviceId].element;
            let titleName = changeDom.getElementsByClassName("jiexibiname"); // 标题名字
            let equipStatus = changeDom.getElementsByClassName("jixiebistatus"); // 状态文字
            this.getDomInfo(titleName, equipStatus, deviceId);
            return this.css2ddoms[deviceId];
        }
    }

    getDomInfo(titleName, equipStatus, deviceId) {
        const { name, status } = this.webData[deviceId];
        const statusName = { 1: "正常", 2: "警报", 3: "停机", 4: "故障" };
        titleName[0].innerText = name; // dom元素赋值
        equipStatus[0].innerText = statusName[status];
        equipStatus[0].style.color = this.statusColor[status];
        return equipStatus;
    }

    traverFromParent(object3d) {
        let hasCocaCola = false;
        let returnData = null;
        if (object3d.type === "device") {
            returnData = object3d;
            hasCocaCola = true;
            return { hasCocaCola, returnData };
        }
        object3d.traverseAncestors(child => {
            if (child.type === "device") {
                returnData = child;
                hasCocaCola = true;
            }
        });
        return { hasCocaCola, returnData };
    }
    addEvents() {
        const { clear: clear, intersects } = this.core.raycast("click", Object.values(this.modelsEquip), () => {
            if (intersects.length) {
                let { hasCocaCola, returnData } = this.traverFromParent(intersects[0].object);
                if (hasCocaCola) {
                    this.doHandel(returnData.name);
                } else {
                    this.css2d.visible = false;
                }
            }
        });
        this.raycastEvents.push(clear);
        const { clear: clear2, intersects: intersects2 } = this.core.raycast(
            "mousemove",
            Object.values(this.modelsEquip),
            () => {
                if (intersects2.length) {
                    if (this.traverFromParent(intersects2[0].object)) {
                        this.outLineObj = intersects2[0].object;
                        document.body.style.cursor = "pointer";
                        this.postprocessing.addOutline(this.outLineObj);
                    } else {
                        this.postprocessing.clearAllOutline();
                        this.outLineObj = null;
                    }
                } else {
                    document.body.style.cursor = "default";
                    this.postprocessing.clearAllOutline();
                    this.outLineObj = null;
                }
            },
        );
        this.raycastEvents.push(clear2);
    }

    removeEvents() {
        this.raycastEvents.forEach(clear => clear());
        this.raycastEvents.length = 0;
    }

    handleControls() {
        Reflect.ownKeys(controlsParameters).forEach(key => {
            this.controls.data[key] = this.controls[key];
            this.controls[key] = controlsParameters[key];
        });
        const { center, radius } = getBoxAndSphere(this.ground).sphere;

        // Calculate camera position at center + 1.5 * radius
        const cameraPosition = new THREE.Vector3(center.x + radius, center.y + radius * 1, center.z + radius * 1.5);

        new TWEEN.Tween(this.camera.position).to(cameraPosition, 1000).start();

        // Animate camera target
        new TWEEN.Tween(this.controls.target).to(new THREE.Vector3(center.x - 32, center.y, center.z), 1000).start();
        this.css2d.visible = false;
    }

    resetControls() {
        this.controls.removeEventListener("change", this.limitInSphere);

        Reflect.ownKeys(controlsParameters).forEach(key => {
            this.controls[key] = this.controls.data[key];
        });
    }

    limitInSphere = () => {};

    async onEnter() {
        this.onRenderQueue.set(fan, this.update);

        await dracoLoaderGlb(modelsList, this.onProgress);

        this.onLoaded();
    }

    /**
     * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
string} name
     */
    onProgress = (gltf, name) => {
        if (name === "device") {
            let group = gltf.scene;
            group.children.forEach(child => {
                child.type = "device";
                this.modelsEquip[child.name] = child;
                if (this.webData[child.name]) {
                    this.changeDevice(child.name, this.webData[child.name].status);
                }
            });
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.renderOrder = 4;
                    child.castShadow = true;
                    child.material = child.material.clone();
                }
            });
        }
        if (name === "building") {
            let group = gltf.scene;
            this.ground = gltf.scene;
            let groupNmae = ["机加车间外壳", "压铸车间外壳"];
            group.children.forEach(child => {
                if (groupNmae.includes(child.name)) {
                    this.buildingModels[child.name] = child;
                }
            });
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.material = child.material.clone();
                    child.renderOrder = 3;
                    child.castShadow = true;

                    // 收集建筑材质用于透明度控制
                    if (child.material) {
                        this.buildingMaterials.push(child.material);
                        this.originalBuildingOpacities.push(child.material.opacity || 1.0);
                        this.originalBuildingTransparent.push(child.material.transparent || false);

                        if (child.name?.toLowerCase().includes("move")) {
                            if (child.material?.map) this.glassMaterials.push(child.material.map);
                            if (child.material?.emissiveMap) this.glassMaterials.push(child.material.emissiveMap);
                        }
                        // 确保材质支持透明度
                        // child.material.transparent = true;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }
        if (name === "机械臂") {
            let group = gltf.scene;
            group.children.forEach(child => {
                if (!this.jixiebi[child.name]) {
                    this.jixiebi[child.name] = {};
                }
                this.jixiebi[child.name].model = child;
            });
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.renderOrder = 4;
                    child.castShadow = true;
                }
            });
        }
        if (name === "地面") {
            gltf.scene.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.renderOrder = 0;
                    child.receiveShadow = true;
                }
            });
        }
        processingAnimations(gltf, this);
        this._add(gltf.scene);
    };
    init(_array) {
        // 初始化前端发送数据
        _array.forEach(child => {
            this.webData[child.id] = child; // 修改本地数据
            if (child.isArm) {
                // 机械臂的
                if (this.jixiebi[child.id] && this.jixiebi[child.id].action) {
                    child.armRun ? this.jixiebi[child.id].action.play() : this.jixiebi[child.id].action.stop();
                }
                this.changeArmAction(child.id, child.armRun);
            }
            this.changeDevice(child.id, child.status);
        });
    }
    updateArmStatus(_array) {
        // 更新机械臂的状态
        _array.forEach(child => {
            const { id, armRun } = child;
            if (!this.webData[id]) {
                return console.log("设备没有初始化");
            }
            this.webData[id].armRun = armRun; // 修改本地数据
            this.changeArmAction(id, armRun);
        });
    }
    updateDeviceStatus(_array) {
        // 更新机械臂的状态
        _array.forEach(child => {
            this.webData[child.id].status = child.status; // 修改本地数据
            this.changeDevice(child.id, child.status);
        });
    }

    changeArmAction(id, status) {
        // 切换机械臂的动作
        if (this.jixiebi[id] && this.jixiebi[id].action) {
            status ? this.jixiebi[id].action.play() : this.jixiebi[id].action.stop();
        }
    }

    changeDevice(id, status) {
        //  切换设备状态
        let color = this.statusColor[status];
        this.createDom(id);
        if (this.modelsEquip[id]) {
            this.modelsEquip[id].traverse(child => {
                if (child instanceof THREE.Mesh) {
                    // 确保每次调用时都重新应用材质
                    if (child.stateMaterial) {
                        child.material = child.stateMaterial.clone();
                    } else {
                        child.stateMaterial = child.material.clone();
                    }

                    child.material.onBeforeCompile = shader => {
                        shaderModify(shader, {
                            shader: "pumpModify",
                            color: new THREE.Color(color),
                            shaderName: "base",
                        });
                    };

                    // 强制更新材质
                    child.material.needsUpdate = true;
                }
            });
        }
    }

    switchScene(obj) {
        if (obj === this.switchSceneObj.name) {
            return false;
        }
        if (this.switchSceneObj.object3d) {
            this.changeSceneObjVisible(this.switchSceneObj.object3d, true, obj);
        }
        this.css2d.visible = false;
        if (!this.buildingModels[obj]) {
            // 首页 - 移除射线事件
            this.removeEvents();
            this.switchSceneObj.object3d = null;
            this.switchSceneObj.name = "home";
            this.handleControls();
            return false;
        }
        if (this.buildingModels[obj]) {
            // 子场景 - 添加射线事件
            this.addEvents();
            this.changeSceneObjVisible(this.buildingModels[obj], false, obj);
            this.switchSceneObj.object3d = this.buildingModels[obj];
            this.switchSceneObj.name = obj;
        }
    }
    changeSceneObjVisible(object3d, visible, name) {
        object3d.traverse(child => {
            if (child instanceof THREE.Mesh) {
                // 找到材质在buildingMaterials中的索引
                const materialIndex = this.buildingMaterials.indexOf(child.material);
                let originalTransparent = false;

                if (materialIndex !== -1) {
                    // 如果材质在buildingMaterials中，获取其原始transparent值
                    originalTransparent = this.originalBuildingTransparent[materialIndex] || false;
                } else {
                    // 如果不在buildingMaterials中，记录当前的transparent值
                    originalTransparent = child.material.transparent || false;
                }

                // 设置transparent为true以支持透明度动画
                child.material.transparent = true;
                child.material.needsUpdate = true;

                // Create tween for opacity
                const tween = new TWEEN.Tween(child.material).to({ opacity: visible ? 1 : 0 }, 1000).onComplete(() => {
                    // Set visibility after opacity transition
                    child.visible = visible;

                    // 当opacity还原为1时，恢复原始的transparent值
                    if (visible) {
                        child.material.transparent = originalTransparent;
                        child.material.needsUpdate = true;
                    }
                });

                // Start the tween
                tween.start();
            }
        });

        // Handle camera movement
        if (!visible) {
            // Calculate center of the object
            const { center, radius } = getBoxAndSphere(object3d).sphere;

            // Create camera position tween
            let cameraPosition = new THREE.Vector3(
                center.x + radius * (name === "机加车间外壳" ? 1 : -1), // Offset X
                center.y + radius, // Offset Y
                center.z + radius * 1.5, // Offset Z
            );
            // If name is "机加车间外壳", rotate camera position 180 degrees around Y axis
            // if (name === "压铸车间外壳") {
            //     let rel = { x: -262.9221109589206, y: 85.37329054298351, z: -22.310934207969385 };
            //     new TWEEN.Tween(this.camera.position).to(new THREE.Vector3(rel.x, rel.y, rel.z), 1000).start();
            // } else {
            //     new TWEEN.Tween(this.camera.position).to(cameraPosition, 1000).start();
            // }

            new TWEEN.Tween(this.camera.position).to(cameraPosition, 1000).start();
            // Animate camera target
            new TWEEN.Tween(this.controls.target).to(center, 1000).start();
        }
    }
    doHandel(deviceId) {
        // 使用 fetch 调用接口
        const { center, radius } = getBoxAndSphere(this.modelsEquip[deviceId]).sphere;
        const { max } = getBoxAndSphere(this.modelsEquip[deviceId]).box;
        debugger;
        this.tweenControls.changeTo({
            start: this.camera.position,
            end: {
                x: center.x + radius * 1.5,
                y: max.y + radius * 1.5,
                z: center.z,
            },
            duration: 1000,
        });
        this.tweenControls.changeTo({
            start: this.controls.target,
            end: center,
            duration: 1000,
            onComplete: () => {
                if (this.css2d) {
                    this.css2d.deleteSelf();
                }
                postWeb3dDeviceCode(deviceId);
                this.css2d = this.createDom(deviceId);
                if (!this.css2d) {
                    return false;
                }
                this.css2d.position.copy(new THREE.Vector3(center.x, max.y, center.z));
                this.css2d.visible = true;
                this.add(this.css2d);
            },
        });
    }
    queryFun(deviceId) {
        // 假设我们要从一个公共 API 获取用户数据
        const url = window.configs.baseUrl + `/api/digital/getDeviceDetailById/${deviceId}`;

        // 使用 fetch 调用接口
        fetch(url)
            .then(response => {
                // 检查响应是否成功
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                // 将响应解析为 JSON
                return response.json();
            })
            .then(data => {
                // 处理获取到的数据
                if (data.code === 200) {
                    this.doHandel(data.data, deviceId);
                } else {
                    this.css2d.visible = false;
                }
            });
    }

    onLeave() {
        this.removeEvents();
        this.resetControls();

        // 停止漫游并清理状态
        this.stopRoaming();
        this.roamingPath = [];
        this.currentPathIndex = 0;
        this.originalCameraPosition = null;
        this.originalControlsTarget = null;

        // 清理建筑透明度相关状态
        this.buildingMaterials = [];
        this.originalBuildingOpacities = [];
        this.originalBuildingTransparent = [];

        this.flowLights.length = 0;
        this.bloomLights.length = 0;
        this.postprocessing.bloomEffect.intensity = 1;

        this.onRenderQueue.delete(fan);
        if (this.labelGroup.children.length) {
            MemoryManager.dispose(this.labelGroup);
        }
    }

    onLoaded() {
        // 当前系统模型未加载完成时切换其他系统,将不会给前端发送信息,由目标系统发送信息。
        if (this.scene !== this.core.scene) return;
        this.postprocessing.addBloom(this.bloomLights);

        this.postprocessing.bloomEffect.intensity = 15;

        this.onRenderQueue.set(fan, this.update);
        this.setEnvironment("hdr");
        this.box();
        this.handleControls();

        // 初始化漫游路径
        this.initRoamingPath();
    }
    updateDataInfo(status) {
        if (!this.canAnimate) return false;
        let door = this.modelsEquip.GroupDoor;
        let drawer = this.modelsEquip.GroupDrawer;
        let cover = this.modelsEquip.GroupCover;
        let doorTo = status ? (-Math.PI * 3) / 4 : 0;
        let doorDuraction = status ? 0 : 1;
        this.canAnimate = false;
        const dooranimate = new TWEEN.Tween(door.rotation);
        dooranimate.to(
            {
                x: 0,
                y: doorTo,
                z: 0,
            },
            1000,
        );
        dooranimate.delay(doorDuraction * 1000);
        dooranimate.onComplete(() => {
            if (!status) {
                this.canAnimate = true;
            }
        });
        dooranimate.start();

        let drawTo = status ? 0.32 : 0;
        let drawerDuraction = status ? 1 : 0;
        const draweranimate = new TWEEN.Tween(drawer.position);
        draweranimate.to(
            {
                x: 0,
                y: 0,
                z: drawTo,
            },
            1000,
        );
        draweranimate.delay(drawerDuraction * 1000);
        draweranimate.onComplete(() => {
            if (status) {
                this.canAnimate = true;
            } else {
            }
        });
        draweranimate.start();
    }
    box() {
        const { center, radius } = getBoxAndSphere(this.ground).sphere;
        const vec = new THREE.Vector3(radius, radius, radius).multiplyScalar(1);
        const position = center.clone().add(vec);

        // this.addLight(vec, center);
    }
    /**
     * 设置设备状态
     * @param {boolean} state
     * @param {number} code 设备编号
     */
    setEquipmentState(state, code, direct) {}

    /**@param {Core3D} core  */
    update = core => {
        this.updateMixers(core.delta);
        this.elapsedTime += core.delta;

        // Update shader materials
        if (this.materialAnimations) {
            this.materialAnimations.forEach(material => {
                if (material.uniforms) {
                    material.uniforms.time.value = this.elapsedTime;
                }
            });
        }
        if (this.glassMaterials.length) {
            this.glassMaterials.forEach(map => {
                map.offset.x += -0.008;
            });
        }
        this.boxModelObj && this.boxModelObj.update(this.elapsedTime);
    };
    addLight(dev, center) {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.add(ambientLight);

        // 点光源一
        const pointLight1 = new THREE.PointLight(0xffffff, 0, 100, 2);
        pointLight1.position.set(0, 3, 1); // 设置光源位置
        pointLight1.castShadow = true; // 启用阴影
        this.add(pointLight1);
        const lightHelper1 = new THREE.Mesh(
            new THREE.SphereGeometry(0.05), // 小球尺寸
            new THREE.MeshBasicMaterial({ color: 0xcccccc }), // 球体颜色
        );
        lightHelper1.position.copy(pointLight1.position);
        this.add(lightHelper1);
        lightHelper1.visible = false; // 默认隐藏小球

        // 点光源二
        const pointLight2 = new THREE.PointLight(0xffffff, 0, 100, 2);
        pointLight2.position.set(0, 2, -1); // 设置光源位置
        pointLight2.castShadow = true; // 启用阴影
        this.add(pointLight2);
        const lightHelper2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.05), // 小球尺寸
            new THREE.MeshBasicMaterial({ color: 0xcccccc }), // 球体颜色
        );
        lightHelper2.position.copy(pointLight2.position);
        this.add(lightHelper2);
        lightHelper2.visible = false; // 默认隐藏小球

        // 平行光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.7);
        directionalLight.position.set(-10, 10, 10); // 调整光源方向
        directionalLight.target.position.set(0, 0, 0); // 指向地面中心
        directionalLight.castShadow = true; // 启用阴影
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 150;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.radius = 1.1;
        directionalLight.shadow.bias = -0.002;
        this.add(directionalLight.target);
        this.add(directionalLight);
        const dirLightHelper = new THREE.ArrowHelper(
            directionalLight.target.position.clone().sub(directionalLight.position).normalize(),
            directionalLight.position,
            1.5, // 箭头长度
            0xcccccc, // 箭头颜色
        );
        this.add(dirLightHelper);
        dirLightHelper.visible = false; // 默认隐藏箭头

        // 聚光灯
        const spotLight = new THREE.SpotLight(0xffffff, 1);
        spotLight.position.set(-2, 4, 2); // 调整光源位置
        spotLight.castShadow = true; // 启用阴影
        spotLight.penumbra = 0.6; // 边缘柔化程度
        const targetObj = new THREE.Object3D();
        targetObj.position.set(0, 0, 0);
        this.add(targetObj);
        spotLight.target = targetObj;
        this.add(spotLight);
        this.add(spotLight.target);
        const spotLightHelper = new THREE.ArrowHelper(
            targetObj.position.clone().sub(spotLight.position).normalize(),
            spotLight.position,
            1.5, // 箭头长度
            0xcccccc, // 箭头颜色
        );
        this.add(spotLightHelper);
        spotLightHelper.visible = false; // 默认隐藏箭头
    }

    /**
     * 初始化漫游路径
     * 定义厂区内的漫游路线点
     */
    initRoamingPath() {
        if (!this.ground) return;

        const { center, radius } = getBoxAndSphere(this.ground).sphere;

        // 定义漫游路径点 - 围绕厂区的关键位置
        this.roamingPath = [
            // 起始点 - 厂区入口视角
            {
                position: new THREE.Vector3(center.x - radius * 0.8, center.y + radius * 0.3, center.z - radius * 0.8),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 3000,
            },
            // 第一个观察点 - 机加车间视角
            {
                position: new THREE.Vector3(center.x - radius * 0.5, center.y + radius * 0.4, center.z - radius * 0.3),
                target: new THREE.Vector3(center.x - radius * 0.2, center.y, center.z - radius * 0.2),
                duration: 2500,
            },
            // 第二个观察点 - 压铸车间视角
            {
                position: new THREE.Vector3(center.x + radius * 0.3, center.y + radius * 0.4, center.z - radius * 0.4),
                target: new THREE.Vector3(center.x + radius * 0.2, center.y, center.z - radius * 0.2),
                duration: 2500,
            },
            // 第三个观察点 - 设备区域视角
            {
                position: new THREE.Vector3(center.x + radius * 0.6, center.y + radius * 0.3, center.z + radius * 0.2),
                target: new THREE.Vector3(center.x + radius * 0.3, center.y, center.z + radius * 0.1),
                duration: 2500,
            },
            // 第四个观察点 - 高空俯视视角
            {
                position: new THREE.Vector3(center.x, center.y + radius * 0.8, center.z + radius * 0.6),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 3000,
            },
            // 第五个观察点 - 机械臂区域视角
            {
                position: new THREE.Vector3(center.x - radius * 0.4, center.y + radius * 0.3, center.z + radius * 0.4),
                target: new THREE.Vector3(center.x - radius * 0.2, center.y, center.z + radius * 0.2),
                duration: 2500,
            },
            // 回到起始点
            {
                position: new THREE.Vector3(center.x - radius * 0.8, center.y + radius * 0.3, center.z - radius * 0.8),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 3000,
            },
        ];
    }

    /**
     * 开始场景漫游
     */
    startRoaming() {
        if (this.isRoaming) return;

        // 初始化路径
        if (this.roamingPath.length === 0) {
            this.initRoamingPath();
        }

        // 保存原始相机位置和控制器目标
        this.originalCameraPosition = this.camera.position.clone();
        this.originalControlsTarget = this.controls.target.clone();

        // 禁用控制器
        this.controls.enabled = false;

        this.isRoaming = true;
        this.currentPathIndex = 0;

        // 设置建筑透明
        this.setBuildingTransparentForRoaming();

        // 开始漫游
        this.moveToNextPathPoint();

        console.log("开始场景漫游");
    }

    /**
     * 停止场景漫游
     */
    stopRoaming() {
        if (!this.isRoaming) return;

        this.isRoaming = false;

        // 停止当前动画
        if (this.roamingTween) {
            this.roamingTween.stop();
            this.roamingTween = null;
        }

        // 恢复控制器
        this.controls.enabled = true;

        // 恢复建筑透明度
        this.restoreBuildingForRoaming();

        // 可选：回到原始位置
        if (this.originalCameraPosition && this.originalControlsTarget) {
            new TWEEN.Tween(this.camera.position).to(this.originalCameraPosition, 2000).start();

            new TWEEN.Tween(this.controls.target).to(this.originalControlsTarget, 2000).start();
        }

        console.log("停止场景漫游");
    }

    /**
     * 移动到下一个路径点
     */
    moveToNextPathPoint() {
        if (!this.isRoaming || this.currentPathIndex >= this.roamingPath.length) {
            // 漫游完成，重新开始
            this.currentPathIndex = 0;
        }

        const pathPoint = this.roamingPath[this.currentPathIndex];

        // 创建相机位置动画
        this.roamingTween = new TWEEN.Tween(this.camera.position)
            .to(pathPoint.position, pathPoint.duration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => {
                // 移动到下一个点
                this.currentPathIndex++;
                if (this.isRoaming) {
                    this.moveToNextPathPoint();
                }
            });

        // 创建控制器目标点动画
        new TWEEN.Tween(this.controls.target)
            .to(pathPoint.target, pathPoint.duration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

        // 开始相机动画
        this.roamingTween.start();
    }

    /**
     * 暂停漫游
     */
    pauseRoaming() {
        if (this.isRoaming && this.roamingTween) {
            this.roamingTween.pause();
        }
    }

    /**
     * 恢复漫游
     */
    resumeRoaming() {
        if (this.isRoaming && this.roamingTween) {
            this.roamingTween.resume();
        }
    }

    /**
     * 设置漫游速度
     * @param {number} speed 速度倍数 (0.5-2.0)
     */
    setRoamingSpeed(speed) {
        this.roamingSpeed = Math.max(0.5, Math.min(2.0, speed));

        // 更新当前动画的速度
        if (this.roamingTween) {
            this.roamingTween.timeScale = this.roamingSpeed;
        }
    }

    /**
     * 跳转到指定路径点
     * @param {number} index 路径点索引
     */
    jumpToPathPoint(index) {
        if (index < 0 || index >= this.roamingPath.length) return;

        // 停止当前动画
        if (this.roamingTween) {
            this.roamingTween.stop();
        }

        this.currentPathIndex = index;
        const pathPoint = this.roamingPath[index];

        // 直接跳转到指定点
        this.camera.position.copy(pathPoint.position);
        this.controls.target.copy(pathPoint.target);

        // 如果正在漫游，继续到下一个点
        if (this.isRoaming) {
            this.moveToNextPathPoint();
        }
    }

    /**
     * 获取当前漫游状态
     * @returns {object} 漫游状态信息
     */
    getRoamingStatus() {
        return {
            isRoaming: this.isRoaming,
            currentIndex: this.currentPathIndex,
            totalPoints: this.roamingPath.length,
            speed: this.roamingSpeed,
        };
    }

    /**
     * 创建贝塞尔曲线路径
     * 提供更平滑的漫游体验
     */
    createBezierPath() {
        if (!this.ground) return;

        const { center, radius } = getBoxAndSphere(this.ground).sphere;

        // 定义控制点
        const controlPoints = [
            // 起始点
            new THREE.Vector3(center.x - radius * 0.8, center.y + radius * 0.3, center.z - radius * 0.8),
            // 控制点1
            new THREE.Vector3(center.x - radius * 0.5, center.y + radius * 0.5, center.z - radius * 0.4),
            // 控制点2
            new THREE.Vector3(center.x + radius * 0.3, center.y + radius * 0.4, center.z - radius * 0.4),
            // 控制点3
            new THREE.Vector3(center.x + radius * 0.6, center.y + radius * 0.3, center.z + radius * 0.2),
            // 控制点4
            new THREE.Vector3(center.x, center.y + radius * 0.8, center.z + radius * 0.6),
            // 控制点5
            new THREE.Vector3(center.x - radius * 0.4, center.y + radius * 0.3, center.z + radius * 0.4),
            // 回到起始点
            new THREE.Vector3(center.x - radius * 0.8, center.y + radius * 0.3, center.z - radius * 0.8),
        ];

        // 创建贝塞尔曲线
        const curve = new THREE.CubicBezierCurve3(
            controlPoints[0],
            controlPoints[1],
            controlPoints[2],
            controlPoints[3],
        );

        // 生成路径点
        const points = curve.getPoints(50);

        // 转换为漫游路径格式
        this.roamingPath = points.map((point, index) => ({
            position: point,
            target: new THREE.Vector3(center.x, center.y, center.z),
            duration: 1000 + Math.random() * 500, // 随机化持续时间
        }));
    }

    /**
     * 开始平滑漫游
     */
    startSmoothRoaming() {
        if (this.isRoaming) return;

        // 创建贝塞尔曲线路径
        this.createBezierPath();

        // 保存原始相机位置和控制器目标
        this.originalCameraPosition = this.camera.position.clone();
        this.originalControlsTarget = this.controls.target.clone();

        // 禁用控制器
        this.controls.enabled = false;

        this.isRoaming = true;
        this.currentPathIndex = 0;

        // 设置建筑透明
        this.setBuildingTransparentForRoaming();

        // 开始平滑漫游
        this.moveToNextSmoothPoint();

        console.log("开始平滑漫游");
    }

    /**
     * 移动到下一个平滑路径点
     */
    moveToNextSmoothPoint() {
        if (!this.isRoaming || this.currentPathIndex >= this.roamingPath.length) {
            // 漫游完成，重新开始
            this.currentPathIndex = 0;
        }

        const pathPoint = this.roamingPath[this.currentPathIndex];

        // 创建相机位置动画，使用更平滑的缓动
        this.roamingTween = new TWEEN.Tween(this.camera.position)
            .to(pathPoint.position, pathPoint.duration)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                // 移动到下一个点
                this.currentPathIndex++;
                if (this.isRoaming) {
                    this.moveToNextSmoothPoint();
                }
            });

        // 创建控制器目标点动画
        new TWEEN.Tween(this.controls.target)
            .to(pathPoint.target, pathPoint.duration)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();

        // 开始相机动画
        this.roamingTween.start();
    }

    /**
     * 添加自定义漫游路径点
     * @param {THREE.Vector3} position 相机位置
     * @param {THREE.Vector3} target 目标点
     * @param {number} duration 动画持续时间
     */
    addCustomPathPoint(position, target, duration = 2000) {
        this.roamingPath.push({
            position: position.clone(),
            target: target.clone(),
            duration: duration,
        });
    }

    /**
     * 清除自定义路径
     */
    clearCustomPath() {
        this.roamingPath = [];
        this.currentPathIndex = 0;
    }

    /**
     * 设置循环漫游模式
     * @param {boolean} loop 是否循环
     */
    setLoopMode(loop) {
        this.loopMode = loop;
    }

    /**
     * 获取路径可视化对象（用于调试）
     * @returns {THREE.Line} 路径线条
     */
    getPathVisualization() {
        if (this.roamingPath.length === 0) return null;

        const points = this.roamingPath.map(point => point.position);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(geometry, material);

        return line;
    }

    /**
     * 设置建筑透明度
     * @param {number} opacity 透明度值 (0-1)
     * @param {number} duration 动画持续时间
     */
    setBuildingOpacity(opacity, duration = 1000) {
        this.buildingMaterials.forEach((material, index) => {
            // 设置transparent为true以支持透明度
            material.transparent = true;
            material.needsUpdate = true;

            new TWEEN.Tween(material).to({ opacity: opacity }, duration).easing(TWEEN.Easing.Quadratic.InOut).start();
        });
    }

    /**
     * 恢复建筑原始透明度
     * @param {number} duration 动画持续时间
     */
    restoreBuildingOpacity(duration = 1000) {
        this.buildingMaterials.forEach((material, index) => {
            const originalOpacity = this.originalBuildingOpacities[index] || 1.0;
            const originalTransparent = this.originalBuildingTransparent[index] || false;

            // 恢复原始的transparent属性
            material.transparent = originalTransparent;
            material.needsUpdate = true;

            new TWEEN.Tween(material)
                .to({ opacity: originalOpacity }, duration)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .start();
        });
    }

    /**
     * 漫游开始时设置建筑透明
     */
    setBuildingTransparentForRoaming() {
        this.setBuildingOpacity(this.roamingBuildingOpacity, 800);
    }

    /**
     * 漫游结束时恢复建筑透明度
     */
    restoreBuildingForRoaming() {
        this.restoreBuildingOpacity(800);
    }
}
