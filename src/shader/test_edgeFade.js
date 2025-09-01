import { shaderModify, changeEdgeFadeWidth, changeEdgeFadeDistance } from "./shaderModify.js";

/**
 * 边缘虚化着色器测试示例
 */

// 示例1: 基于UV的边缘虚化
export function testEdgeFadeUV(material) {
    shaderModify(material, { shader: "edgeFadeUV" });
    console.log("已应用基于UV的边缘虚化效果");
}

// 示例2: 基于距离的边缘虚化（固定参数）
export function testEdgeFadeDis(material) {
    shaderModify(material, { shader: "edgeFadeDis" });
    console.log("已应用基于距离的边缘虚化效果（固定参数）");
}

// 示例3: 基于距离的边缘虚化（可配置参数）
export function testEdgeFadeConfig(material) {
    shaderModify(material, { shader: "edgeFadeConfig" });
    console.log("已应用基于距离的边缘虚化效果（可配置参数）");
}

// 示例4: 动态调整边缘虚化参数
export function testDynamicEdgeFade() {
    // 设置虚化宽度为80.0
    changeEdgeFadeWidth(80.0);
    console.log("虚化宽度已设置为: 80.0");

    // 设置非虚化区域为40.0
    changeEdgeFadeDistance(40.0);
    console.log("非虚化区域已设置为: 40.0");
}

// 示例5: 完整的边缘虚化应用流程
export function applyEdgeFadeToMaterial(material, type = "config") {
    switch (type) {
        case "uv":
            testEdgeFadeUV(material);
            break;
        case "dis":
            testEdgeFadeDis(material);
            break;
        case "config":
        default:
            testEdgeFadeConfig(material);
            // 设置默认参数
            changeEdgeFadeWidth(60.0);
            changeEdgeFadeDistance(35.0);
            break;
    }
}

/**
 * 使用说明：
 *
 * 1. 导入测试函数：
 * import { applyEdgeFadeToMaterial, testDynamicEdgeFade } from './shader/test_edgeFade.js';
 *
 * 2. 应用到材质：
 * applyEdgeFadeToMaterial(material, "config"); // 使用可配置参数
 * applyEdgeFadeToMaterial(material, "uv");     // 使用UV边缘虚化
 * applyEdgeFadeToMaterial(material, "dis");    // 使用距离边缘虚化
 *
 * 3. 动态调整参数：
 * testDynamicEdgeFade();
 */
