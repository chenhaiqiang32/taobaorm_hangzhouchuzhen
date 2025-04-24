import { Material } from "three";
import { uStyle, uElapseTime } from "../constant";

/**
 *
 * @param {Material} material
 * @param {{value:number}} uTime
 */
export function water2(material) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uTime = uElapseTime;
        shader.uniforms.uStyle = uStyle;
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
             varying vec2 st;
             uniform float uTime;
             uniform float uStyle;
             #define TAU 6.28318530718
             #define MAX_ITER 5
        `,
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
             float time = uTime * .5+23.0;

              vec2 q = st * 0.3;
                  vec2 p = mod(q*TAU, TAU)-250.0;

               vec2 i = vec2(p);
               float c = 1.0;
               float inten = .005;

               for (int n = 0; n < MAX_ITER; n++)
               {
                float t = time * (1.0 - (3.5 / float(n+1)));
                i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
                c += 1.0/length(vec2(p.x / (sin(i.x+t)/inten),p.y / (cos(i.y+t)/inten)));
               }
               c /= float(MAX_ITER);
               c = 1.17-pow(c, 1.4);
               vec3 color = vec3(pow(abs(c), 8.0));
                  color = clamp(color + vec3(0.0, 0.35, 0.5), 0.0, 1.0);

               if(uStyle == 4.){
                 gl_FragColor = vec4(color, 0.4);
               }else if(uStyle == 8.){
                gl_FragColor = vec4(color*0.1,0.4);
               }

             `,
        );
    };
}
