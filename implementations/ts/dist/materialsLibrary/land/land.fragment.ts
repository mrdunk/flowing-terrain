let name = 'landPixelShader';
let shader = `precision highp float;

uniform vec4 vEyePosition;
uniform vec4 vDiffuseColor;
uniform float[40] noiseCoeficientLow;
uniform float[40] noiseCoeficientMid;
uniform float[40] noiseCoeficientHigh;
uniform float noiseWeightLow;
uniform float noiseWeightMid;
uniform float noiseWeightHigh;
uniform float scale;
uniform float shoreline;

varying vec3 vPositionW;
#ifdef NORMAL
varying vec3 vNormalW;
#endif
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif

#include<helperFunctions>

#include<__decl__lightFragment>[0..maxSimultaneousLights]
#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>

#ifdef DIFFUSE
varying vec2 vDiffuseUV;
uniform sampler2D diffuseSampler;
uniform vec2 vDiffuseInfos;
#endif
#include<clipPlaneFragmentDeclaration>

#include<fogFragmentDeclaration>

float get_octave_value(float[40] coefficients, float weight, float x, float y) {
  int index = 0;
  float count = 0.;
  float returnVal = 0.0;
  while(index < 20) {
    if(coefficients[2 * index] > 0.0 || coefficients[2 * index + 1] > 0.0) {
      returnVal += sin(coefficients[2 * index] * x / scale +
                       coefficients[2 * index + 1] * y / scale);
      count += 1.;
    //} else {
    //  break;;
    }
    index++;
  }
  if(count > 0.) {
    returnVal /= sqrt(count);
  }

  return returnVal * weight;
}

float get_noise(float x, float y) {
  return (get_octave_value(noiseCoeficientLow, noiseWeightLow, x, y) +
          get_octave_value(noiseCoeficientMid, noiseWeightMid, x, y) +
          get_octave_value(noiseCoeficientHigh, noiseWeightHigh, x, y)) / 3.0;
}

const vec3 snow = vec3(0.66, 0.78, 0.82);
const vec3 grass = vec3(0.24, 0.5, 0.16);
const vec3 scrub = vec3(0.24, 0.2, 0.16);
const vec3 rock = vec3(0.25, 0.3, 0.3);
const vec3 sand = vec3(0.78, 0.78, 0.27);
const float snowline = 10.0;

void main(void) {
    #include<clipPlaneFragment>
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);

    vec4 baseColor = vec4(1., 1., 1., 1.);
    vec3 diffuseColor = vDiffuseColor.rgb;

    float x = vPositionW.x;
    float y = vPositionW.y;
    float z = vPositionW.z;

    float noiseVal = get_noise(x, z);
    float clampedNoiseVal = clamp(noiseVal, 0.001, 10.0);
    if (y / scale >= snowline - (snowline * clampedNoiseVal / 2.0)) {
      // Snow
      diffuseColor.rgb = snow;
    } else if (y / scale >= shoreline + clampedNoiseVal / 4.0) {
      // Land
      if (pow(clampedNoiseVal, 5.) * y > 2.) {
        diffuseColor.rgb = rock;
      } else {
        //diffuseColor.rgb = vec3(0.24, 0.24 + 0.23 / y - (noiseVal / 255.0), 0.16);
        diffuseColor.rgb = mix(grass, scrub, (y / snowline + noiseVal) / 2.0);
      }
    } else {
      // Below shoreline
      float multiplier = clamp(y / scale / shoreline, 0.0, 1.0);
      if (clampedNoiseVal > 0.1) {
        diffuseColor.rgb = rock * multiplier;
      } else {
        diffuseColor.rgb = sand * multiplier;
      }
    }

    //diffuseColor.rgb = vec3(clampedNoiseVal, clampedNoiseVal, clampedNoiseVal);

    float alpha = vDiffuseColor.a;
    #ifdef DIFFUSE
    baseColor = texture2D(diffuseSampler, vDiffuseUV);

    #include<depthPrePass>
    baseColor.rgb *= vDiffuseInfos.y;
    #endif

    #ifdef VERTEXCOLOR
    baseColor.rgb *= vColor.rgb;
    #endif

    #ifdef NORMAL
    vec3 normalW = normalize(vNormalW);
    #else
    vec3 normalW = vec3(1.0, 1.0, 1.0);
    #endif

    vec3 diffuseBase = vec3(0., 0., 0.);
    lightingInfo info;
    float shadow = 1.;
    float glossiness = 0.;

    #ifdef SPECULARTERM
    vec3 specularBase = vec3(0., 0., 0.);
    #endif

    #include<lightFragment>[0..maxSimultaneousLights]

    #ifdef VERTEXALPHA
    alpha *= vColor.a;
    #endif
    
    vec3 finalDiffuse = clamp(diffuseBase * diffuseColor, 0.0, 1.0) * baseColor.rgb;

    vec4 color = vec4(finalDiffuse, alpha);
    #include<fogFragment>
    gl_FragColor = color;
    #include<imageProcessingCompatibility>
}`;

BABYLON.Effect.ShadersStore[name] = shader;
/** @hidden */
export var landPixelShader = { name, shader };
