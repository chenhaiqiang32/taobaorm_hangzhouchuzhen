import * as THREE from "three"
import { uElapseTime } from "../constant"
/**
 * @param {THREE.Material} material
 */
export function wind(material) {

    material.onBeforeCompile = shader => {

        shader.uniforms.uElapseTime = uElapseTime
        shader.vertexShader = shader.vertexShader.replace(
            `#include <common>`,
            `#include <common>
            varying vec2 st;`
        )
        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
            st = uv;`
        )

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <common>`,
            `#include <common>
            uniform float uElapseTime;
            varying vec2 st;
            float randomA(vec2 st){
                return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453);
            }
            float noiseA(vec2 st) {
                vec2 i = floor(st.xy);
                vec2 f = fract(st.xy);
                f = smoothstep(0.0,1.0,f);
                float a = randomA(i);
                float b = randomA(i + vec2(1.0,0.0));
                float c = randomA(i + vec2(0.0,1.0));
                float d = randomA(i + vec2(1.0,1.0));
                float mixN = mix(a,b,f.x); // 相当于a * (1.0 - f.x) + b * f.x
                float z = a * (1.0 - f.x) + b * f.x + (c - a) * f.y * (1.0 - f.x) + (d - b) * f.y * f.x;
                return z;
            }
            float fbmA(vec2 st) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 2.0;
                for(int i=0; i<6; i++) {
                    value += amplitude*noiseA(st);
                    st *= frequency;
                    amplitude *= 0.5;
                }
              return value;
            }   `
        )

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
            vec2 newSt = vec2(2.0 * st.y - pow(st.y,2.0), st.x*10.0-(uElapseTime * 4.5));
            float z = fbmA(fbmA(newSt) + newSt);
            vec3 color = vec3(1.0);

           color = mix(
            vec3(0.6, 0.6, 0.6),
            vec3(0.2, 0.4, 0.4),
            clamp(z*1.2,0.0,1.0)
           );

          gl_FragColor = vec4(color,0.35);
            `
        )

    }

}
