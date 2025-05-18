import { Scene, Camera, WebGLRenderer, Object3D } from "three";
import {
    EffectPass,
    SelectiveBloomEffect,
    EffectComposer,
    RenderPass,
    BlendFunction,
    OutlineEffect,
    HueSaturationEffect,
    BrightnessContrastEffect,
    FXAAEffect,
    SMAAEffect,
} from "postprocessing";

export class Postprocessing {
    #renderer;
    #scene;
    #camera;
    /**
     * @param { WebGLRenderer } render
     * @param { Scene } scene
     * @param { Camera } camera
     */
    constructor(renderer, scene, camera) {
        this.#renderer = renderer;
        this.#scene = scene;
        this.#camera = camera;
        this.#init();
    }

    resize = (width, height) => {
        this.composer.setSize(width, height, true);
    };

    #init() {
        this.#initComposer();
        this.#initRenderPass();
        this.#initBloomEffect();
        this.#initOutLineEffect1();
        this.#initOutLineEffect2();
        this.#initEffectPass();
    }

    #initComposer() {
        // msaa anti-aliasing 多重采样抗锯齿
        const multisampling = this.#renderer.capabilities.maxSamples;
        this.composer = new EffectComposer(this.#renderer, { multisampling });
    }

    #initRenderPass() {
        this.renderPass = new RenderPass(this.#scene, this.#camera);
        this.composer.addPass(this.renderPass);
    }

    #initBloomEffect() {
        this.bloomEffect = new SelectiveBloomEffect(this.#scene, this.#camera, {
            blendFunction: BlendFunction.ADD,
            luminanceThreshold: 0.01,
            luminanceSmoothing: 1.1,
            intensity: 2,
        });
        this.bloomEffect.inverted = false;
        this.bloomEffect.ignoreBackground = true;
        this.bloomEffect.selection.set([]);
    }

    #initOutLineEffect1() {
        this.outlineEffect1 = new OutlineEffect(this.#scene, this.#camera, {
            blendFunction: BlendFunction.ADD,
            edgeStrength: 3,
            pulseSpeed: 0,
            visibleEdgeColor: 0x00ced1,
            hiddenEdgeColor: 0x00ced1,
            blur: false,
            xRay: true,
            usePatternTexture: false,
        });
    }

    #initOutLineEffect2() {
        this.outlineEffect2 = new OutlineEffect(this.#scene, this.#camera, {
            blendFunction: BlendFunction.ADD,
            edgeStrength: 0.25,
            patternScale: 5,
            // pulseSpeed: 0.2,
            visibleEdgeColor: 0xeeee00,
            hiddenEdgeColor: 0x00ced1,
            blur: true,
            xRay: true,
            usePatternTexture: false,
        });
    }

    #initEffectPass() {
        // 色调通道
        this.hueSaturationEffect = new HueSaturationEffect({ saturation: 0.18 });
        this.brightnessContrastEffect = new BrightnessContrastEffect({
            contrast: 0.2,
        });
        this.smAAComposer = new SMAAEffect({});
        // 创建通道
        const effectPass = new EffectPass(
            this.#camera,
            this.bloomEffect,
            this.outlineEffect1,
            this.outlineEffect2,
            // this.hueSaturationEffect,
            // this.brightnessContrastEffect,
            this.smAAComposer,
        );
        this.composer.addPass(effectPass);
    }
    addBloom = obj => {
        const selection = this.bloomEffect.selection;
        if (obj instanceof Object3D) {
            selection.add(obj);
        } else if (Array.isArray(obj)) {
            obj.forEach(this.addBloom);
        }
    };
    clearBloom = obj => {
        const selection = this.bloomEffect.selection;
        if (obj instanceof Object3D) {
            selection.delete(obj);
        } else if (Array.isArray(obj)) {
            obj.forEach(this.clearBloom);
        }
    };
    addOutline = (obj, channel = 1) => {
        let pass = channel === 1 ? this.outlineEffect1 : this.outlineEffect2;
        if (obj instanceof Object3D) {
            pass.selection.add(obj);
        } else if (Array.isArray(obj)) {
            obj.forEach(child => this.addOutline(child, channel));
        }
    };
    clearOutline = (obj, channel = 1) => {
        let pass = channel === 1 ? this.outlineEffect1 : this.outlineEffect2;
        if (obj instanceof Object3D) {
            pass.selection.delete(obj);
        } else if (Array.isArray(obj)) {
            obj.forEach(child => this.clearOutline(child, channel));
        }
    };
    clearAllOutline = (channel = 1) => {
        let pass = channel === 1 ? this.outlineEffect1 : this.outlineEffect2;
        pass.selection.set([]);
    };
}
