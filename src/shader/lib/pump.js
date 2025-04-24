export const pumpShaderChunk = `
if(uStyle == SCIENCE){
 vec3 viewDir = normalize(cameraPosition - mPosition.xyz);
 float rez = clamp(abs(dot(viewDir,mNormal)),0.0,1.0);
 float intensity = 1. - rez;
 gl_FragColor = vec4(uColor,pow(intensity,2.) * opacity);
}
`;
