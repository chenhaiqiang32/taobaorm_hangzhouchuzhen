/** @description 灯光风格控制器 4白天，8夜晚 16科技风 */
import * as THREE from "three";
import { fresnelChunk } from "./lib/fresnel";
export const DAY = 4;
export const NIGHT = 8;
export const SCIENCE = 16;
export const lightingPattern = {
    value: SCIENCE,
};
export const elapsedTime = {
    value: 0,
};

export const fresnelChangeColor = {
    "#1通风机": {
        value: new THREE.Color(0.9451, 0.9451, 0.5725),
    },
    "#2通风机": {
        value: new THREE.Color(0.9451, 0.9451, 0.5725),
    },
};
export const fresnelColorBlue = {
    蓝紫罗兰: {
        value: new THREE.Color(138, 43, 226),
    },
    紫色: {
        value: new THREE.Color(0.4471, 0.3294, 0.8627),
    },
    靛青: {
        value: new THREE.Color(75, 0, 130),
    },
    淡紫色: {
        value: new THREE.Color(0.4471, 0.6294, 0.8627),
    },
    暗紫罗兰: {
        value: new THREE.Color(148, 0, 211),
    },
    深蓝偏紫: {
        // value: new THREE.Color("#007BFF")
        value: new THREE.Color(0.1176, 0.7333, 0.9961),
    },
    道奇蓝: {
        value: new THREE.Color("#1E90FF"),
    },
    天蓝: {
        // value: new THREE.Color("#87CEEB")
        value: new THREE.Color(0.0, 0.1098, 0.3686),
    },
    深天蓝: {
        value: new THREE.Color("#00BFFF"),
        // value: new THREE.Color(0.5647,0.0353,0.451)
    },
    浅蓝绿色: {
        value: new THREE.Color("#ADD8E6"),
    },
    亮钢兰色: {
        value: new THREE.Color("#B0C4DE"),
    },
};
export const fresnelColorBlue_chen = {
    深蓝偏紫: {
        value: new THREE.Color(0.9725, 0.302, 0.0157),
    },
    道奇蓝: {
        value: new THREE.Color(0.9725, 0.302, 0.0157),
    },
    天蓝: {
        value: new THREE.Color(0.502, 0.6647, 0.8137),
    },
    深天蓝: {
        value: new THREE.Color(0.602, 0.7647, 0.8137),
    },
    浅蓝绿色: {
        value: new THREE.Color(0.702, 0.8647, 0.8137),
    },
    亮钢兰色: {
        value: new THREE.Color(0.802, 0.9647, 0.8137),
    },
};
export const fresnelLevelS = {
    base: {
        value: 2.8,
    },
    level0: {
        value: 0,
    },
    level2: {
        value: 1.8,
    },
    level3: {
        value: 0.8,
    },
    level4: {
        value: 1.2,
    },
    levelN: {
        value: 1000.8,
    },
};

export const flowTime = {
    value: 0,
};
// 窗户玻璃动画时间
export const glassTime = {
    value: 0,
};
/**
 * @description 着色器定位锚点
 * @SHADER_END  着色器最终输出值处
 * @DIFFUSE_EN 着色器漫反射结束点
 * @SHADER_UNIFORM 着色器uniform添加处
 */
export const SHADER_END = "//#shader_end#";
export const SHADER_UNIFORM = "//#shader_uniform#";
export const DIFFUSE_END = "//#diffuse_end#";
