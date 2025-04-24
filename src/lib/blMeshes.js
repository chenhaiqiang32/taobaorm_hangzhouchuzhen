import * as THREE from "three";
import { PathPointList } from "./PathPointList.js";
import { PathGeometry } from "./PathGeometry.js";
import { PathTubeGeometry } from "./PathTubeGeometry.js";
import { Water } from "three/examples/jsm/objects/Water";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { kdTree } from "./kdTree";
import { convexHull } from "./convexHull.js";

// 定义常量零向量，防止被修改
const ZeroVec3 = new THREE.Vector3();
Object.freeze(ZeroVec3);
class FlowLight extends THREE.Mesh {
    /**
     * 流光
     * @param {THREE.Vector3[]} vertices
     * @param {{width:number,radius:number,type:"line"|"tube",segments:number,color1:THREE.Vector3,color2:THREE.Vector3}} config
     */
    constructor(vertices,config = {}) {
        super();

        config.width = config.width || 1;
        config.radius = config.radius || 1;
        config.commonOpacity = config.commonOpacity || 0.32;
        config.lineAmplitude = config.lineAmplitude || .12; // 振幅
        config.type = config.type || "line";
        config.segments = config.segments || 2;
        config.color1 = config.color1 || new THREE.Vector3(1,1,0);
        config.color2 = config.color2 || new THREE.Vector3(0.95,0.39,0.22);
        config.depthTest = config.depthTest || false;
        this.uOpacity = { value: config.opacity === undefined ? 0 : config.opacity };

        if (Array.isArray(vertices)) {
            this.#createPath(vertices,config,config.up);
        } else {
            console.error("创建流光第一个参数必须是Vector3[]");
        }
        this.type = "FlowLight";
        this.renderOrder = 10;
    }
    /**
     * 流光
     * @param {THREE.Vector3[]} vertices
     * @param {{width:number,radius:number,type:"line"|"tube",segments:number,color1:THREE.Vector3,color2:THREE.Vector3}} config
     */
    #createPath(vertices,config,up) {
        const pathPointList = new PathPointList();
        pathPointList.set(vertices,0.5,10,up,false);
        this.elapsedTime = { value: 0 };

