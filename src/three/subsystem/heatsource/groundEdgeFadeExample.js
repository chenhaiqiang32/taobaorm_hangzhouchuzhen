/**
 * 地面边缘虚化使用示例
 *
 * 这个文件展示了如何在 HeatSource 子系统中使用地面边缘虚化功能
 */

// 假设你已经有了 HeatSource 实例
// const heatSource = new HeatSource(core);

/**
 * 示例1: 基本使用
 * 地面模型加载时会自动应用边缘虚化效果
 */
function basicUsage() {
    // 地面模型加载后会自动应用边缘虚化
    // 材质名称为 '地面_Moss003_1K-JPG' 的模型会自动获得边缘虚化效果
    console.log("地面边缘虚化已自动应用");
}

/**
 * 示例2: 动态调整边缘虚化参数
 */
function adjustEdgeFadeParameters() {
    // 调整虚化宽度和非虚化区域
    heatSource.updateGroundEdgeFade(120.0, 80.0); // 更大的虚化效果

    // 或者分别调整
    // heatSource.updateGroundEdgeFade(80.0, 40.0);   // 更小的虚化效果
    // heatSource.updateGroundEdgeFade(150.0, 100.0); // 更大的虚化效果
}

/**
 * 示例3: 为其他地面材质手动应用边缘虚化
 */
function applyToOtherGroundMaterial(material) {
    if (material && material.name === "地面_Moss003_1K-JPG") {
        heatSource.applyGroundEdgeFade(material);
    }
}

/**
 * 示例4: 根据场景需求调整参数
 */
function adjustForDifferentScenes() {
    // 白天场景 - 较温和的虚化
    heatSource.updateGroundEdgeFade(80.0, 50.0);

    // 夜晚场景 - 更明显的虚化
    heatSource.updateGroundEdgeFade(120.0, 70.0);

    // 特殊效果 - 强烈的虚化
    heatSource.updateGroundEdgeFade(150.0, 90.0);
}

/**
 * 示例5: 响应式调整
 */
function responsiveAdjustment() {
    // 根据相机距离调整虚化效果
    const cameraDistance = camera.position.distanceTo(ground.position);

    if (cameraDistance > 500) {
        // 远距离 - 更明显的虚化
        heatSource.updateGroundEdgeFade(140.0, 80.0);
    } else if (cameraDistance > 200) {
        // 中距离 - 中等虚化
        heatSource.updateGroundEdgeFade(100.0, 60.0);
    } else {
        // 近距离 - 轻微虚化
        heatSource.updateGroundEdgeFade(60.0, 40.0);
    }
}

/**
 * 使用说明：
 *
 * 1. 地面模型加载时会自动应用边缘虚化效果
 * 2. 使用 updateGroundEdgeFade() 方法动态调整参数
 * 3. 使用 applyGroundEdgeFade() 方法手动应用效果
 * 4. 参数说明：
 *    - width: 虚化宽度，值越大虚化范围越大
 *    - distance: 非虚化区域，值越大中心清晰区域越大
 *
 * 推荐参数组合：
 * - 小型地面: width=60.0, distance=40.0
 * - 中型地面: width=100.0, distance=60.0
 * - 大型地面: width=140.0, distance=80.0
 */
