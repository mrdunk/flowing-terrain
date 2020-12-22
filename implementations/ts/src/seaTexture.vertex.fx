precision highp float;

// Attributes
attribute vec2 uv;
attribute vec3 position;

// Uniforms
uniform mat4 worldViewProjection;
uniform float time;

// Varying
varying vec2 vUV;
varying vec3 vPosition;
//varying float vTime;

void main(void) {
    gl_Position = worldViewProjection * vec4(position, 1.0);
    
    vUV = uv;
    vPosition = position;
    //vTime = time;
}