        if (config.type === "line") {
            this.geometry = new PathGeometry();
            this.geometry.update(pathPointList,{
                width: config.width,
                arrow: false,
                side: "both",
            });
        } else if (config.type === "tube") {
            this.geometry = new PathTubeGeometry();
            this.geometry.update(pathPointList,{
                arrow: false,
                side: "both",
                radius: config.radius,
            });
        }
        this.material = new THREE.ShaderMaterial({
            vertexShader: `
                  varying vec2 vUv;
                  #include <logdepthbuf_pars_vertex>
                  #include <common>
                  void main() {
                    vUv = uv;
                    #include <begin_vertex>
                    #include <project_vertex>
                    #include <logdepthbuf_vertex>
                  }
                  `,
            fragmentShader: `
                  /* This work is protected under a Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
                    * more information canbe found at:
                    * https://creativecommons.org/licenses/by-nc-sa/3.0/deed.en_US
                    */

                    const float overallSpeed=1.2;
                    const float gridSmoothWidth=.025;
                    const float axisWidth=.25;
                    uniform float uTime;
                    const float majorLineWidth=.025;
                    const float minorLineWidth=.0125;
                    const float majorLineFrequency=5.;
                    const float minorLineFrequency=1.;
                    const vec4 gridColor=vec4(.5);
                    const float scale=.32;
                    // const vec4 lineColor=vec4(0.8314, 0.8902, 0.9529, 0.02);
                    const vec4 lineColor=vec4(0.8314, 0.9373, 0.8314, 0.02);
                    const float minLineWidth=.12;
                    const float maxLineWidth=.18;
                    const float lineSpeed=2.*overallSpeed;
                    uniform float lineAmplitude; // 线条振幅
                    uniform float commonOpacity; // 透明度
                    const float lineFrequency=2.32;
                    const float warpSpeed=.82*overallSpeed;
                    const float warpFrequency=.85;
                    const float warpAmplitude=.04;
                    const float offsetFrequency=.5;
                    const float offsetSpeed=.23*overallSpeed;
                    const float minOffsetSpread=.32;
                    const float maxOffsetSpread=.32;
                    const int linesPerGroup=28; // 线条数量
                    varying vec2 vUv;
                    #include <logdepthbuf_pars_fragment>
                    const vec4[]bgColors=vec4[]
                    (
                      lineColor*.5,
                      lineColor-vec4(.2,.2,.7,1)
                    );

                    #define drawCircle(pos,radius,coord)smoothstep(radius+gridSmoothWidth,radius,length(coord-(pos)))

                    #define drawSmoothLine(pos,halfWidth,t)smoothstep(halfWidth,0.,abs(pos-(t)))

                    #define drawCrispLine(pos,halfWidth,t)smoothstep(halfWidth+gridSmoothWidth,halfWidth,abs(pos-(t)))

                    #define drawPeriodicLine(freq,width,t)drawCrispLine(freq/2.,width,abs(mod(t,freq)-(freq)/2.))

                    float drawGridLines(float axis)
                    {
                      return drawCrispLine(0.,axisWidth,axis)
                      +drawPeriodicLine(majorLineFrequency,majorLineWidth,axis)
                      +drawPeriodicLine(minorLineFrequency,minorLineWidth,axis);
                    }

                    float drawGrid(vec2 space)
                    {
                      return min(1.,drawGridLines(space.x)
                      +drawGridLines(space.y));
                    }

                    // probably can optimize w/ noise, but currently using fourier transform
                    float random(float t)
                    {
                      return(cos(t)+cos(t*1.3+1.3)+cos(t*1.4+1.4))/3.;
                    }

                    float getPlasmaY(float x,float horizontalFade,float offset)
                    {
                      return random(x*lineFrequency+uTime*lineSpeed)*horizontalFade*lineAmplitude+offset;
                    }

                    void main()
                    {

                    vec2 vUvt=vec2(vUv-.5)*2.;
                      vec2 space=vUvt*2.*scale;

                      float horizontalFade=1.-(cos(vUvt.x*6.28)*.5+.5);
                      float verticalFade=1.-(cos(vUvt.y*6.28)*.5+.5);

                      // fun with nonlinear transformations! (wind / turbulence)
                      space.y+=random(space.x*warpFrequency+uTime*warpSpeed)*warpAmplitude*(.5+horizontalFade);
                      space.x+=random(space.y*warpFrequency+uTime*warpSpeed+2.)*warpAmplitude*horizontalFade;

                      vec4 lines=vec4(0);

                      for(int l=0;l<linesPerGroup;l++)
                      {
                        float normalizedLineIndex=float(l)/float(linesPerGroup);
                        float offsetTime=uTime*offsetSpeed;
                        float offsetPosition=float(l)+space.x*offsetFrequency;
                        float rand=random(offsetPosition+offsetTime)*.5+.5;
                        float halfWidth=mix(minLineWidth,maxLineWidth,rand*horizontalFade)/2.;
                        float offset=random(offsetPosition+offsetTime*(1.+normalizedLineIndex))*mix(minOffsetSpread,maxOffsetSpread,horizontalFade);
                        float linePosition=getPlasmaY(space.x,horizontalFade,offset);
                        float line=drawSmoothLine(linePosition,halfWidth,space.y)/2.+drawCrispLine(linePosition,halfWidth*.15,space.y);

                        float circleX=mod(float(l)+uTime*lineSpeed,25.)-12.;
                        vec2 circlePosition=vec2(circleX,getPlasmaY(circleX,horizontalFade,offset));
                        float circle=drawCircle(circlePosition,.01,space)*4.;

                        // line=line+circle;
                        lines+=line*lineColor*rand;
                      }

                      // gl_FragColor=mix(bgColors[0],bgColors[1],vUvt.x);
                      gl_FragColor*=verticalFade;
                      gl_FragColor.a=0.2;
                      // debug grid:
                      //gl_FragColor = mix(gl_FragColor, gridColor, drawGrid(space))
                      float dist = abs(vUvt.x - 0.0001);
                      float alpha = 1. - smoothstep(0.0000001, 0.99999, dist);
                    //   float alpha = 1.0;
                      gl_FragColor+=lines;
                      gl_FragColor.a = gl_FragColor.a * alpha * commonOpacity * (pow(sin(uTime),2.) + .48 );
                      #include <logdepthbuf_fragment>
                    }
                  `,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: config.depthTest,
            uniforms: {
                uTime: this.elapsedTime,
                uIndex: {
                    value: 2,
                },
                lineAmplitude: {
                    value: config.lineAmplitude
                },
                commonOpacity: {
                    value: config.commonOpacity
                }
            },
        });
        // this.material_bei = new THREE.ShaderMaterial({
        //     uniforms: {
        //         uElapseTime: { value: 0 },
        //         uCount: { value: config.segments },
        //         uColor1: { value: config.color1 },
        //         uColor2: { value: config.color2 },
        //         uOpacity: this.uOpacity,
        //     },
        //     vertexShader,
        //     fragmentShader,
        //     transparent: true,
        //     side: THREE.DoubleSide,
        //     forceSinglePass: true,
        //     depthTest: false
        // });
    }
    update(elapseTime) {
        // this.material.uniforms.uElapseTime.value = elapseTime;
        this.elapsedTime.value = elapseTime;
    }
}
class FlowLight2 extends THREE.Mesh {
    /**
     * 流光
     * @param {THREE.Vector3[]} vertices
     * @param {{width:number,radius:number,type:"line"|"tube",segments:number,color1:THREE.Vector3,color2:THREE.Vector3}} config
     */
    constructor(vertices,config = {}) {
        super();

        config.width = config.width || 1;
        config.radius = config.radius || 1;
        config.type = config.type || "line";
        config.segments = config.segments || 2;
        config.color1 = config.color1 || new THREE.Vector3(1,1,0);
        config.color2 = config.color2 || new THREE.Vector3(0.95,0.39,0.22);
        this.renderOrder = 1;

        this.uOpacity = { value: config.opacity === undefined ? 1 : config.opacity };

        if (Array.isArray(vertices)) {
            this.#createPath(vertices,config);
        } else {
            console.error("创建流光第一个参数必须是Vector3[]");
        }
        this.type = "FlowLight";
    }
    /**
     * 流光
     * @param {THREE.Vector3[]} vertices
     * @param {{width:number,radius:number,type:"line"|"tube",segments:number,color1:THREE.Vector3,color2:THREE.Vector3}} config
     */
    #createPath(vertices,config) {
        const up = new THREE.Vector3(0,1,0);
        const pathPointList = new PathPointList();
        pathPointList.set(vertices,0.5,10,up,false);

