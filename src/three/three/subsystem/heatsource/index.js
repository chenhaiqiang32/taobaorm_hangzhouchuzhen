changeDevice(id, status) {
    let color = this.statusColor[status];

    if (this.modelsEquip[id]) {
        console.log(this.modelsEquip[id], 4444);
        this.modelsEquip[id].traverse(child => {
            if (child instanceof THREE.Mesh) {
                // Create custom shader material with enhanced effects
                const customMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        baseColor: { value: new THREE.Color(color) },
                        fresnelColor: { value: new THREE.Color(color).multiplyScalar(2.0) },
                        time: { value: 0 },
                        fresnelPower: { value: 1.5 },
                        pulseSpeed: { value: 1.5 },
                        glowIntensity: { value: 1.0 },
                        rimLightColor: { value: new THREE.Color(color).multiplyScalar(1.5) },
                        rimLightPower: { value: 2.0 }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vViewPosition;
                        varying vec2 vUv;
                        varying vec3 vPosition;
                        varying float vDepth;
                        
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                            vViewPosition = -mvPosition.xyz;
                            vUv = uv;
                            vPosition = position;
                            
                            // Calculate depth
                            vec4 clipPosition = projectionMatrix * mvPosition;
                            vDepth = clipPosition.z / clipPosition.w;
                            
                            gl_Position = clipPosition;
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 baseColor;
                        uniform vec3 fresnelColor;
                        uniform vec3 rimLightColor;
                        uniform float time;
                        uniform float fresnelPower;
                        uniform float pulseSpeed;
                        uniform float glowIntensity;
                        uniform float rimLightPower;
                        
                        varying vec3 vNormal;
                        varying vec3 vViewPosition;
                        varying vec2 vUv;
                        varying vec3 vPosition;
                        varying float vDepth;
                        
                        // Improved noise function
                        float noise(vec2 p) {
                            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                        }
                        
                        void main() {
                            vec3 normal = normalize(vNormal);
                            vec3 viewDir = normalize(vViewPosition);
                            
                            // Enhanced fresnel effect
                            float fresnel = pow(1.0 - abs(dot(normal, viewDir)), fresnelPower);
                            
                            // Pulsing effect with smoother transition
                            float pulse = sin(time * pulseSpeed) * 0.5 + 0.5;
                            
                            // Rim lighting effect
                            float rimLight = pow(1.0 - abs(dot(normal, viewDir)), rimLightPower);
                            
                            // Dynamic noise pattern
                            float noiseValue = noise(vUv + time * 0.1);
                            
                            // Combine effects with enhanced glow
                            vec3 finalColor = mix(baseColor, fresnelColor, fresnel * pulse);
                            finalColor += rimLightColor * rimLight * pulse;
                            finalColor += noiseValue * glowIntensity * 0.2;
                            
                            // Add subtle edge glow
                            float edgeGlow = smoothstep(0.0, 0.1, fresnel);
                            finalColor += edgeGlow * fresnelColor * 0.5;
                            
                            // Enhance overall brightness
                            finalColor *= 1.2;
                            
                            // Output final color with depth
                            gl_FragColor = vec4(finalColor, 1.0);
                            gl_FragDepth = vDepth;
                        }
                    `,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthTest: true,
                    depthWrite: true,
                    depthFunc: THREE.LessEqualDepth,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1
                });

                // Store original material
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }

                // Apply new material
                child.material = customMaterial;

                // Add to animation loop
                if (!this.materialAnimations) {
                    this.materialAnimations = new Set();
                }
                this.materialAnimations.add(customMaterial);
            }
        });
    }
} 