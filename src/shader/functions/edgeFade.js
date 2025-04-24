export function edgeFade(material, e = 0.12) {
    material.transparent = true;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            `#include <common>`,
            `#include <common>
             varying vec2 st;`,
        );
        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
             st = uv;`,
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <common>`,
            `#include <common>
             varying vec2 st;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <dithering_fragment>",
            `#include <dithering_fragment>
             vec2 v = st.xy - 0.5;
             float s = ${e}; // 虚化宽度
             float t = 0.5 - ${e}; // 非虚化区域 // s+t相加最好不大于模型2分之一的长度
             float x = abs(v.x);
             float y = abs(v.y);
             if(x > t) gl_FragColor.a *= pow((0.5-x) / s,2.0) ;
             if(y > t) gl_FragColor.a *= pow((0.5-y) / s,2.0) ;
              `,
        );
    };
}