        if (config.type === "line") {
            this.geometry = new PathGeometry();
            this.geometry.update(pathPointList,{
                width: config.width,
                arrow: false,
                side: "both",
            });
        } else if (config.type === "tube") {
            this.geometry = new PathTubeGeometry();
            this.geometry.update(pathPointList,{
                arrow: false,
                side: "both",
                radius: config.radius,
            });
        }

        const vertexShader = `
        varying vec2 vUv;
        #include <logdepthbuf_pars_vertex>
        #include <common>

        void main(){
            vUv = uv;
            // vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            // gl_Position = projectionMatrix * mvPosition;
            #include <begin_vertex>
            #include <project_vertex>
            #include <logdepthbuf_vertex>
        }`;
        const fragmentShader = `
        uniform float uElapseTime;
        uniform float uCount;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uOpacity;
        uniform float speed;
        varying vec2 vUv;
        #include <logdepthbuf_pars_fragment>

        void main() {

            float p = uCount; //线段段数
            float al = fract(vUv.x * p - uElapseTime * speed*0.04);

            vec3 color = mix(uColor2,uColor1,pow(al,4.));

            float a = al*al;

            float t = uElapseTime;
            float final_a = a * step(vUv.x,t);

            gl_FragColor = vec4(color ,final_a*uOpacity);
            #include <logdepthbuf_fragment>
        }`;

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uElapseTime: { value: 0 },
                uCount: { value: config.segments },
                uColor1: { value: config.color1 },
                uColor2: { value: config.color2 },
                uOpacity: this.uOpacity,
                speed: { value: config.speed }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            forceSinglePass: true,
            depthTest: false,
            depthWrite: false
        });
    }
    update(elapseTime) {
        this.material.uniforms.uElapseTime.value = elapseTime;
    }
}

// 雨天，雪天，效果范围

// 默认粒子范围
const BOX = new THREE.Box3(new THREE.Vector3(-100,0,-100),new THREE.Vector3(100,100,100));

class Rain extends THREE.Mesh {
    #time;
    #config;
    #box;
    /**
     * @param { THREE.Box3 } box 粒子范围
     * @param { { speed: number, count: number, size: number} } _config 粒子配置
     */
    constructor(box = BOX,_config) {
        super();
        this.#config = _config;
        this.#box = box;
        this.#time = 0;

        this.geometry = this.createGeometry();
        this.material = this.createMaterial();
        this.renderOrder = 10;
    }

