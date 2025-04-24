import { Material } from "three";
import { uStyle } from "../constant";

/**
 * @param {Material} material
 * @param {{value:number}} uStyle
 */
export function glassNight(material) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uStyle = uStyle;
        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <common>`,
            `#include <common>
            uniform float uStyle;`,
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
            vec3 color = gl_FragColor.xyz;
            vec4 z = diffuseColor;
            float q = pow(z.r-z.g,2.0)  + pow(z.r-z.b,2.0) + pow(z.g-z.b,2.0);
            float i = step(q,0.01); //q大于0.01时,i为0,反之为1
            if(uStyle == 8.0) {
                float o = step(pow(z.r,2.0),(z.b,2.0));
                vec3 newC = vec3 (0.8, 0.8,0.45);
                gl_FragColor = vec4(mix(newC,color, i*o),i +0.8) ;
            }else{
                gl_FragColor.a = i + 0.8 ;
            }`,
        );
    };
}

/**
 * @param {Material} material
 * @param {{value:number}} uStyle
 */
export function glass(material) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uStyle = uStyle;

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
            vec3 color = gl_FragColor.xyz;
            vec4 z = diffuseColor;
            float q = pow(z.r-z.g,2.0)  + pow(z.r-z.b,2.0) + pow(z.g-z.b,2.0);
            float i = step(q,0.01); //q大于0.01时,i为0,反之为1
            gl_FragColor.a = i + 0.8 ;
            `,
        );
    };
}
