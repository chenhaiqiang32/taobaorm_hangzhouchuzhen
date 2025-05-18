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
        this.tweenControls = new TweenControls(this);
        this.modelsEquip = {}; // 设备模型 shuju
        this.statusColor = { 1: "#f7acbc", 2: "#deab8a", 3: "#444693", 4: "#5f3c23" };
        this.buildingModels = {}; // 车间模型 shuju
        this.jixiebi = {}; // 机械臂模型 shuju
        this.webData = {}; // 存储的前端推送的数据
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
        let changeDom = document.getElementsByClassName("device-info-container-box")[0].cloneNode(true);
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
        const { equipmentName, status } = data;
        let changeDom = document.getElementsByClassName("device-info-container-box")[0].cloneNode(true);
        let titleName = changeDom.getElementsByClassName("jiexibiname"); // 标题名字
        let equipStatus = changeDom.getElementsByClassName("jixiebistatus"); // 状态文字

        const statusName = { 1: "运行", 2: "关闭", 3: "报警" };
        titleName[0].innerText = equipmentName; // dom元素赋值
        equipStatus[0].innerText = statusName[status];
        equipStatus[0].style.color = this.statusColor[status];

        const css2d = createCSS2DObject(changeDom);
        css2d.center.set(0.5, 1);
        css2d.scale.set(0.1, 0.1, 0.1);
        css2d.rotation.y = -Math.PI / 2;
        return css2d;
    }

    traverFromParent(object3d) {
        let hasCocaCola = false;
        let returnData = null;
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
                    this.doHandel({ equipmentName: 234234, status: 234234 }, returnData.name);
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
        const cameraPosition = new THREE.Vector3(center.x + radius * 1.5, center.y + radius * 1, center.z);

        new TWEEN.Tween(this.camera.position).to(cameraPosition, 1000).start();

        // Animate camera target
        new TWEEN.Tween(this.controls.target).to(center, 1000).start();
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
        let color = this.statusColor[status];

        if (this.modelsEquip[id]) {
            console.log(this.modelsEquip[id], 4444);
            this.modelsEquip[id].traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.material.onBeforeCompile = shader => {
                        shaderModify(shader, {
                            shader: "pumpModify",
                            color: fresnelColorBlue["淡紫色"].value,
                            shaderName: "base",
                        });
                    };
                    child.stateMaterial = child.material.clone();
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
            // 首页
            this.switchSceneObj.object3d = null;
            this.switchSceneObj.name = "home";
            this.handleControls();
            return false;
        }
        if (this.buildingModels[obj]) {
            this.changeSceneObjVisible(this.buildingModels[obj], false, obj);
            this.switchSceneObj.object3d = this.buildingModels[obj];
            this.switchSceneObj.name = obj;
        }
    }
    changeSceneObjVisible(object3d, visible, name) {
        object3d.traverse(child => {
            if (child instanceof THREE.Mesh) {
                // Make sure material is transparent
                child.material.transparent = true;

                // Create tween for opacity
                const tween = new TWEEN.Tween(child.material).to({ opacity: visible ? 1 : 0 }, 1000).onComplete(() => {
                    // Set visibility after opacity transition
                    child.visible = visible;
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
                center.x + radius * 1.5, // Offset X
                center.y + radius, // Offset Y
                center.z, // Offset Z
            );
            // If name is "机加车间外壳", rotate camera position 180 degrees around Y axis
            if (name === "压铸车间外壳") {
                let rel = { x: -262.9221109589206, y: 85.37329054298351, z: -22.310934207969385 };
                new TWEEN.Tween(this.camera.position).to(new THREE.Vector3(rel.x, rel.y, rel.z), 1000).start();
            } else {
                new TWEEN.Tween(this.camera.position).to(cameraPosition, 1000).start();
            }
            // Animate camera target
            new TWEEN.Tween(this.controls.target).to(center, 1000).start();
        }
    }
    doHandel(data, deviceId) {
        // 使用 fetch 调用接口
        this.tweenControls.changeTo({
            start: this.camera.position,
            end: {
                x: this.modelsEquip[deviceId].position.x + 12,
                y: this.modelsEquip[deviceId].position.y + 12,
                z: this.modelsEquip[deviceId].position.z,
            },
            duration: 1000,
        });
        this.tweenControls.changeTo({
            start: this.controls.target,
            end: this.modelsEquip[deviceId].position,
            duration: 1000,
            onComplete: () => {
                if (this.css2d) {
                    this.css2d.deleteSelf();
                }
                this.css2d = this.createDom(data);
                this.css2d.position.copy(this.modelsEquip[deviceId].position);
                this.css2d.visible = true;
                this.add(this.css2d);
                postWeb3dDeviceCode(deviceId);
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
