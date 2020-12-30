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
  int count = 0;
  float returnVal = 0.0;
  while(index < 20) {
    if(coefficients[2 * index] > 0.0 || coefficients[2 * index + 1] > 0.0) {
      returnVal += sin(coefficients[2 * index] * x / scale +
                       coefficients[2 * index + 1] * y / scale);
      count++;
    //} else {
    //  break;;
    }
    index++;
  }
  if(index > 0) {
    returnVal /= sqrt(float(count));
  }

  return returnVal * weight;
}

float get_noise(float x, float y) {
  return (get_octave_value(noiseCoeficientLow, noiseWeightLow, x, y) +
          get_octave_value(noiseCoeficientMid, noiseWeightMid, x, y) +
          get_octave_value(noiseCoeficientHigh, noiseWeightHigh, x, y)) / 3.0;
}

void main(void) {
    #include<clipPlaneFragment>
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);

    vec4 baseColor = vec4(1., 1., 1., 1.);
    vec3 diffuseColor = vDiffuseColor.rgb;

    float x = vPositionW.x;
    float y = vPositionW.y;
    float z = vPositionW.z;

    float noiseVal = get_noise(x, z);
    if (y / scale >= 10.0 - 5.0 * noiseVal) {
      // Snow
      diffuseColor.rgb = vec3(0.66, 0.78, .82);
    } else if (y / scale >= shoreline) {
      // Land
      if (pow(noiseVal, 5.) * y > 2.) {
        // Rock
        diffuseColor.rgb = vec3(0.35, 0.4, 0.4);
      } else {
        // Grass
        diffuseColor.rgb = vec3(0.24, 0.24 + 0.23 / y - (noiseVal / 255.0), 0.16);
      }
    } else {
      // Below shoreline
      float multiplier = clamp(y / scale / shoreline, 0.0, 1.0);
      if (noiseVal > 0.2) {
        // Rock
        diffuseColor.rgb = vec3(0.45 * multiplier, 0.4 * multiplier, 0.3 * multiplier);
      } else {
        // Sand
        diffuseColor.rgb = vec3(0.78 * multiplier, 0.78 * multiplier, 0.27 * multiplier);
      }
    }

    //float clampedNoiseVal = clamp(noiseVal, 0.0, 1.0);
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