    createMaterial() {
        //创建雨
        const rainMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
        });

        rainMaterial.onBeforeCompile = shader => {
            const getFoot = `
        uniform float top;
        uniform float bottom;
        uniform float time;

        varying vec2 vUv;

        #include <common>

        float angle(float x, float y){

            return atan(y,x);

        }

        vec2 getFoot(vec2 camera,vec2 normal,vec2 pos){

            vec2 position;

            float distanceLen = distance(pos, normal);

            float a = angle(camera.x - normal.x, camera.y - normal.y);

            pos.x > normal.x ? a -= 0.785 : a += 0.785;

            position.x = cos(a) * distanceLen;

            position.y = sin(a) * distanceLen;

            return position + normal;

        }

        `;

            const begin_vertex = `

        vUv = uv;

        vec2 foot = getFoot(vec2(cameraPosition.x, cameraPosition.z),  vec2(normal.x, normal.z), vec2(position.x, position.z));

        float height = top - bottom;

        float y = normal.y - bottom - height * time;

        y = y + (y < 0.0 ? height : 0.0);

        float ratio = (1.0 - y / height) * (1.0 - y / height);

        y = height * (1.0 - ratio);

        y += bottom;

        y += position.y - normal.y;

        vec3 transformed = vec3( foot.x, y, foot.y );

        `;

            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",

                getFoot,
            );

            shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",

                begin_vertex,
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <common>",

                `

       #include <common>

       varying vec2 vUv;

       uniform vec3 uColor;

       `,
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <dithering_fragment>`,

                `

       #include <dithering_fragment>

       float a = 0.0;

       float t = 0.25/sqrt(0.05);

       float x = vUv.x;

       float y = vUv.y;

       float z = pow(1.0 - vUv.y, 2.0);

       float distanceLen = distance(vUv,vec2(0.5,0.3));

       a = z * step(y,0.5) * step(distanceLen,0.3);

       if(a==0.0) a = z * step(0.5,y) * step(0.5,x) * step(y,-2.0*t*x+t+1.0);

       if(a==0.0) a = z * step(0.5,y) * step(x,0.5) * step(y,2.0*t*x+1.0-t);

       vec4 color = vec4(uColor,a);

       gl_FragColor = color;

       `,
            );

            shader.uniforms.cameraPosition = {
                value: new THREE.Vector3(0,200,0),
            };

            shader.uniforms.top = {
                value: this.#box.max.y,
            };

            shader.uniforms.bottom = {
                value: 0,
            };

            shader.uniforms.time = {
                value: 0,
            };

            shader.uniforms.uColor = {
                value: new THREE.Color(0xb8b8b8),
            };

            rainMaterial.uniforms = shader.uniforms;
        };

        return rainMaterial;
    }

    createGeometry() {
        const box = this.#box;

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        for (let i = 0; i < this.#config.count; i++) {
            const pos = new THREE.Vector3();
            pos.x = Math.random() * (box.max.x - box.min.x) + box.min.x;
            pos.y = Math.random() * (box.max.y - box.min.y) + box.min.y;
            pos.z = Math.random() * (box.max.z - box.min.z) + box.min.z;
            const height = (this.#config.size * (box.max.y - box.min.y)) / 40;
            const width = height / 40;
            vertices.push(
                pos.x + width,
                pos.y + height,
                pos.z,
                pos.x - width,
                pos.y + height,
                pos.z,
                pos.x - width,
                pos.y,
                pos.z,
                pos.x + width,
                pos.y,
                pos.z,
            );

            normals.push(
                pos.x,
                pos.y - height / 2,
                pos.z,
                pos.x,
                pos.y - height / 2,
                pos.z,
                pos.x,
                pos.y - height / 2,
                pos.z,
                pos.x,
                pos.y - height / 2,
                pos.z,
            );

            uvs.push(1,1,0,1,0,0,1,0);

            indices.push(i * 4 + 0,i * 4 + 1,i * 4 + 2,i * 4 + 0,i * 4 + 2,i * 4 + 3);
        }

        geometry.setAttribute(
            "position",

            new THREE.BufferAttribute(new Float32Array(vertices),3),
        );

        geometry.setAttribute(
            "normal",

            new THREE.BufferAttribute(new Float32Array(normals),3),
        );

        geometry.setAttribute(
            "uv",

            new THREE.BufferAttribute(new Float32Array(uvs),2),
        );

        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));

        return geometry;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }

    update(deltaTime,cameraPosition) {
        this.#time = (this.#time + deltaTime * this.#config.speed) % 1;
        if (this.material && "uniforms" in this.material) {
            this.material.uniforms.cameraPosition.value = cameraPosition;
            this.material.uniforms.time.value = this.#time;
        }
    }
}

class Snow extends THREE.Points {
    config;
    box;
    positionBackup = [];
    /**
     * @param { THREE.Box3 } box 粒子范围
     * @param { { speed: number, count: number, size: number} } _config 粒子配置
     */
    constructor(box,_config) {
        super();
        this.config = _config;
        this.box = box;
        this.geometry = this.createGeometry();
        this.material = this.createMaterial();
        this.renderOrder = 10;
    }

    createMaterial() {
        const material = new THREE.PointsMaterial({
            size: this.config.size,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        });

        material.onBeforeCompile = shader => {
            shader.uniforms.uColor = {
                value: new THREE.Color(0xffffff),
            };

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <common>`,
                `
                #include <common>
                uniform vec3 uColor;
                `,
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <premultiplied_alpha_fragment>`,
                `
               #include <premultiplied_alpha_fragment>
               float strength = distance(gl_PointCoord, vec2(0.5));
               strength = 1.0 - strength;
               strength = pow(strength, 5.0);
               gl_FragColor = vec4(uColor, strength);
         `,
            );
        };
        return material;
    }

    createGeometry() {
        const box = this.box;
        const count = this.config.count;
        const geometry = new THREE.BufferGeometry();
        let positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = Math.random() * (box.max.x - box.min.x) + box.min.x;
            positions[i + 1] = Math.random() * (box.max.y - box.min.y) + box.min.y;
            positions[i + 2] = Math.random() * (box.max.z - box.min.z) + box.min.z;
            this.positionBackup.push(positions[i],positions[i + 1],positions[i + 2]);
        }

        geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
        return geometry;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
    update() {
        if (this.geometry) {
            const positions = this.geometry.getAttribute("position").array;

            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] -= this.config.speed;

                if (positions[i + 1] < this.box.min.y) {
                    positions[i + 1] = this.box.max.y;
                    positions[i] = this.positionBackup[i];
                    positions[i + 2] = this.positionBackup[i + 2];
                }

                positions[i + 2] += Math.sin(i) * Math.random() * 0.1;
                positions[i] -= Math.cos(i) * Math.random() * 0.1;
            }

            this.geometry.getAttribute("position").needsUpdate = true;
        }
    }
}

class Lake extends Water {
    /**
     *  @param {THREE.Mesh<THREE.BufferGeometry,any>} mesh
     */
    constructor(mesh) {
        // const points = [];
        // const positionAttribute = mesh.geometry.getAttribute("position");
        // for (let i = 0; i < positionAttribute.count; i++) {
        //     const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        //     points.push(new THREE.Vector2(vertex.x, vertex.z));
        // }
        // const hull = convexHull(points);

        // const geometry = new THREE.ShapeGeometry(new THREE.Shape(hull));

        // options
        const normal = new THREE.TextureLoader().load("./textures/water_normal.jpg");
        normal.wrapS = normal.wrapT = THREE.RepeatWrapping;

        const options = {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: normal,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 0.6,
            size: 2,
        };
        mesh.geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        super(mesh.geometry,options);

        this.rotation.x = -Math.PI / 2;
    }

    update = () => {
        this.material.uniforms["time"].value += 1.0 / 180.0;
    };
}

class Smoke extends THREE.Points {
    #particles;
    time;
    constructor(speed = new THREE.Vector3(0,1,0),size = 10) {
        super();
        this.#particles = [];
        this.time = 0;
        this.speed = speed;
        this.size = size;
        this.createPoints();
        this.lightingPattern = { value: 1 };
    }

    update() {
        if (Date.now() - this.time > 1000) {
            this.#particles.push(new Particle(this.speed,this.size));
            this.time = Date.now();
        }
        this.smokeUpdate();
    }

    updateLightingPattern(value) {
        this.lightingPattern.value = value;
    }
    createPoints() {
        const texture = new THREE.TextureLoader().load("./textures/smoke.png");
        const geometry = new THREE.BufferGeometry();
        // 设置顶点数据
        geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array([]),3));
        geometry.setAttribute("a_opacity",new THREE.BufferAttribute(new Float32Array([]),1));
        geometry.setAttribute("a_size",new THREE.BufferAttribute(new Float32Array([]),1));
        geometry.setAttribute("a_scale",new THREE.BufferAttribute(new Float32Array([]),1));
        this.geometry = geometry;
        // material
        this.material = new THREE.PointsMaterial({
            color: "#fff",
            map: texture,
            transparent: true,
            depthWrite: false,
        });

        this.material.onBeforeCompile = shader => {
            shader.uniforms.uStyle = this.lightingPattern;
            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
     attribute float a_opacity;
     attribute float a_size;
     attribute float a_scale;
     varying float v_opacity;
     #include <common>`,
            );
            shader.vertexShader = shader.vertexShader.replace(
                "gl_PointSize = size;",
                `v_opacity = a_opacity;
     gl_PointSize = a_size * a_scale;`,
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <common>",
                `varying float v_opacity;
         uniform float uStyle;
             #include <common>`,
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <premultiplied_alpha_fragment>",
                `#include <premultiplied_alpha_fragment>
        vec3 c = outgoingLight;
       gl_FragColor = vec4( c.x,c.y,c.z, diffuseColor.a * v_opacity );
      //  if(uStyle > 1.0){
      //    gl_FragColor = vec4( c.x + pow(v_opacity , 2.0) ,c.y,c.z*(1.0 - v_opacity), diffuseColor.a * v_opacity );
      //  }
      //  gl_FragColor = vec4( 0.2,0.3,0.4,gl_PointCoord.x );

       `,
            );
        };
    }

    smokeUpdate() {
        const particles = this.#particles.filter(particle => {
            particle.update();
            return !(particle.updateTime - particle.createTime > particle.life);
        });
        this.#particles = particles;

        if (!particles.length) return;

        // 遍历粒子,收集属性
        const positionList = [];
        const opacityList = [];
        const scaleList = [];
        const sizeList = [];

        particles.forEach(particle => {
            const { x,y,z } = particle.position;
            positionList.push(x,y,z);
            opacityList.push(particle.opacity);
            scaleList.push(particle.scale);
            sizeList.push(particle.size);
        });
        // 粒子属性写入
        this.geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(positionList),3));
        this.geometry.setAttribute("a_opacity",new THREE.BufferAttribute(new Float32Array(opacityList),1));
        this.geometry.setAttribute("a_scale",new THREE.BufferAttribute(new Float32Array(scaleList),1));
        this.geometry.setAttribute("a_size",new THREE.BufferAttribute(new Float32Array(sizeList),1));
    }
}

