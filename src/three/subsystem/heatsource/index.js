import * as THREE from "three";
import * as TWEEN from "three/examples/jsm/libs/tween.module";
import { Subsystem } from "../Subsystem";
import { dracoLoaderGlb, loadOBJ } from "../../loader";
import { cabinet_models } from "@/assets/models";
import { Core3D } from "../..";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { processingCommonModel, processingAnimations } from "../../processing";

import { FlowLight } from "../../../lib/blMeshes";
import { PlatformCircle } from "../../../lib/PlatformCircle";
import { LabelEntity } from "../../../lib/LabelEntity";
import { shaderModify } from "../../../shader/shaderModify";
import { Reflector } from "../../../lib/Reflector";
import { getBoxAndSphere } from "../../../utils";
import BoxModel from "../../../lib/boxModel";
import { fresnelColorBlue } from "../../../shader/paramaters";
import MemoryManager from "../../../lib/memoryManager";
import { createCSS2DObject } from "./../../../lib/CSSObject";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { openWebsocket } from "../../../message/websocket";

export const fan = Symbol();

const position = new THREE.Vector3(16.709955120415408, 9.748082022315987, 14.263053804603231);
const target = new THREE.Vector3(4.3011208309073865, -1.7468282330790723, -0.5738608267187393);

