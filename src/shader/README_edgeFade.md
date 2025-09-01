# 边缘虚化着色器使用说明

## 概述

边缘虚化着色器提供了三种不同的边缘虚化效果，可以用于创建地形、建筑等模型的边缘渐变效果。

## 功能特性

### 1. 基于 UV 的边缘虚化 (edgeFadeUV)

-   使用 UV 坐标进行边缘虚化
-   适合有良好 UV 映射的模型
-   虚化效果基于 UV 坐标的边界

### 2. 基于距离的边缘虚化 (edgeFadeDis)

-   使用世界坐标距离进行边缘虚化
-   适合地形、建筑等大型模型
-   固定参数，虚化宽度 50.0，非虚化区域 30.0

### 3. 可配置的边缘虚化 (edgeFadeConfig)

-   使用世界坐标距离进行边缘虚化
-   支持动态调整参数
-   最灵活的使用方式

## 使用方法

### 基本使用

```javascript
import { shaderModify } from "./shader/shaderModify.js";

// 1. 基于UV的边缘虚化
shaderModify(material, { shader: "edgeFadeUV" });

// 2. 基于距离的边缘虚化（固定参数）
shaderModify(material, { shader: "edgeFadeDis" });

// 3. 基于距离的边缘虚化（可配置参数）
shaderModify(material, { shader: "edgeFadeConfig" });
```

### 动态参数调整

```javascript
import { changeEdgeFadeWidth, changeEdgeFadeDistance } from "./shader/shaderModify.js";

// 调整虚化宽度
changeEdgeFadeWidth(80.0);

// 调整非虚化区域
changeEdgeFadeDistance(40.0);
```

### 完整示例

```javascript
import { applyEdgeFadeToMaterial } from "./shader/test_edgeFade.js";

// 应用到材质
const material = new THREE.MeshStandardMaterial();
applyEdgeFadeToMaterial(material, "config");

// 动态调整参数
changeEdgeFadeWidth(60.0);
changeEdgeFadeDistance(35.0);
```

## 参数说明

### edgeFadeConfig 参数

-   `uEdgeFadeWidth`: 虚化宽度，控制边缘虚化的范围
-   `uEdgeFadeDistance`: 非虚化区域，控制中心清晰区域的大小

### 推荐参数值

-   小型模型: width=30.0, distance=20.0
-   中型模型: width=50.0, distance=30.0
-   大型模型: width=80.0, distance=40.0

## 注意事项

1. 确保材质支持透明度（transparent: true）
2. 边缘虚化会修改 `gl_FragColor.a`，影响透明度
3. 基于距离的虚化需要模型有正确的世界坐标
4. 基于 UV 的虚化需要模型有良好的 UV 映射

## 技术实现

边缘虚化着色器通过以下方式实现：

1. **UV 边缘虚化**: 计算 UV 坐标到中心的距离，在边界处降低透明度
2. **距离边缘虚化**: 计算世界坐标到中心的距离，在边界处降低透明度
3. **参数化控制**: 通过 uniform 变量实现动态参数调整

## 文件结构

```
src/shader/
├── lib/
│   └── edgeFade.js          # 边缘虚化着色器代码块
├── shaderChunk.js           # 着色器块管理
├── shaderModify.js          # 着色器修改主函数
├── paramaters.js            # 参数定义
├── test_edgeFade.js         # 测试示例
└── README_edgeFade.md       # 使用说明
```
