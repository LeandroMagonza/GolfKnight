import{Yn as e,h as t,ur as n,zn as r}from"./SkeletonUtils-Be-XVruE.js";var i=null;function a(){return i||(i=new n().load(`./fx/bubble.webp`),i.wrapS=i.wrapT=r,i.colorSpace=``),i}var o=`
uniform float time;
uniform float show;
uniform float popping;
varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // tiembla como gelatina
  p += normal * (sin(time * 3.1 + position.y * 6.0) * 0.035 + sin(time * 2.3 + position.x * 5.0) * 0.025);
  // al armarse crece desde adentro; al romperse se abre un poco
  p *= popping > 0.5 ? 1.0 + (1.0 - show) * 0.18 : mix(0.55, 1.0, show);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,s=`
uniform sampler2D map;
uniform float time;
uniform float show;
uniform float popping;
uniform vec3 color;
varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
  float hex = texture2D(map, vUv * vec2(4.0, 2.0) + vec2(0.0, time * 0.04)).a;
  float n1 = texture2D(map, vUv * 2.0 + vec2(time * 0.06, time * 0.025)).r;
  float band = texture2D(map, vec2(vUv.x * 2.0, vUv.y - time * 0.22)).b;
  float a = 0.06 + fres * 0.8 + hex * 0.22 * (0.4 + n1) + (1.0 - band) * 0.1;
  vec3 col = color * (0.9 + fres * 1.6 + hex * 0.6);
  if (popping > 0.5) {
    // se disuelve: se corta donde el ruido pasa de lo que queda, con el borde encendido
    float n2 = texture2D(map, vUv * 1.7).g;
    if (n2 > show) discard;
    float edge = 1.0 - smoothstep(show - 0.12, show, n2);
    col += vec3(1.0, 0.85, 0.45) * (1.0 - edge) * 3.0;
    a = max(a, (1.0 - edge) * 0.9);
  } else {
    a *= show;
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;function c(n=16767338){return new e({uniforms:{map:{value:a()},time:{value:Math.random()*10},show:{value:1},popping:{value:0},color:{value:new t(n)}},vertexShader:o,fragmentShader:s,transparent:!0,depthWrite:!1,blending:2})}export{c as t};