class Particle {
    constructor(speed = new THREE.Vector3(0,1,0),size = 10) {
        this.position = new THREE.Vector3(); // 粒子位置
        this.life = 10000; // 粒子的存活时间，毫秒
        this.createTime = Date.now(); // 粒子创建时间
        this.updateTime = Date.now(); // 上次更新时间
        this.size = size; // 粒子大小

        // 粒子透明度，及系数
        this.opacityFactor = 0.2;
        this.opacity = this.opacityFactor;

        // 粒子放大量，及放大系数
        this.scaleFactor = 2;
        this.scale = 1 + (this.scaleFactor * (this.updateTime - this.createTime)) / this.life; // 初始1，到达生命周期时为3

        // 粒子的扩散速度
        this.speed = speed;
    }

    // 更新粒子
    update() {
        const now = Date.now();
        const time = now - this.updateTime;

        // 更新位置
        this.position.x += (this.speed.x * time) / 1000;
        this.position.y += (this.speed.y * time) / 1000;
        this.position.z += (this.speed.z * time) / 1000;

        // 计算粒子透明度
        this.opacity = 1 - (now - this.createTime) / this.life;
        this.opacity *= this.opacityFactor;
        if (this.opacity < 0) this.opacity = 0;

        // 计算放大量
        this.scale = 1 + (this.scaleFactor * (now - this.createTime)) / this.life;
        if (this.scale > 1 + this.scaleFactor) this.scale = 1 + this.scaleFactor;

        // 重置更新时间
        this.updateTime = now;
    }
}

