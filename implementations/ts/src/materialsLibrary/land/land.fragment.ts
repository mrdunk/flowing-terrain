let name = 'landPixelShader';
let shader = `precision highp float;
precision highp int;
precision highp usampler2D;

// Colors for terrain.
const vec3 river = vec3(0., 0.10, 0.82);
const vec3 snow = vec3(0.66, 0.78, 0.82);
const vec3 grass = vec3(0.24, 0.5, 0.16);
const vec3 scrub = vec3(0.24, 0.2, 0.16);
const vec3 rock = vec3(0.25, 0.3, 0.3);
const vec3 sand = vec3(0.78, 0.78, 0.27);
const vec3 wave = vec3(0.80, 0.90, 0.90);

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
uniform float sealevel;
uniform float snowline;
uniform float rockLikelihood;
uniform float riverWidth;
uniform float riverLikelihood;
uniform usampler2D drainage;
uniform usampler2D waveHeight;

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

// Get summary of a point's wave data from the waveHeight texture.
uvec4 getWaveSummary(vec2 point) {
    return texture2D(waveHeight, (point + vec2(0.5, 0.5)) / 100.);
}

// Helper function for repeatable noise value unique to a set of map coordinates.
float get_octave_value(float[40] coefficients, float x, float y) {
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

  return returnVal;
}

// Return repeatable noise value unique to a set of map coordinates.
float get_noise(float x, float y) {
  return (get_octave_value(noiseCoeficientLow, x, y) * noiseWeightLow +
          get_octave_value(noiseCoeficientMid, x, y) * noiseWeightMid +
          get_octave_value(noiseCoeficientHigh, x, y) * noiseWeightHigh);
}

// Return one offset to a neighbouring tile from a bitmap.
// The value is cleared from the passed bitmap.
vec2 getOffset(inout uint bitmap) {
    if ((bitmap & uint(2)) > uint(0)) {
        bitmap &= ~uint(2);
        return vec2(-1.0, 0.0);
    } else if ((bitmap & uint(64)) > uint(0)) {
        bitmap &= ~uint(64);
        return vec2(1.0, 0.0);
    } else if ((bitmap & uint(8)) > uint(0)) {
        bitmap &= ~uint(8);
        return vec2(0.0, -1.0);
    } else if ((bitmap & uint(16)) > uint(0)) {
        bitmap &= ~uint(16);
        return vec2(0.0, 1.0);
    } else if ((bitmap & uint(1)) > uint(0)) {
        bitmap &= ~uint(1);
        return vec2(-1.0, -1.0);
    } else if ((bitmap & uint(4)) > uint(0)) {
        bitmap &= ~uint(4);
        return vec2(-1.0, 1.0);
    } else if ((bitmap & uint(32)) > uint(0)) {
        bitmap &= ~uint(32);
        return vec2(1.0, -1.0);
    } else if ((bitmap & uint(128)) > uint(0)) {
        bitmap &= ~uint(128);
        return vec2(1.0, 1.0);
    }

    // Should never get here.
    return vec2(1000000.0, 1000000.0);
}

// Get summary of a point's drainage from the drainage texture.
uvec4 getDrainageSummary(vec2 point) {
    return texture2D(drainage, point / 100.);
}

// Returns true if pTest is inside the river.
// For explanation of distance from line segment:
// https://www.youtube.com/watch?v=PMltMdi1Wzg
bool isColinear(vec2 a, vec2 b, vec2 p, float tolerance) {
    float len = distance(b, a);
    float h = min(1., max(0., dot(p - a, b - a) / (len * len)));
    return length(p - a - h * (b - a)) < tolerance;
}

bool drawRiver(vec2 point_) {
    // Loop once for each corner of a tile.
    for(int corner = 0; corner < 4; corner++) {
        vec2 point = point_ / scale;
        vec2 ipoint = floor(point);
        if(corner == 0) {
        } else if(corner == 1) {
            ipoint.x += 2.;
            point.x += 1.;
        } else if(corner == 2) {
            ipoint.y += 2.;
            point.y += 1.;
        } else if(corner == 3) {
            ipoint.x += 2.;
            ipoint.y += 2.;
            point.x += 1.;
            point.y += 1.;
        }

        uvec4 drainageSummary = getDrainageSummary(point);

        uint dampness = drainageSummary[2];
        if (dampness <= uint(riverLikelihood)) {
            continue;
        }

        if (drainageSummary[1] == uint(0)) {
          continue;
        }

        vec2 toLowNeigh = getOffset(drainageSummary[1]);

        vec2 a = ipoint + toLowNeigh * .5;  // Stop at tile boundary.
        vec2 b = ipoint + toLowNeigh * .25;

        float riverWidthRel = sqrt(float(dampness)) * riverWidth / 5000.;

        if (isColinear(a, b, point, riverWidthRel)) {
            return true;
        }

        while (drainageSummary[0] > uint(0)) {
            vec2 toHighNeigh = getOffset(drainageSummary[0]);
            vec2 pHighNeigh = point + toHighNeigh;

            uvec4 drainageSummaryHigh = getDrainageSummary(pHighNeigh);
            dampness = drainageSummaryHigh[2];
            if (dampness <= uint(riverLikelihood)) {
                continue;
            }

            riverWidthRel = sqrt(float(dampness)) * riverWidth / 5000.;

            vec2 c = ipoint + toHighNeigh * .25;
            vec2 d = ipoint + toHighNeigh * .5;  // Stop at tile boundary.
            if (isColinear(b, c, point, riverWidthRel)) {
                return true;
            }
            if (isColinear(c, d, point, riverWidthRel)) {
                return true;
            }
        }
    }
    return false;
}

void setColor(inout vec3 diffuseColor) {
    float x = vPositionW.x;
    float y = vPositionW.y;
    float z = vPositionW.z;

    float noiseVal = get_noise(x, z);
    float clampedNoiseVal = clamp(noiseVal, 0.001, 10.0);
    float shoreHeight = max(shoreline + sealevel + clampedNoiseVal / 4.0, sealevel);
    uvec4 waveSummary = getWaveSummary(vPositionW.xz / scale);

    if (float(waveSummary[0]) * 0.01 > abs((y / scale) - sealevel)) {
        diffuseColor.rgb = wave;
    } else if (y / scale > sealevel && drawRiver(vPositionW.xz)) {
      diffuseColor.rgb = river;
    } else if (y / scale >= snowline - (snowline * clampedNoiseVal / 2.0)) {
      // Snow
      diffuseColor.rgb = snow;
    } else if (y / scale > shoreHeight) {
      // Land
      if (pow(clampedNoiseVal, 5.) * y > rockLikelihood) {
        diffuseColor.rgb = rock;
      } else {
        diffuseColor.rgb = mix(scrub, grass, max(0.0, 1.0 / max(1.0, y) - clampedNoiseVal / 2.0));
      }
    } else {
      // Below shoreline
      float multiplier = clamp(y / scale / (sealevel + shoreline), 0.0, 1.0);

      if (noiseVal > rockLikelihood - 1.) {
        diffuseColor.rgb = rock * multiplier;
      } else {
        diffuseColor.rgb = sand * multiplier;
      }
    }

    //diffuseColor.rgb = vec3(clampedNoiseVal, clampedNoiseVal, clampedNoiseVal);
}

void main(void) {
    #include<clipPlaneFragment>
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);

    vec4 baseColor = vec4(1., 1., 1., 1.);
    vec3 diffuseColor = vDiffuseColor.rgb;
    float alpha = vDiffuseColor.a;
    setColor(diffuseColor);

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
