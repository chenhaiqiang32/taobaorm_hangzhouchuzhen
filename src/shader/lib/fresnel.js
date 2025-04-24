
export const fresnelChunk = /* glsl */ `
     vec3 viewDir = normalize(cameraPosition - mPosition.xyz);
     float intensity = 1.0 - dot( mNormal,viewDir);
    gl_FragColor = vec4(uColor,pow(intensity,fresnelLevel));

    //  gl_FragColor = vec4(0.0,intensity,intensity,pow(intensity,3.0)*0.6);

`;
