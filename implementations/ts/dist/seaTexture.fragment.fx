// Fragment shader
precision highp float;

//Uniforms
uniform float offset;
uniform float alpha;
uniform float time;

//Varyings
varying vec3 vPosition;

//Entry point
void main(void) {
  float x = vPosition.x + offset + time;
  float z = vPosition.z + offset + time;

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


  vec4 rgba = vec4(0.1, 0.5 + val / 2.0, 0.9 + val, alpha);

  //FragmentOutput
  gl_FragColor = rgba;
}
