/**
 * 基于uv的地形边缘虚化
 * @param width 宽度百分比
 */
export const edgeFadeUVChunk = /* glsl */ `
    float width = 0.1; // 虚化宽度
    vec2 v = st.xy - 0.5;
    float s = width; // 虚化宽度
    float t = 0.5 - width; // 非虚化区域 // s+t相加最好不大于模型2分之一的长度
    float x = abs(v.x);
    float y = abs(v.y);
    if(x > t) gl_FragColor.a *= pow((0.5-x) / s,2.0) ;
    if(y > t) gl_FragColor.a *= pow((0.5-y) / s,2.0) ;
`;

/**
 * 基于坐标距离的地形边缘虚化
 * @param width 宽度数值
 */
export const edgeFadeDisChunk = /* glsl */ `
    float d = 50.0; // 虚化宽度
    float t = 30.0; // 非虚化区域
    float x = abs(mPosition.x);
    float z = abs(mPosition.z);
    if(x > t) gl_FragColor.a *= (d - x + t) / d;
    if(z > t) gl_FragColor.a *= (d - z + t) / d;
`;

/**
 * 可配置参数的边缘虚化
 */
export const edgeFadeConfigChunk = /* glsl */ `
    float fadeWidth = uEdgeFadeWidth; // 虚化宽度
    float fadeDistance = uEdgeFadeDistance; // 非虚化区域
    float x = abs(mPosition.x);
    float z = abs(mPosition.z);
    if(x > fadeDistance) gl_FragColor.a *= (fadeWidth - x + fadeDistance) / fadeWidth;
    if(z > fadeDistance) gl_FragColor.a *= (fadeWidth - z + fadeDistance) / fadeWidth;
`;

/**
 * 使用示例：
 *
 * 1. 基于UV的边缘虚化：
 * shaderModify(material, { shader: "edgeFadeUV" });
 *
 * 2. 基于距离的边缘虚化（固定参数）：
 * shaderModify(material, { shader: "edgeFadeDis" });
 *
 * 3. 基于距离的边缘虚化（可配置参数）：
 * shaderModify(material, { shader: "edgeFadeConfig" });
 *
 * 4. 动态调整参数：
 * changeEdgeFadeWidth(80.0);  // 设置虚化宽度
 * changeEdgeFadeDistance(40.0);  // 设置非虚化区域
 */