class FatLine extends Line2 {
    /**
     * @param { LineMaterialParameters  } parameters
     */
    constructor(parameters) {
        super();
        this.geometry = new LineGeometry();
        this.material = new LineMaterial(parameters);
        this.material.resolution.set(window.innerWidth,window.innerHeight);
    }

    onResize(innerWidth,innerHeight) {
        this.material.resolution.set(innerWidth,innerHeight);
    }
    /**
     * @param { number[] }
     */
    setPositions(positions) {
        this.geometry.setPositions(positions);
        return this;
    }
    /**
     * @param { THREE.Vector3[] }
     */
    setPoints(points) {
        this.setPositions(vec3ToNumber(points));
        return this;
    }

    /**
     * @description 释放内存，当销毁时，请调用该方法
     */
    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}

class StarLink extends THREE.Points {
    constructor(width = 100,height = 100,count = 1000) {
        super();
        this.points = [];
        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(width,height));

        this.plane.rotation.x = -Math.PI / 2;
        this.plane.material.side = THREE.DoubleSide;
        this.plane.updateMatrixWorld();

        this.createGeometry(width,height,count);
        this.createMaterial();

        function distance(a,b) {
            const dx = a.x - b.x;
            const dz = a.z - b.z;
            return Math.sqrt(dx * dx + dz * dz);
        }

