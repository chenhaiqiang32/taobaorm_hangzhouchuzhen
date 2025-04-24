import TWEEN from "three/examples/jsm/libs/tween.module";
import { Vector3 } from "three";
import { Subsystem } from "../three/subsystem";

const vec3$1 = new Vector3();

export class TweenControls {
    /** @param {Subsystem} system */
    constructor(system) {
        this.camera = system.camera;
        this.controls = system.controls;
        this.tweenEntities = [];
    }

    /**
     * 相机线性过度到目标点 distance 距离
     * @param {Vector3} position
     * @param {number} distance
     * @param {number} duration
     * @param {Vector3} offset
     */
    lerpTo(position,distance = 100,duration = 1000,offset = new Vector3()) {
        const _distance = this.camera.position.distanceTo(position);
        const alpha = (_distance - distance) / _distance;
        vec3$1.lerpVectors(this.camera.position,position,alpha);
        vec3$1.add(offset);
        this.changeTo({ start: this.camera.position,end: vec3$1,duration });
        this.changeTo({ start: this.controls.target,end: position,duration });
    }
    /**
     * 相机线性过度到目标点 distance 距离,保存 tween 实例，不会立即执行
     * @param {Vector3} position
     * @param {number} distance
     * @param {number} duration
     * @param {Vector3} offset
     */
    lerpToDelay(position,distance = 100,duration = 1000,offset = new Vector3()) {
        const _distance = this.camera.position.distanceTo(position);
        const alpha = (_distance - distance) / _distance;
        vec3$1.lerpVectors(this.camera.position,position,alpha);
        vec3$1.add(offset);
        this.changeTo({ start: this.camera.position,end: vec3$1,duration },false);
        this.changeTo({ start: this.controls.target,end: position,duration },false);
    }

    /**
     * 相机飞向坐标，并且朝向目标点
     * @param {Vector3} position
     * @param {Vector3} target
     * @param {number} duration
     * @returns
     */
    flyTo(position,target,duration = 1000) {
        if (!position || !target) return;

        if (this.camera.position.equals(position) && this.controls.target.equals(target)) return;

        this.changeTo({
            start: this.camera.position,
            end: position,
            duration,
            onUpdate: () => {
                this.controls.target.copy(target);
            },
            onStart: () => {
                this.controls.enabled = false;
            },
            onComplete: () => {
                this.controls.enabled = true;
            }
        });
    }

    /**
     * 相机飞向坐标，并且朝向目标点,保存tween实例，不会立即执行
     * @param {Vector3} position
     * @param {Vector3} target
     * @param {number} duration
     * @returns
     */
    flyToDelay(position,target,duration = 1000) {
        if (!position || !target) return;

        if (this.camera.position.equals(position) && this.controls.target.equals(target)) return;

        this.changeTo({
            start: this.camera.position,
            end: position,
            duration,
            onUpdate: () => {
                this.controls.target.copy(target);
            },
            onStart: () => {
                this.controls.enabled = false;
            },
            onComplete: () => {
                this.controls.enabled = true;
            }
        },false);
    }

    /**
     * @param {{start:{},end:{},duration:number,onUpdate:()=>void,onComplete:()=>void,onStart:()=>void}} options
     * @param {boolean} immediate 是否立即执行  或是 保存在tween实例当中，手动执行。默认为 true
     * @returns
     */
    changeTo(options,immediate = true) {
        const { start,end,duration,onUpdate,onComplete,onStart } = options;

        if (!duration || !end || !start) return;
        const tween = new TWEEN.Tween(start)
            .to(end,duration)
            .onStart(onStart)
            .onUpdate(onUpdate)
            .onComplete(onComplete);

        if (immediate) {
            tween.start();
        } else {
            this.tweenEntities.push(tween);
        }
    }

    /** 执行所有tween实例 */
    start() {
        if (this.tweenEntities.length === 0) return;

        this.tweenEntities.forEach(tween => tween.start());

        this.tweenEntities.length = 0;
    }

    removeAll() {
        TWEEN.removeAll();
    }
}
