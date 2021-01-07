let name = 'seaPixelShader';
let shader = `precision highp float;
precision highp int;

uniform vec4 vEyePosition;
uniform vec4 vDiffuseColor;
uniform float size;
uniform float offset;
uniform float time;

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

void setColor(inout vec3 diffuseColor) {
    float x = vPositionW.x - offset / 2. + time;
    float z = vPositionW.z - offset / 2. + time;

    float jitter = 0.0;
    jitter += 0.2 * sin(1.0 * z) * sin(0.75 * x + 0.65 * z);
    jitter += 2.0 * sin(0.09 * z + 0.015 * z) * sin(0.07 * x + 0.07 * z);
    jitter += 20.0 * sin(0.0015 * z + 0.009 * z) * sin(0.0071 * x + 0.0069 * z);

    x += jitter;
    z += jitter;

    float val = 0.0;

    val += sin(30. * x + 30. * z);
    val += sin(20. * x + 7. * z);

    val *= 1.0 + 0.3 * sin(17.1 * x + 23.4 * z);
    val *= 1.0 + 0.3 * sin(33.4 * x + 16.1 * z);

    val *= 1.0 + 0.3 * sin(7.2 * x + 6.8 * z);
    val *= 1.0 + 0.3 * sin(10.0 * x + 6.3 * z);

    val *= 1.0 + 0.25 * sin(1.0 * z);
    val *= 1.0 + 0.25 * sin(0.7 * x + 0.7 * z);

    val *= 1.0 + 0.5 * sin(0.1 * x);
    val *= 1.0 + 0.5 * sin(0.07 * x + 0.07 * z);

    val /= 50.0;

    diffuseColor = vec3(0.1, 0.5 + val / 2.0, 0.9 + val);
}

bool checkHorizon() {
    float x = vPositionW.x - offset / 2.;
    float z = vPositionW.z - offset / 2.;

    return (x * x + z * z < size * size / 4.);
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
