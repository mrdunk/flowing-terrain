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

// Helper function for repeatable noise value unique to a set of map coordinates.
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

// Return repeatable noise value unique to a set of map coordinates.
float get_noise(float x, float y) {
  return (get_octave_value(noiseCoeficientLow, noiseWeightLow, x, y) +
          get_octave_value(noiseCoeficientMid, noiseWeightMid, x, y) +
          get_octave_value(noiseCoeficientHigh, noiseWeightHigh, x, y)) / 3.0;
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

    return vec2(10000.0, 10000.0);
}

// Get summary of a point's drainage from the drainage texture.
uvec4 getDrainageSummary(float x, float z) {
    vec2 key = vec2(x / 100., z / 100.);
    return texture2D(drainage, key);
}

// Get the distance of testPt from the line joining pt1-pt2.
float distToLine(vec2 pt1, vec2 pt2, vec2 testPt)
{
  vec2 lineDir = pt2 - pt1;
  vec2 perpDir = vec2(lineDir.y, -lineDir.x);
  vec2 dirToPt1 = pt1 - testPt;
  return abs(dot(normalize(perpDir), dirToPt1));
}

// Returns true if testPt is inside the river.
bool isColinear(vec2 p1, vec2 p2, vec2 testPt, float tolerance) {
    float dist = distToLine(p1, p2, testPt);

    float len = distance(p1, p2);
    return (abs(dist) < tolerance && distance((p1 + p2) / 2., testPt) <= len / 2.) ||
            distance(p1, testPt) < tolerance || distance(p2, testPt) < tolerance ;
}

bool drawRiver(float x_, float z_) {
    // Loop once for each corner of a tile.
    for(int corner = 0; corner < 4; corner++) {
        float x = x_ / scale;
        float z = z_ / scale;

        float ix = floor(x);
        float iz = floor(z);
        if(corner == 0) {
        } else if(corner == 1) {
            x += 1.;
            ix = ceil(x);
        } else if(corner == 2) {
            z += 1.;
            iz = ceil(z);
        } else if(corner == 3) {
            x += 1.;
            ix = ceil(x);
            z += 1.;
            iz = ceil(z);
        }

        uvec4 drainageSummary = getDrainageSummary(x, z);

        uint dampness = drainageSummary[2];
        if (dampness <= uint(riverLikelihood)) {
            continue;
        }

        vec2 p0;
        vec2 p1;
        vec2 p2;
        vec2 p3;

        vec2 toNext = getOffset(drainageSummary[1]);
        p0 = vec2(ix, iz) + toNext / 2.;
        p1 = vec2(ix, iz) + toNext / 4.;

        if (isColinear(p0, p1, vec2(x, z), sqrt(float(dampness)) * riverWidth / 5000.)) {
            // Cut corer on the way to the next tile.
            return true;
        }

        while (drainageSummary[0] > uint(0)) {
            vec2 fromPrev = getOffset(drainageSummary[0]);
            p2 = vec2(ix, iz) + fromPrev / 4.;
            p3 = vec2(ix, iz) + fromPrev / 2.;

            uvec4 drainageSummaryFrom = getDrainageSummary(x + fromPrev[0], z + fromPrev[1]);
            dampness = drainageSummaryFrom[2];

            if (drainageSummaryFrom[2] > uint(riverLikelihood)) {
                float dampModified = sqrt(float(dampness)) * riverWidth / 5000.;
                if (isColinear(p1, p2, vec2(x, z), dampModified)) {
                    // Follow ideal drainage path.
                    return true;
                }
        
                if (isColinear(p2, p3, vec2(x, z), dampModified)) {
                    // Cut corner on the way to the next tile.
                    return true;
                }
            }
        }
    }

    return false;
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
    float clampedNoiseVal = clamp(noiseVal, 0.001, 10.0);

    if (drawRiver(x, z) && y / scale > sealevel) {
      diffuseColor.rgb = river;
    } else 
    if (y / scale >= snowline - (snowline * clampedNoiseVal / 2.0)) {
      // Snow
      diffuseColor.rgb = snow;
    } else if (y / scale >= shoreline + noiseVal / 4.0 &&
               y / scale > sealevel) {
      // Land
      if (pow(clampedNoiseVal, 5.) * y > rockLikelihood) {
        diffuseColor.rgb = rock;
      } else {
        diffuseColor.rgb = mix(scrub, grass, max(0.0, 1.0 / max(1.0, y) - clampedNoiseVal / 2.0));
      }
    } else {
      // Below shoreline
      float multiplier = clamp(y / scale / shoreline, 0.0, 1.0);
      if (clampedNoiseVal > rockLikelihood / 10.) {
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
