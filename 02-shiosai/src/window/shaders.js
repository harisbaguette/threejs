export const planeVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
export const screenVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;

export const landscapeFragment = `
  uniform sampler2D uDusk;
  uniform sampler2D uNight;
  uniform float uMood;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    // Masks follow the coastline and platform in the authored photographic plate.
    float sea = smoothstep(.602, .618, uv.x)
      * smoothstep(.424 - (uv.x - .6) * .34, .439 - (uv.x - .6) * .34, uv.y)
      * (1. - smoothstep(.467, .48, uv.y));
    float wave = sin(uv.y * 540. + uTime * 1.7 + sin(uv.x * 80.))
      + .45 * sin(uv.y * 940. - uTime * 1.2 + uv.x * 55.);
    uv.x += sea * wave * .00075;
    uv.y += sea * sin(uv.x * 370. + uTime * 1.5) * .0002;
    float wet = (1. - smoothstep(.30, .43, uv.y)) * (1. - smoothstep(.50, .58, uv.x));
    uv.x += wet * sin(uv.y * 700. + uTime * .8) * .00016;
    vec3 dusk = texture2D(uDusk, uv).rgb;
    vec3 night = texture2D(uNight, uv).rgb;
    vec3 col = mix(dusk, night, uMood);
    col += sea * wave * .0015;
    gl_FragColor = vec4(col, 1.);
    #include <colorspace_fragment>
  }
`;

export const glassFragment = `
  uniform sampler2D uScene;
  uniform sampler2D uWipe;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uRain;
  uniform float uEntered;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 bead(vec2 uv, float scale, float speed) {
    vec2 grid = vec2(scale, scale * .23);
    vec2 p = uv * grid;
    float column = floor(p.x);
    p.y += uTime * speed + hash(vec2(column, 9.)) * 32.;
    vec2 id = floor(p), cell = fract(p) - .5;
    float n = hash(id);
    float x = (n - .5) * .64 + sin(p.y * 2. + n * 40.) * .026;
    vec2 delta = cell - vec2(x, .12);
    vec2 q = delta * vec2(1., 4.3);
    float radius = .083 + n * .062;
    float d = length(q);
    float mask = (1. - smoothstep(radius * .58, radius, d)) * step(.36, n);
    float trail = (1. - smoothstep(.007, .017, abs(delta.x)))
      * smoothstep(.08, .15, delta.y) * (1. - smoothstep(.17, .49, delta.y)) * step(.36, n);
    vec2 normal = q / max(radius, .01) * mask;
    return vec3(normal * .012, mask + trail * .12);
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = uv * vec2(aspect, 1.);
    vec3 drop = bead(p, 25., .18) + bead(p + vec2(7.3, 2.7), 39., .09) * .65;
    vec2 id = floor(p * 135.);
    vec2 cell = fract(p * 135.) - .5;
    float n = hash(id);
    vec2 center = vec2(n - .5, hash(id + 3.) - .5) * .65;
    vec2 delta = cell - center;
    float micro = (1. - smoothstep(.032, .11, length(delta))) * step(.81, n);
    vec2 normal = (drop.xy + delta * micro * .018) * uRain;
    normal.x /= aspect;
    float wiped = texture2D(uWipe, uv).r;
    float edge = pow(abs(uv.x - .5) * 2., 4.) * .40
      + pow(abs(uv.y - .5) * 2., 5.) * .32;
    float fog = clamp((.055 + edge) * (1. - wiped) * uRain, 0., .46);
    vec2 texel = 1. / uResolution;
    vec2 refracted = clamp(uv + normal * (1. - wiped * .70), .001, .999);
    vec3 col = texture2D(uScene, refracted).rgb;
    vec3 blurred = texture2D(uScene, refracted + texel * vec2(4., 2.)).rgb;
    blurred += texture2D(uScene, refracted - texel * vec2(4., 2.)).rgb;
    blurred += texture2D(uScene, refracted + texel * vec2(-2., 4.)).rgb;
    blurred += texture2D(uScene, refracted + texel * vec2(2., -4.)).rgb;
    col = mix(col, blurred * .25, fog * 1.7);
    col = mix(col, vec3(.24, .29, .31), fog * .22);
    float beadLight = (drop.z * .006 + micro * .004) * uRain * (1. - wiped * .7);
    col += beadLight * vec3(.75, .84, .88);
    // A restrained reflection from the carriage's warm ceiling light.
    float reflection = exp(-pow((uv.y - .905 - uv.x * .013) * 185., 2.))
      * smoothstep(.18, .30, uv.x) * (1. - smoothstep(.62, .78, uv.x));
    col += vec3(.12, .085, .048) * reflection * (.3 + .7 * uEntered);
    float grain = hash(uv * uResolution + floor(uTime * 12.)) - .5;
    col += grain * .0025;
    gl_FragColor = vec4(max(col, vec3(0.)), 1.);
    #include <colorspace_fragment>
  }
`;
