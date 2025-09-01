import { fresnelChunk } from "./lib/fresnel";
import { pumpShaderChunk } from "./lib/pump";
import { edgeFadeUVChunk, edgeFadeDisChunk, edgeFadeConfigChunk } from "./lib/edgeFade";

import { SHADER_END } from "./paramaters";
export default (function () {
    let shaderChunk = {
        fresnel(shader) {
            fragReplace(shader, SHADER_END, fresnelChunk);
        },

        pumpModify(shader, param) {
            fragReplace(shader, SHADER_END, pumpShaderChunk);
        },

        edgeFadeUV(shader, param) {
            fragReplace(shader, SHADER_END, edgeFadeUVChunk);
        },

        edgeFadeDis(shader, param) {
            fragReplace(shader, SHADER_END, edgeFadeDisChunk);
        },

        edgeFadeConfig(shader, param) {
            fragReplace(shader, SHADER_END, edgeFadeConfigChunk);
        },
    };

    /**
     * @function fragReplace 片元着色器修改函数
     * @function vertexReplace 顶点着色器修改函数
     */
    function fragReplace(shader, start, chunk) {
        shader.fragmentShader = shader.fragmentShader.replace(
            start,
            `
  ${chunk}
  ${start}
  `,
        );
    }
    function vertexReplace(shader, start, chunk) {
        shader.vertexShader = shader.vertexShader.replace(
            start,
            `
  ${chunk}
  ${start}
  `,
        );
    }

    return shaderChunk;
})();
