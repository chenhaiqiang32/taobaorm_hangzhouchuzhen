# 场景漫游功能说明

## 功能概述

在热源系统中实现了完整的场景漫游功能，允许相机按照预设路径在厂区范围内自动漫游，提供沉浸式的 3D 场景浏览体验。

## 主要特性

### 1. 基础漫游功能

-   **自动路径漫游**: 相机按照预设路径点自动移动
-   **平滑动画**: 使用 TWEEN.js 实现平滑的相机动画
-   **循环漫游**: 支持无限循环漫游模式
-   **速度控制**: 可调节漫游速度

### 2. 高级功能

-   **贝塞尔曲线路径**: 提供更平滑的漫游体验
-   **路径可视化**: 可显示漫游路径线条
-   **暂停/恢复**: 支持漫游过程中的暂停和恢复
-   **自定义路径**: 支持添加自定义漫游路径点
-   **建筑透明度控制**: 漫游时自动设置建筑透明度为 0.2，提供更好的视野

### 3. 控制功能

-   **开始漫游**: 启动场景漫游
-   **停止漫游**: 停止漫游并回到原始位置
-   **暂停漫游**: 暂停当前漫游动画
-   **恢复漫游**: 恢复暂停的漫游动画
-   **速度调节**: 加速或减速漫游

## 使用方法

### 基础使用

```javascript
// 获取热源系统实例
const heatSource = core.getSubsystem("HeatSource");

// 开始漫游
heatSource.startRoaming();

// 停止漫游
heatSource.stopRoaming();

// 暂停漫游
heatSource.pauseRoaming();

// 恢复漫游
heatSource.resumeRoaming();
```

### 高级使用

```javascript
// 开始平滑漫游（使用贝塞尔曲线）
heatSource.startSmoothRoaming();

// 设置漫游速度 (0.5-2.0)
heatSource.setRoamingSpeed(1.5);

// 跳转到指定路径点
heatSource.jumpToPathPoint(2);

// 添加自定义路径点
const position = new THREE.Vector3(10, 5, 10);
const target = new THREE.Vector3(0, 0, 0);
heatSource.addCustomPathPoint(position, target, 3000);

// 获取漫游状态
const status = heatSource.getRoamingStatus();
console.log(status);

// 建筑透明度控制
heatSource.setBuildingOpacity(0.2, 1000); // 设置建筑透明度为0.2
heatSource.restoreBuildingOpacity(1000); // 恢复建筑原始透明度
```

### 路径配置

漫游路径在 `initRoamingPath()` 方法中定义，包含以下关键观察点：

1. **厂区入口视角**: 从入口观察整个厂区
2. **机加车间视角**: 重点观察机加车间
3. **压铸车间视角**: 重点观察压铸车间
4. **设备区域视角**: 观察主要设备区域
5. **高空俯视视角**: 从高空俯视整个厂区
6. **机械臂区域视角**: 观察机械臂工作区域

## 界面控制

系统提供了完整的界面控制按钮：

-   **开始漫游**: 绿色按钮，启动漫游
-   **停止漫游**: 红色按钮，停止漫游
-   **暂停漫游**: 橙色按钮，暂停漫游
-   **恢复漫游**: 蓝色按钮，恢复漫游
-   **加速**: 紫色按钮，提高漫游速度
-   **减速**: 灰色按钮，降低漫游速度
-   **平滑漫游**: 粉色按钮，启动贝塞尔曲线漫游
-   **显示路径**: 棕色按钮，显示漫游路径线条
-   **建筑透明**: 青色按钮，手动设置建筑透明度为 0.2
-   **建筑不透明**: 橙红色按钮，恢复建筑原始透明度

## 技术实现

### 核心组件

1. **路径管理**: 使用数组存储路径点信息
2. **动画控制**: 基于 TWEEN.js 实现平滑动画
3. **状态管理**: 完整的漫游状态跟踪
4. **相机控制**: 自动控制相机位置和目标点
5. **建筑透明度控制**: 自动管理建筑材质透明度

### 关键方法

-   `initRoamingPath()`: 初始化漫游路径
-   `startRoaming()`: 开始漫游
-   `stopRoaming()`: 停止漫游
-   `moveToNextPathPoint()`: 移动到下一个路径点
-   `createBezierPath()`: 创建贝塞尔曲线路径
-   `getRoamingStatus()`: 获取漫游状态
-   `setBuildingOpacity()`: 设置建筑透明度
-   `restoreBuildingOpacity()`: 恢复建筑原始透明度

### 配置参数

-   `roamingSpeed`: 漫游速度倍数 (0.5-2.0)
-   `duration`: 每个路径点的动画持续时间
-   `easing`: 动画缓动函数 (Quadratic.InOut, Cubic.InOut)
-   `roamingBuildingOpacity`: 漫游时建筑透明度 (默认 0.2)

## 注意事项

1. **性能考虑**: 漫游过程中会禁用用户控制器，避免冲突
2. **内存管理**: 离开系统时会自动清理漫游状态
3. **路径依赖**: 漫游路径依赖于场景的 ground 对象，确保场景加载完成后再初始化
4. **动画冲突**: 避免与其他相机动画同时运行
5. **材质管理**: 建筑材质会自动启用透明度支持

## 扩展功能

### 自定义路径

可以通过以下方式添加自定义漫游路径：

```javascript
// 清除现有路径
heatSource.clearCustomPath();

// 添加自定义路径点
heatSource.addCustomPathPoint(
    new THREE.Vector3(x1, y1, z1),
    new THREE.Vector3(targetX1, targetY1, targetZ1),
    duration1,
);

// 开始自定义路径漫游
heatSource.startRoaming();
```

### 路径可视化

```javascript
// 获取路径可视化对象
const pathLine = heatSource.getPathVisualization();

// 添加到场景中显示
if (pathLine) {
    scene.add(pathLine);
}
```

### 建筑透明度控制

```javascript
// 设置建筑透明度
heatSource.setBuildingOpacity(0.3, 1500); // 透明度0.3，动画1.5秒

// 恢复建筑原始透明度
heatSource.restoreBuildingOpacity(1000); // 动画1秒
```

这个漫游功能为 3D 厂区场景提供了完整的自动浏览体验，用户可以通过界面按钮轻松控制漫游过程，也可以通过 API 进行更精细的控制。建筑透明度功能确保在漫游过程中能够清晰地看到厂区内部的设备和结构。