        this.tree = new kdTree(this.points,distance,["x","z"]);
        this.onmousemove = this.bindMousemove.bind(this);
    }

    createGeometry(width,height,count) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * width - width / 2;
            const y = 0;
            const z = Math.random() * height - height / 2;
            this.points.push(new THREE.Vector3(x,y,z));
        }
        this.geometry.setFromPoints(this.points);
    }
    createMaterial() {
        this.material = new THREE.PointsMaterial({ transparent: true,vertexColors: true,size: 1,alphaTest: 0.1 });

        this.material.onBeforeCompile = shader => {
            shader.uniforms.uColor = {
                value: new THREE.Color(0xffffff),
            };

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <common>`,
                `
       #include <common>
       uniform vec3 uColor;
       `,
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <premultiplied_alpha_fragment>`,
                `
       #include <premultiplied_alpha_fragment>
             float strength = distance(gl_PointCoord, vec2(0.5));

             float da = distance(gl_PointCoord, vec2(0.,0.));
             float db = distance(gl_PointCoord, vec2(0.,1.));
             float dc = distance(gl_PointCoord, vec2(1.,1.));
             float dd = distance(gl_PointCoord, vec2(1.,0.));

             float r = step(0.5,da) + step(0.5,db) + step(0.5,dc) + step(0.5,dd);
             float t = step(4.,r);

             strength = 0.5 - strength;
             strength = pow(strength, 1.0);
             gl_FragColor = vec4(uColor, strength*t);
       `,
            );
        };
    }

    bindMousemove(intersects) {
        if (intersects.length) {
            const point = intersects[0].point;
            const nearest = this.tree.nearest(point,100,10);
        }
    }
}