// camera limit SPHERE
const SPHERE_CAMERA = new THREE.Sphere(new THREE.Vector3(), 88.2);
const SPHERE_CONTROLS = new THREE.Sphere(new THREE.Vector3(), 88.2);

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
        this.notTransparent = null;
        this.transparent = null;
        this.modelsEquip = {};
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
        let changeDom = document.getElementsByClassName("cabinet")[0].cloneNode(true);
        const css2d = createCSS2DObject(changeDom);
        css2d.center.set(0.5, 1);
        css2d.scale.set(0.1, 0.1, 0.1);
        css2d.rotation.y = -Math.PI / 2;
        return css2d;
    }
    setHD() {
        // HDR贴图
        const hdrPath = "./sky_texture.hdr";
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load(hdrPath, texture => {
            texture.mapping = THREE.EquirectangularReflectionMapping; // 改为反射映射
            texture.encoding = THREE.sRGBEncoding; // 确保编码正确
            this.scene.environment = texture;
            this.scene.background = texture;
        });
    }
    createDom(data) {
        const { deviceId, equipmentName, model, status, runTime, categories } = data;
        let changeDom = document.getElementsByClassName("cabinet")[0].cloneNode(true);
        let titleName = changeDom.getElementsByClassName("cabinetTitle"); // 标题名字
        let cabinetDot = changeDom.getElementsByClassName("cabinetDot"); // 状态点的
        let equipStatus = changeDom.getElementsByClassName("equipStatus"); // 状态文字
        let workTime = changeDom.getElementsByClassName("workTime"); // 运行时长
        let attributes = changeDom.getElementsByClassName("mainContent"); // 运行时长

        const statusColor = { 1: "#47C04C", 2: "#FFCC40", 3: "#FF4040" };
        const statusName = { 1: "运行", 2: "关闭", 3: "报警" };
        titleName[0].innerText = equipmentName + "." + model; // dom元素赋值
        titleName[0].title = equipmentName + "." + model; // dom元素赋值
        cabinetDot[0].style.background = statusColor[status] || "#47C04C";
        equipStatus[0].innerText = statusName[status];
        equipStatus[0].style.color = statusColor[status];
        workTime[0].innerText = "已运行" + runTime + "分钟";

        let ul = document.createElement("ul");
        attributes[0].append(ul);
        categories[0].itemData.forEach(child => {
            ul.innerHTML += `<li><div class="left" title=${child.itemName}(范围：${child.lowAlarmValue}~${child.highAlarmValue})>${child.itemName}(范围：${child.lowAlarmValue}~${child.highAlarmValue})</div><div class="right" title=当前：${child.itemValues}>当前：${child.itemValues}</div></li>`;
        });
        const css2d = createCSS2DObject(changeDom);
        css2d.center.set(0.5, 1);
        css2d.scale.set(0.1, 0.1, 0.1);
        css2d.rotation.y = -Math.PI / 2;
        return css2d;
    }

    traverFromParent(object3d, array) {
        let hasCocaCola = false;
        let returnData = null;
        object3d.traverseAncestors(child => {
            if (child.parent !== null && child.parent.name === "Scene") {
                returnData = child;
                hasCocaCola = true;
            }
        });
        return { hasCocaCola, returnData };
    }
    addEvents() {
        const { clear: clear, intersects } = this.core.raycast("click", Object.values(this.modelsEquip), () => {
            if (intersects.length) {
                const { hasCocaCola, returnData } = this.traverFromParent(intersects[0].object);
                if (hasCocaCola) {
                    this.queryFun(returnData.name.split("_")[0]);
                }
            } else {
                this.css2d.visible = false;
            }
        });
        this.raycastEvents.push(clear);
        const { clear: clear2, intersects: intersects2 } = this.core.raycast(
            "mousemove",
            Object.values(this.modelsEquip),
            () => {
                if (intersects2.length) {
                    if (this.traverFromParent(intersects2[0].object)) {
                        Object.values(this.modelsEquip).forEach(child => {
                            child.traverse(child => {
                                if (child instanceof THREE.Mesh) {
                                    if (child.oldMaterial) {
                                        child.material = child.oldMaterial;
                                        child.oldMaterial = null;
                                    }
                                }
                            });
                        });
                        document.body.style.cursor = "pointer";
                        intersects2[0].object.traverse(child => {
                            if (child instanceof THREE.Mesh) {
                                child.material = child.material.clone();
                                child.oldMaterial = child.material.clone();
                                child.material.transparent = true;
                                child.material.onBeforeCompile = shader => {
                                    shaderModify(shader, {
                                        shader: "pumpModify",
                                        color: fresnelColorBlue["淡紫色"].value,
                                        shaderName: "base",
                                    });
                                };
                            }
                        });
                    }
                } else {
                    document.body.style.cursor = "default";
                    Object.values(this.modelsEquip).forEach(child => {
                        child.traverse(child => {
                            if (child instanceof THREE.Mesh) {
                                if (child.oldMaterial) {
                                    child.material = child.oldMaterial;
                                    child.oldMaterial = null;
                                }
                            }
                        });
                    });
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
        this.controls.addEventListener("change", this.limitInSphere);
        this.camera.position.copy(position);
        this.controls.target.copy(target);
        Reflect.ownKeys(controlsParameters).forEach(key => {
            this.controls.data[key] = this.controls[key];
            this.controls[key] = controlsParameters[key];
        });
    }

    resetControls() {
        this.controls.removeEventListener("change", this.limitInSphere);

        Reflect.ownKeys(controlsParameters).forEach(key => {
            this.controls[key] = this.controls.data[key];
        });
    }

    limitInSphere = () => {
        this.camera.position.clampSphere(SPHERE_CAMERA);
        this.controls.target.clampSphere(SPHERE_CONTROLS);
        const { center, radius } = getBoxAndSphere(this.ground).sphere;
        let distance = this.camera.position.distanceTo(center);
        this.transparent.visible = distance < 32;
        this.notTransparent.visible = distance > 32;
    };

    async onEnter() {
        this.onRenderQueue.set(fan, this.update);

        await dracoLoaderGlb(cabinet_models, this.onProgress);

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
                if (child.name !== "其他") this.modelsEquip[child.name.split("_")[0]] = child;
            });
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.renderOrder = 0;
                    child.castShadow = true;
                }
            });
        }
        if (name === "地面") {
            this.ground = gltf.scene;
            gltf.scene.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.renderOrder = 0;
                    child.receiveShadow = true;
                    if (child.material.name === "Material.031") {
                        child.renderOrder = 1;
                    }
                }
            });
            // processingCommonModel(gltf);
        }
        if (name === "not_transparent") {
            this.notTransparent = gltf.scene;
        }
        if (name === "transparent") {
            this.transparent = gltf.scene;
        }
        processingAnimations(gltf, this);
        this.actions.forEach(action => {
            action.play();
        });

        this._add(gltf.scene);
    };
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
                    if (this.css2d) {
                        this.css2d.deleteSelf();
                    }
                    this.css2d = this.createDom(data.data);
                    this.css2d.position.copy(this.modelsEquip[deviceId].position);
                    this.css2d.visible = true;
                    this.add(this.css2d);
                } else {
                    this.css2d.visible = false;
                }
            });
    }

    onLeave() {
        this.removeEvents();
        this.resetControls();

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
        this.setHD();
        this.addEvents();
        this.box();
        this.handleControls();
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
        const vec = new THREE.Vector3(radius, radius, radius).multiplyScalar(0.6);
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
        // if (this.rotateObj) {
        //     this.rotateObj.rotation.y = this.rotateObj.rotation.y + 0.01;
        // }
        this.elapsedTime += core.delta;
        this.boxModelObj && this.boxModelObj.update(this.elapsedTime);
    };
    addLight(dev, center) {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
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

        directionalLight.position.set(center.x, center.y + 4, center.z + 4);
        directionalLight.target.position.copy(center);
        directionalLight.castShadow = true;
        this.add(directionalLight);
    }
}
