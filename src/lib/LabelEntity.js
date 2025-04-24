import * as THREE from 'three';
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { CSS3DObject,CSS3DSprite } from "three/examples/jsm/renderers/CSS3DRenderer";

const doc = document;

/**
 * @classdesc 标签实体类
 */
export class LabelEntity extends THREE.Object3D {

    /**
     * @param {string} name 标签名
     * @param {"CSS2DObject"|"CSS3DObject"|"CSS3DSprite"} type 标签类型
     */
    constructor(name = "labelEntity",type = "CSS2DObject") {

        super();

        this.isLabelEntity = true;
        this.name = name;
        this.type = "LabelEntity" + type;

        /**@type {HTMLElement} */
        this.domElement = null;

        if (type !== "CSS2DObject" && type !== "CSS3DObject" && type !== "CSS3DSprite") {
            throw new Error("LabelEntity type must be CSS2DObject or CSS3DObject or CSS3DSprite");
        }

        this.#_createObject(type,name);

    }

    addEventListener(type,listener) {
        this.domElement.addEventListener(type,listener);
    }

    removeEventListener(type,listener) {
        this.domElement.removeEventListener(type,listener);
    }

    #_createObject(type,name) {
        const element = this.#_createElement(name);
        const _Constructor = this.#_getConstructor(type);
        const object = new _Constructor(element);
        this.add(object);
    }

    #_getConstructor(type) {
        switch (type) {
            case "CSS2DObject":
                return CSS2DObject;
            case "CSS3DObject":
                return CSS3DObject;
            case "CSS3DSprite":
                return CSS3DSprite;
            default:
                break;
        }
    }

    /**
     * @param {string} name
     */
    #_createElement(name) {
        const parent = doc.createElement("div");
        parent.className = "labelEntity-container";

        const element = doc.createElement("div");
        element.innerText = name;
        element.className = "labelEntity";
        element.oncontextmenu = () => false;

        const arrow = doc.createElement("img");
        arrow.className = "labelEntity_down";
        arrow.src = "./textures/down.png";
        arrow.draggable = false;
        arrow.oncontextmenu = () => false;

        parent.appendChild(element);
        parent.appendChild(arrow);

        this.domElement = parent;
        return parent;
    }

}