class SpecialGround extends THREE.Mesh {
    /**@param {THREE.Box3} aabb BoundingBox */
    constructor(center,min) {
        super();
        this.elapsedTime = { value: 0 };
        this.position.set(center.x,min.y - 20,center.z);
        this.geometry = new THREE.PlaneGeometry(8000,8000);
        this.geometry.rotateX(-Math.PI / 2);
        this.material = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            transparent: true,
            uniforms: {
                uTime: this.elapsedTime,
            },
            vertexShader: `
        varying vec2 vUv;
        void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
        `,
            fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main(){
            vec2 uv=(vUv-.5)*2.;

            // create grid
            vec2 frac=fract(uv*88.);
            float vertical_lines=step(frac.x,.1);
            float horizontal_lines=step(frac.y,.1);
            float lines=vertical_lines+horizontal_lines;
            vec3 col=vec3(lines);

            // create circles
            float d=length(uv);
            d=sin(d*2.-uTime*.8)/40.;
            d=abs(d);
            d=pow(.005/d,.4);
            vec3 col1=vec3(0.69921875, 0.84765625, 0.84765625);
            vec3 col2=vec3(0.6, 0.3922, 0.9137);
            vec3 col3=mix(col1,col2,pow(length(uv),4.));
            col*=d*.2*col3;
            float a =(1.-length(uv))*0.4;
            gl_FragColor=vec4(col,a);

        }
        `,
        });
    }

    update(core) {
        this.elapsedTime.value = core.elapsedTime;
    }
}

const DEFAULT_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffffff });
const SELECT_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xff0000 });
class RangeBox extends THREE.Group {
    /**@type {THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>} */
    minBall;

    /**@type {THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>} */
    maxBall;

    /**@type {THREE.Line<THREE.BufferGeometry,THREE.MeshBasicMaterial>} */
    line;

    /**@type {THREE.Box3Helper} */
    box;

    get min() {
        return this.minBall.position;
    }

    set min(value) {
        if (value instanceof THREE.Vector3) {
            this.minBall.position.copy(value);
        } else if (this.vector3Like(value)) {
            this.minBall.position.set(value.x,value.y,value.z);
        } else {
            console.warn("RangeBox.min 需要赋值 Vector3:{ x:number,y:number,z:number }");
        }

        this.update();
    }

    get max() {
        return this.maxBall.position;
    }

    set max(value) {
        if (value instanceof THREE.Vector3) {
            this.maxBall.position.copy(value);
        } else if (this.vector3Like(value)) {
            this.maxBall.position.set(value.x,value.y,value.z);
        } else {
            console.warn("RangeBox.min 需要赋值 Vector3:{ x:number,y:number,z:number }");
        }

        this.update();
    }
    constructor() {
        super();
        this.createBall();
        this.createLine();
        this.createBox();
    }

    createLine() {
        const { x: minX,y: minY,z: minZ } = this.min;
        const { x: maxX,y: maxY,z: maxZ } = this.max;

        const vertices = new Float32Array([minX,minY,minZ,maxX,maxY,maxZ]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position",new THREE.BufferAttribute(vertices,3));
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000,depthTest: false });

        this.line = new THREE.Line(geometry,material);
        this.add(this.line);
    }

    createBall() {
        const geometry = new THREE.SphereGeometry(1,32,32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000,depthTest: false });

        this.minBall = new THREE.Mesh(geometry,material);
        this.maxBall = new THREE.Mesh(geometry.clone(),material.clone());

        this.add(this.minBall,this.maxBall);
    }

    createBox() {
        this.box = new THREE.Box3Helper(new THREE.Box3(this.min,this.max));
        this.box.material.depthTest = false;

        this.add(this.box);
    }

    update() {
        const positionAttribute = this.line.geometry.getAttribute("position");

        this.min.min(this.max);
        this.max.max(this.min);

        const { x: minX,y: minY,z: minZ } = this.min;
        const { x: maxX,y: maxY,z: maxZ } = this.max;

        positionAttribute.array[0] = minX;
        positionAttribute.array[1] = minY;
        positionAttribute.array[2] = minZ;
        positionAttribute.array[3] = maxX;
        positionAttribute.array[4] = maxY;
        positionAttribute.array[5] = maxZ;

        positionAttribute.needsUpdate = true;
    }

    /**
     * 选择BOX3辅助工具的 min 或者 max
     * @param { "min"|"max"|"none" } type
     */
    select(type) {
        if (type === "min" || type === "max") {
            const selectBall = type === "min" ? this.minBall : this.maxBall;
            const anotherBall = type === "max" ? this.minBall : this.maxBall;

            selectBall.material = SELECT_MATERIAL;
            anotherBall.material = DEFAULT_MATERIAL;
        } else if (type === "none") {
            this.minBall.material = this.maxBall.material = DEFAULT_MATERIAL;
        } else {
            return;
        }
    }

    vector3Like(value) {
        return !isNaN(value.x) && !isNaN(value.y) && !isNaN(value.z);
    }
}

class HeatCircle extends THREE.Mesh {
    /**
     *
     * @param {THREE.Vector3} center 热图中心
     * @param {number} radius 热图半径
     * @param {1|2|3} level 热图热度
     */
    constructor(center = ZeroVec3,radius = 1,level = 1) {
        super();

        this.position.copy(center);

        this.geometry = new THREE.PlaneGeometry(radius,radius,10,10);
        this.geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide,
            uniforms: {
                uLevel: {
                    value: level,
                },
            },
            vertexShader: `

            #include <common>
            varying vec2 vSt;

            #ifdef USE_LOGDEPTHBUF
                #ifdef USE_LOGDEPTHBUF_EXT
                    varying float vFragDepth;
                    varying float vIsPerspective;
                #else
                    uniform float logDepthBufFC;
                #endif
            #endif

            void main(){

                // mvp
                vec4 modelPosition = modelMatrix * vec4 ( position, 1.0);
                modelPosition.y += 0.5 * smoothstep(0.5,0., distance(uv,vec2(0.5,0.5)));
                gl_Position = projectionMatrix * viewMatrix * modelPosition;

                vSt = uv;

                // depthTest
                #ifdef USE_LOGDEPTHBUF
                    #ifdef USE_LOGDEPTHBUF_EXT
                        vFragDepth = 1.0 + gl_Position.w;
                        vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
                    #else
                        if ( isPerspectiveMatrix( projectionMatrix ) ) {
                            gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
                            gl_Position.z *= gl_Position.w;
                        }
                    #endif
                #endif
            }
            `,
            fragmentShader: `
            varying vec2 vSt;
            uniform float uLevel;
            #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
                uniform float logDepthBufFC;
                varying float vFragDepth;
                varying float vIsPerspective;
            #endif

            // compute color , 如果需要修改颜色生成逻辑，请在这里进行修改
            vec3 getColor(float z,float level){
                float r = 1.0;
                float g = 0.3333333*(3.-level) + 0.196 * smoothstep( 0.0 , .5, z);
                // float g = 0.0;
                // if(level == 1.) g = 0.6666666 + 0.196 * smoothstep( 0.0 , .5, z);
                // if(level == 2.) g = 0.3333333 + 0.196 * smoothstep( 0.0 , .5, z);
                // if(level == 3.) g = 0.196 * smoothstep( 0.0 , .5, z);
                float b = 0.0;
                return vec3(r,g,b);
            }

            void main(){

                #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
                    gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
                #endif
                vec2 center = vec2(0.5,0.5);

                float d = distance(vSt,center);
                float a = step(d,0.5);

                vec3 color = getColor(d,uLevel);

                gl_FragColor = vec4(color,0.75*a);
            }
            `,
        });

        this.renderOrder = 10;
    }
}

export { FlowLight,FlowLight2,Rain,Snow,Lake,Smoke,FatLine,StarLink,SpecialGround,RangeBox,HeatCircle };
