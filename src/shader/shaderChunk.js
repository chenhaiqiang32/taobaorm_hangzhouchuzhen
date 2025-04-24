import { fresnelChunk } from "./lib/fresnel";
import { pumpShaderChunk } from "./lib/pump";

import { SHADER_END } from "./paramaters";
export default (function () {
    let shaderChunk = {
        fresnel(shader) {

            fragReplace(shader,SHADER_END,fresnelChunk);
        },

        pumpModify(shader,param) {
            fragReplace(shader,SHADER_END,pumpShaderChunk);
        },

    };

    /**
     * @function fragReplace 片元着色器修改函数
     * @function vertexReplace 顶点着色器修改函数
     */
    function fragReplace(shader,start,chunk) {
        shader.fragmentShader = shader.fragmentShader.replace(
            start,
            `
  ${chunk}
  ${start}
  `,
        );
    }
    function vertexReplace(shader,start,chunk) {
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
