let name = 'seaPixelShader';
let shader = `precision highp float;
precision highp int;
precision highp usampler2D;

uniform vec4 vEyePosition;
uniform vec4 vDiffuseColor;
uniform float scale;
uniform float waterSize;
uniform float mapSize;
uniform float time;
uniform float windDir;
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

#define PI 3.1415926538

// Get summary of a point's wave data from the waveHeight texture.
float getWaveHeight(vec2 point) {
    return float(texture2D(waveHeight, (point + vec2(0.5, 0.5)) / (mapSize / scale))[0]);
}

void setColor(inout vec3 diffuseColor) {
    float angle = windDir * PI * 2. / 8.;
    mat2 transform = mat2(
                          cos(angle), sin(angle)
                          ,
                          -sin(angle), cos(angle)
                          );

    vec2 pos = transform * vPositionW.xz;
    float x = pos[0];
    float z = pos[1] - time;

    /*if(abs(fract(x / 10.)) <= 0.01 || abs(fract(z / 10.)) <= 0.01) {
        // Draw grid.
        diffuseColor = vec3(0., 0., 0.);
        return;
    }*/

    float jitter = 0.0;
    jitter += 0.02 * sin(9.0 * z) * sin(10.0 * z);
    jitter += 0.2 * sin(1.0 * z) * sin(0.75 * x + 0.65 * z);
    jitter += 2.0 * sin(0.015 * z) * sin(0.07 * x + 0.07 * z);
    jitter += 20.0 * sin(0.01 * x + 0.009 * z) * sin(0.0071 * x + 0.0069 * z);

    x += jitter;
    z += jitter;

    float val = 0.0;

    val += sin(30. * z);
    val += sin(20. * z + 5. * x) / 4.;
    val += sin(40. * z - 6. * x) / 4.;

    val /= 30.0;

    float waveHeight = getWaveHeight(vPositionW.xz / scale);
    val *= waveHeight / 10.;

    diffuseColor = vec3(0.1, 0.5 + val / 2.0, 0.8 + val);
}

bool checkHorizon() {
    float x = vPositionW.x - mapSize / scale;
    float z = vPositionW.z - mapSize / scale;

    return (x * x + z * z < waterSize * waterSize / 4.);
}

void main(void) {
    #include<clipPlaneFragment>
    if (!checkHorizon()) {
      gl_FragColor = vec4(vDiffuseColor.rgb, 1.0);
    } else {
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
    }
}`;

BABYLON.Effect.ShadersStore[name] = shader;
/** @hidden */
export var seaPixelShader = { name, shader };
