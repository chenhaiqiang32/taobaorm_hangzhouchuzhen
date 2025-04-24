import * as THREE from "three"

/**
 * 模型逐渐过渡
 * @param {THREE.Object3D} model
 * @param {{value:number}} uTime
 * @returns {{max:number,min:number}} 返回建筑的包围盒的最高和最低
 */
export function dynamicFade(model, uTime) {


    let maxY = -Infinity
    let minY = Infinity

    model.traverse(child => {
        if (child instanceof THREE.Mesh) {

            /** @type {THREE.MeshStandardMaterial} */
            const material = child.material
            material.transparent = true
            child.renderOrder = 3

            const box = new THREE.Box3().setFromObject(child, true)

            maxY = Math.max(maxY, box.max.y)
            minY = Math.min(minY, box.min.y)
            material.onBeforeCompile = shader => {

                shader.uniforms.uTime = uTime
                shader.uniforms.uColor = { value: new THREE.Color(0x3acacc) }
                shader.uniforms.uHeight = { value: box.max.y }

                shader.vertexShader = shader.vertexShader.replace(
                    `#include <common>`,
                    `#include <common>
                    varying vec4 vPosition;
                    `
                )

                shader.vertexShader = shader.vertexShader.replace(
                    `#include <begin_vertex>`,
                    `#include <begin_vertex>
                    vPosition = modelMatrix*vec4(position,1.0);`
                )

                shader.fragmentShader = shader.fragmentShader.replace(
                    `#include <common>`,
                    `#include <common>
                    uniform float uTime;
                    uniform vec3 uColor;
                    uniform float uHeight;
                    varying vec4 vPosition;
                    `
                )

                shader.fragmentShader = shader.fragmentShader.replace(
                    `#include <dithering_fragment>`,
                    `#include <dithering_fragment>

                    gl_FragColor.a *= uTime;

                    float uWidth = 0.005;

                    if(uTime <= uHeight){

                        float toTopIndex = -pow2(vPosition.y-uTime) + uWidth;

                        // 光线
                        if(toTopIndex > 0.0) {
                            gl_FragColor = mix(gl_FragColor, vec4(uColor,0.85), toTopIndex / uWidth);
                        }
                        // 光线上下部分的透明度
                        float al = step(uTime,vPosition.y);
                        gl_FragColor.a = al+0.05;

                    }else{
                        gl_FragColor.a = 0.05;
                    }
                    `
                )
            }

        }
    })

    return { min: minY, max: maxY }

}
