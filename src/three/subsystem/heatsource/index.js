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
import { shaderModify, changeEdgeFadeWidth, changeEdgeFadeDistance } from "../../../shader/shaderModify";
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
        this.defaultCameraPosition = {x: -9.727132849301427, y: 49.603588976490755, z: 162.0844374055427}
        this.defaultControlsTarget = {x: -175.7911564311957, y: 13.750290410418177, z: -11.394121982750669}

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
        if (this.css2d && typeof this.css2d.visible !== "undefined") {
            this.css2d.visible = false;
        }
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
        this.roamingTweens = []; // 存储所有漫游相关的动画
        this.deviceOverlays = {}; // 存储设备透明罩子
        this.shaderColor = {
            wall: new THREE.Color(0.4431, 0.4784, 0.502),
            shan: new THREE.Color(0.9569, 0.9843, 0.5882),
            dian: new THREE.Color(0.0588, 0.1373, 0.9686),
            skinCheck: new THREE.Color(0.2275, 0.9961, 0.7922),
        };
        // this.scene.fog = new THREE.Fog("#CDD3D6", 320, 800); // 启用雾气

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
        // this.roamingBuildingOpacity = 0.2; // 漫游时建筑透明度
        // this.createDiv();
        openWebsocket(this);
    }

    /**
     * 为地面材质应用边缘虚化效果
     * @param {THREE.Material} material - 地面材质
     */
    applyGroundEdgeFade(material) {
        if (!material) {
            return;
        }

        // 确保材质支持透明度
        material.transparent = true;
        material.alphaTest = 0.1;

        // 设置适合地面的边缘虚化参数
        changeEdgeFadeWidth(100.0); // 较大的虚化宽度，适合地面
        changeEdgeFadeDistance(60.0); // 较大的非虚化区域

        // 应用边缘虚化着色器
        material.onBeforeCompile = shader => {
            shaderModify(shader, {
                shader: "edgeFadeUV",
            });
        };

        // 强制更新材质
        material.needsUpdate = true;

        console.log("已为地面材质 '地面_Moss003_1K-JPG' 应用边缘虚化效果");
    }

    /**
     * 动态调整地面边缘虚化参数
     * @param {number} width - 虚化宽度
     * @param {number} distance - 非虚化区域
     */
    updateGroundEdgeFade(width = 100.0, distance = 60.0) {
        changeEdgeFadeWidth(width);
        changeEdgeFadeDistance(distance);
        console.log(`地面边缘虚化参数已更新: 宽度=${width}, 距离=${distance}`);
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
                // 检查是否点击到了设备
                let { hasCocaCola, returnData } = this.traverFromParent(intersects[0].object);
                if (hasCocaCola) {
                    this.doHandel(returnData.name);
                } else {
                    // 点击到任意位置都隐藏css2d
                    if (this.css2d && typeof this.css2d.visible !== "undefined") {
                        this.css2d.visible = false;
                    }
                }
            } else {
                // 没有点击到任何对象时也隐藏css2d
                if (this.css2d && typeof this.css2d.visible !== "undefined") {
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
        // 先禁用控制器，避免参数设置时立即调整相机位置
        this.controls.enabled = false;
        // 创建相机位置动画
        const cameraTween = new TWEEN.Tween(this.camera.position)
            .to(this.defaultCameraPosition, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                // 动画完成后重新启用控制器
                this.controls.enabled = true;
            });

        // 创建目标点动画
        const targetTween = new TWEEN.Tween(this.controls.target)
            .to(this.defaultControlsTarget, 1000)
            .easing(TWEEN.Easing.Cubic.InOut);

        // 同时开始两个动画
        cameraTween.start();
        targetTween.start();

        if (this.css2d && typeof this.css2d.visible !== "undefined") {
            this.css2d.visible = false;
        }
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
                        // 确保材质支持透明度，用于漫游时的隐藏/显示动画
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

                    // 为地面材质添加边缘虚化效果
                    if (
                        child.material &&
                        (child.material.name === "地面_Moss003_1K-JPG" ||
                            child.material.name === "路_Asphalt020L_1K-JPG")
                    ) {
                        this.applyGroundEdgeFade(child.material);
                    }
                }
            });
        }
        if (name === "other") {
            gltf.scene.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.renderOrder = 2;
                    child.castShadow = true;
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
            // this.jixiebi[id].model.scale.set(100, 100, 100);
            status ? this.jixiebi[id].action.play() : this.jixiebi[id].action.stop();
        }
    }

    changeDevice(id, status) {
        //  切换设备状态
        let color = this.statusColor[status];
        this.createDom(id);
        if (this.modelsEquip[id]) {
            // 移除旧的透明罩子
            this.removeDeviceOverlay(id);
            
            // 创建新的透明罩子
            this.createDeviceOverlay(id, color);
        }
    }

    /**
     * 为设备创建透明罩子
     * @param {string} deviceId 设备ID
     * @param {string} color 颜色
     */
    createDeviceOverlay(deviceId, color) {
        const device = this.modelsEquip[deviceId];
        if (!device) return;

        // 计算设备包围盒
        const box = new THREE.Box3().setFromObject(device);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 创建包围盒几何体，稍微放大一点
        const geometry = new THREE.BoxGeometry(
            size.x * 1.1, 
            size.y * 1.1, 
            size.z * 1.1
        );

        // 创建透明材质
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false, // 避免深度写入问题
        });

        // 创建透明罩子
        const overlay = new THREE.Mesh(geometry, material);
        overlay.position.copy(center);
        overlay.name = `deviceOverlay_${deviceId}`;
        
        // 添加到场景
        this.add(overlay);
        
        // 保存引用以便后续移除
        if (!this.deviceOverlays) {
            this.deviceOverlays = {};
        }
        this.deviceOverlays[deviceId] = overlay;
    }

    /**
     * 移除设备的透明罩子
     * @param {string} deviceId 设备ID
     */
    removeDeviceOverlay(deviceId) {
        if (this.deviceOverlays && this.deviceOverlays[deviceId]) {
            this.remove(this.deviceOverlays[deviceId]);
            this.deviceOverlays[deviceId].geometry.dispose();
            this.deviceOverlays[deviceId].material.dispose();
            delete this.deviceOverlays[deviceId];
        }
    }

    switchScene(obj) {
        if (obj === this.switchSceneObj.name) {
            return false;
        }
        if (this.switchSceneObj.object3d) {
            this.changeSceneObjVisible(this.switchSceneObj.object3d, true, obj);
        }
        if (this.css2d && typeof this.css2d.visible !== "undefined") {
            this.css2d.visible = false;
        }
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
                if (this.css2d && typeof this.css2d.deleteSelf === "function") {
                    this.css2d.deleteSelf();
                }
                postWeb3dDeviceCode(deviceId);
                const newCss2d = this.createDom(deviceId);
                if (!newCss2d) {
                    this.css2d = null;
                    return false;
                }
                this.css2d = newCss2d;
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
                    if (this.css2d && typeof this.css2d.visible !== "undefined") {
                        this.css2d.visible = false;
                    }
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

        // 清理设备透明罩子
        if (this.deviceOverlays) {
            Object.keys(this.deviceOverlays).forEach(deviceId => {
                this.removeDeviceOverlay(deviceId);
            });
            this.deviceOverlays = {};
        }

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

        // 确保渲染器阴影设置正确
        this.core.renderer.shadowMap.enabled = true;
        this.core.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.core.renderer.shadowMap.autoUpdate = true;

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

        this.addLight(vec, center);
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
        // 平行光
        const directionalLight = new THREE.DirectionalLight(0xffedcc, 1.5);
        directionalLight.position.set(8, 15, -3.6); // 调整光源方向
        directionalLight.target.position.set(0, 0, 0); // 指向地面中心
        directionalLight.castShadow = true; // 启用阴影
        // 特殊日光阴影参数
        directionalLight.shadow.camera.left = -200; //视野内15米投射阴影
        directionalLight.shadow.camera.right = 200;
        directionalLight.shadow.camera.top = 200;
        directionalLight.shadow.camera.bottom = -200;
        directionalLight.shadow.camera.near = 0; //距光源1开始阴影
        directionalLight.shadow.camera.far = 200; //距光源50结束阴影
        directionalLight.shadow.camera.updateProjectionMatrix();
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.radius = 1.1;
        directionalLight.shadow.bias = -0.002;
        this.add(directionalLight.target);
        this.add(directionalLight);
    }

    /**
     * 初始化漫游路径
     * 定义厂区内的漫游路线点 - 优化减少眩晕感
     */
    initRoamingPath() {
        if (!this.ground) return;

        const { center, radius } = getBoxAndSphere(this.ground).sphere;

        // 沿着厂房周围漫游，扩大范围，围绕厂区外围
        this.roamingPath = [
            // 起始点 - 厂区入口视角（扩大范围到外围）
            {
                position: new THREE.Vector3(center.x - radius * 1.8, center.y + radius * 0.5, center.z - radius * 1.8),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 5000,
            },
            // 第一个观察点 - 机加车间外围视角
            {
                position: new THREE.Vector3(center.x - radius * 1.5, center.y + radius * 0.6, center.z - radius * 0.8),
                target: new THREE.Vector3(center.x - radius * 0.5, center.y, center.z - radius * 0.5),
                duration: 4500,
            },
            // 第二个观察点 - 压铸车间外围视角
            {
                position: new THREE.Vector3(center.x + radius * 0.5, center.y + radius * 0.6, center.z - radius * 1.5),
                target: new THREE.Vector3(center.x + radius * 0.5, center.y, center.z - radius * 0.5),
                duration: 4500,
            },
            // 第三个观察点 - 设备区域外围视角
            {
                position: new THREE.Vector3(center.x + radius * 1.5, center.y + radius * 0.5, center.z + radius * 0.8),
                target: new THREE.Vector3(center.x + radius * 0.5, center.y, center.z + radius * 0.3),
                duration: 4500,
            },
            // 第四个观察点 - 高空俯视视角（扩大范围）
            {
                position: new THREE.Vector3(center.x, center.y + radius * 1.5, center.z + radius * 1.5),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 5000,
            },
            // 第五个观察点 - 机械臂区域外围视角
            {
                position: new THREE.Vector3(center.x - radius * 1.0, center.y + radius * 0.5, center.z + radius * 1.5),
                target: new THREE.Vector3(center.x - radius * 0.5, center.y, center.z + radius * 0.5),
                duration: 4500,
            },
            // 第六个观察点 - 侧视角度外围
            {
                position: new THREE.Vector3(center.x - radius * 1.5, center.y + radius * 0.4, center.z + radius * 0.5),
                target: new THREE.Vector3(center.x - radius * 0.3, center.y, center.z + radius * 0.2),
                duration: 4500,
            },
            // 第七个观察点 - 厂房后方外围视角
            {
                position: new THREE.Vector3(center.x - radius * 0.8, center.y + radius * 0.4, center.z + radius * 1.8),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 4500,
            },
            // 第八个观察点 - 厂房右侧外围视角
            {
                position: new THREE.Vector3(center.x + radius * 1.8, center.y + radius * 0.4, center.z - radius * 0.5),
                target: new THREE.Vector3(center.x + radius * 0.3, center.y, center.z),
                duration: 4500,
            },
            // 回到起始点（更平滑的回归）
            {
                position: new THREE.Vector3(center.x - radius * 1.8, center.y + radius * 0.5, center.z - radius * 1.8),
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: 5000,
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

        // 立即切换到漫游起始点
        const startPoint = this.roamingPath[0];
        this.camera.position.copy(startPoint.position);
        this.controls.target.copy(startPoint.target);

        // 短暂延迟后开始漫游，让用户适应新的视角
        setTimeout(() => {
            // 从第二个路径点开始漫游（跳过起始点）
            this.currentPathIndex = 1;
            this.moveToNextPathPoint();
        }, 500);

        console.log("开始场景漫游");
    }

    /**
     * 停止场景漫游
     */
    stopRoaming() {
        if (!this.isRoaming) return;

        this.isRoaming = false;

        // 停止所有漫游相关的动画
        if (this.roamingTween) {
            this.roamingTween.stop();
            this.roamingTween = null;
        }

        // 停止所有保存的漫游动画
        this.roamingTweens.forEach(tween => {
            if (tween) {
                tween.stop();
            }
        });
        this.roamingTweens = [];

        // 恢复控制器
        this.controls.enabled = true;

        // 恢复建筑透明度
        this.restoreBuildingForRoaming();

        // 恢复到默认视角位置
        this.handleControls();

        console.log("停止场景漫游");
    }

    /**
     * 移动到下一个路径点 - 优化减少眩晕感
     */
    moveToNextPathPoint() {
        if (!this.isRoaming || this.currentPathIndex >= this.roamingPath.length) {
            // 漫游完成，重新开始
            this.currentPathIndex = 0;
        }

        const pathPoint = this.roamingPath[this.currentPathIndex];

        // 根据当前相机位置到目标位置的距离动态计算时间
        const distance = this.camera.position.distanceTo(pathPoint.position);
        const dynamicDuration = Math.max(1000, distance * 50); // 最小1秒，每单位距离50ms

        // 使用更平滑的缓动函数，减少突兀的加速减速
        this.roamingTween = new TWEEN.Tween(this.camera.position)
            .to(pathPoint.position, dynamicDuration)
            .easing(TWEEN.Easing.Cubic.InOut) // 使用Cubic.InOut，更平滑的过渡
            .onComplete(() => {
                // 移动到下一个点
                this.currentPathIndex++;
                if (this.isRoaming) {
                    // 添加短暂停顿，让用户有时间观察当前视角
                    setTimeout(() => {
                        this.moveToNextPathPoint();
                    }, 1000); // 1秒停顿
                }
            });

        // 创建控制器目标点动画，使用相同的动态时间
        const targetTween = new TWEEN.Tween(this.controls.target)
            .to(pathPoint.target, dynamicDuration)
            .easing(TWEEN.Easing.Cubic.InOut);

        // 保存所有漫游动画的引用
        this.roamingTweens = [this.roamingTween, targetTween];

        // 开始所有动画
        this.roamingTween.start();
        targetTween.start();
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

        // 转换为漫游路径格式，根据距离动态计算时间
        this.roamingPath = points.map((point, index) => {
            let duration = 2000; // 默认持续时间
            
            // 如果不是第一个点，根据与前一个点的距离计算时间
            if (index > 0) {
                const prevPoint = points[index - 1];
                const distance = point.distanceTo(prevPoint);
                // 根据距离计算时间，保持匀速（每单位距离对应固定时间）
                duration = Math.max(1000, distance * 50); // 最小1秒，每单位距离50ms
            }
            
            return {
                position: point,
                target: new THREE.Vector3(center.x, center.y, center.z),
                duration: duration,
            };
        });
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

        // 立即切换到漫游起始点
        const startPoint = this.roamingPath[0];
        this.camera.position.copy(startPoint.position);
        this.controls.target.copy(startPoint.target);

        // 短暂延迟后开始平滑漫游，让用户适应新的视角
        setTimeout(() => {
            // 从第二个路径点开始漫游（跳过起始点）
            this.currentPathIndex = 1;
            this.moveToNextSmoothPoint();
        }, 500);

        console.log("开始平滑漫游");
    }

    /**
     * 移动到下一个平滑路径点 - 优化减少眩晕感
     */
    moveToNextSmoothPoint() {
        if (!this.isRoaming || this.currentPathIndex >= this.roamingPath.length) {
            // 漫游完成，重新开始
            this.currentPathIndex = 0;
        }

        const pathPoint = this.roamingPath[this.currentPathIndex];

        // 根据当前相机位置到目标位置的距离动态计算时间
        const distance = this.camera.position.distanceTo(pathPoint.position);
        const dynamicDuration = Math.max(1000, distance * 50); // 最小1秒，每单位距离50ms

        // 创建相机位置动画，使用更平滑的缓动
        this.roamingTween = new TWEEN.Tween(this.camera.position)
            .to(pathPoint.position, dynamicDuration)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                // 移动到下一个点
                this.currentPathIndex++;
                if (this.isRoaming) {
                    // 添加短暂停顿，让用户有时间观察当前视角
                    setTimeout(() => {
                        this.moveToNextSmoothPoint();
                    }, 1000); // 1秒停顿
                }
            });

        // 创建控制器目标点动画，使用相同的动态时间
        const targetTween = new TWEEN.Tween(this.controls.target)
            .to(pathPoint.target, dynamicDuration)
            .easing(TWEEN.Easing.Cubic.InOut);

        // 保存所有漫游动画的引用
        this.roamingTweens = [this.roamingTween, targetTween];

        // 开始所有动画
        this.roamingTween.start();
        targetTween.start();
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
     * 隐藏建筑外壳
     * @param {number} duration 动画持续时间
     */
    hideBuildingShells(duration = 800) {
        Object.values(this.buildingModels).forEach(building => {
            building.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    // 使用淡出动画隐藏建筑
                    new TWEEN.Tween(child.material)
                        .to({ opacity: 0 }, duration)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .onComplete(() => {
                            child.visible = false;
                        })
                        .start();
                }
            });
        });
    }

    /**
     * 显示建筑外壳
     * @param {number} duration 动画持续时间
     */
    showBuildingShells(duration = 800) {
        Object.values(this.buildingModels).forEach(building => {
            building.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    // 先设置为可见
                    child.visible = true;
                    // 使用淡入动画显示建筑
                    new TWEEN.Tween(child.material)
                        .to({ opacity: 1 }, duration)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .start();
                }
            });
        });
    }

    /**
     * 漫游开始时隐藏建筑外壳
     */
    setBuildingTransparentForRoaming() {
        this.hideBuildingShells(800);
    }

    /**
     * 漫游结束时显示建筑外壳
     */
    restoreBuildingForRoaming() {
        this.showBuildingShells(800);
    }
}
