import * as THREE from "three";

const vertexShader = `
varying vec3 vPosition;
varying vec2 vUv;
void main() {
   vPosition = position;
   vUv = uv;
   vec4 modelPosition = modelMatrix * vec4 ( position, 1.0);
   gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
`;

const fragmentShader = `
varying vec2 vUv;
      uniform sampler2D bg;
      uniform float opacity;
      void main() {
          vec4 col=texture2D(bg, vUv);
          gl_FragColor = vec4(col.xyz, col.a*opacity);
      }
`;
const bgFragment = `
varying vec2 vUv;
uniform vec3 uColor;
void main() {
vec2 uv=(vUv-vec2(0.5))*2.0;
float dis = length(uv);
float al = 0.6 - dis ;

gl_FragColor = vec4(uColor, al*0.2);
}
`;
export class PlatformCircle2 extends THREE.Group {
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width,height,center = new THREE.Vector3(0,0,0)) {
        super();
        this.position.copy(center);
        const geometry = new THREE.PlaneGeometry(width,height);
        geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        // this.createChild_1(geometry);
        this.createChild_2(geometry);
    }

    createChild_1(geometry) {
        const textureLoader = new THREE.TextureLoader();
        const bg = textureLoader.load("./textures/bg.png");
        bg.colorSpace = THREE.SRGBColorSpace;

        this.shaderMaterial = new THREE.ShaderMaterial({
            transparent: true,
            opacity: 0.3,
            uniforms: {
                uElapseTime: this.elapsedTime,
                glowFactor: {
                    value: 1.0, // 扩撒圈的明暗程度
                },
                uColor: {
                    value: new THREE.Color("#60C6FF"),
                },
                flowColor: {
                    value: new THREE.Color("#EEF5F5"),
                },
                bg: {
                    value: bg,
                },
                speed: {
                    value: 0.8,
                },
                opacity: {
                    value: 0.4,
                },
                alpha: {
                    value: 2.5,
                },
            },
            vertexShader,
            fragmentShader,
        });
        let mesh = new THREE.Mesh(geometry,this.shaderMaterial);
        mesh.position.copy(this.position);
        this.children.push(mesh);
    }

    createChild_2(geometry) {
        const bgShaderMaterial = new THREE.ShaderMaterial({
            transparent: true,
            opacity: 0.3,
            uniforms: {
                uColor: {
                    value: new THREE.Color(0.7725,0.8902,0.9412,0.1),
                },
            },
            vertexShader,
            fragmentShader: bgFragment,
        });
        const mesh = new THREE.Mesh(geometry,bgShaderMaterial);
        mesh.position.copy(this.position);
        this.children.push(mesh);
    }

    update(elapsedTime) {
        // this.elapsedTime = elapsedTime;
    }
}
