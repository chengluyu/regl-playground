// Calling the regl module with no arguments creates a full screen canvas and
// WebGL context, and then uses this context to initialize a new REGL instance
import Regl from 'regl';
import { randomNormal } from 'd3-random';
import { range } from 'lodash';
import './index.css';

const container = document.getElementById('paint');

const regl = Regl({ container });

const numPoints = 100000;

// the size of the points we draw on screen
const pointWidth = 2;

// dimensions of the viewport we are drawing in
const width = 500;
const height = 500;
const duration = 1500; // ms

const rng0 = randomNormal(0, 0.05);
const rng1 = randomNormal(0, 0.15);
// create initial set of points
const points = range(numPoints).map((_, i) => {
  const colorStart = [0, Math.random(), 0]
  const colorEnd = [0, colorStart[1] * 0.5, 0.9]
  return {
    sx: (rng0() + Math.cos(i)) * (width / 2.5) + width / 2,
    sy: (rng0() + Math.sin(i)) * (height / 2.5) + height / 2,
    tx: (rng1() * width) + (width / 2),
    ty: (rng1() * height) + (height / 2),
    colorStart,
    colorEnd
  }
})

function createAnimator(attributes) {
  return regl({
    frag: `
      // set the precision of floating point numbers
      precision highp float;

      // this value is populated by the vertex shader
      varying vec3 fragColor;

      void main() {
        // gl_FragColor is a special variable that holds the color
        // of a pixel
        gl_FragColor = vec4(fragColor, 1);
      }`,

    vert: `
      // per vertex attributes
      attribute vec2 positionStart;
      attribute vec2 positionEnd;
      attribute vec3 colorStart;
      attribute vec3 colorEnd;

      // variables to send to the fragment shader
      varying vec3 fragColor;

      // values that are the same for all vertices
      uniform float pointWidth;
      uniform float stageWidth;
      uniform float stageHeight;
      uniform float duration;
      uniform float elapsed;

      // helper function to transform from pixel space to normalized
      // device coordinates (NDC). In NDC (0,0) is the middle,
      // (-1, 1) is the top left and (1, -1) is the bottom right.
      vec2 normalizeCoords(vec2 position) {
        // read in the positions into x and y vars
        float x = position[0];
        float y = position[1];

        return vec2(
          2.0 * ((x / stageWidth) - 0.5),
          // invert y to treat [0,0] as bottom left in pixel space
          -(2.0 * ((y / stageHeight) - 0.5)));
      }

      // helper function to handle cubic easing (copied from d3)
      // note there are premade ease functions available via glslify.
      float easeCubicInOut(float t) {
        t *= 2.0;
        t = (t <= 1.0 ? t * t * t : (t -= 2.0) * t * t + 2.0) / 2.0;

        if (t > 1.0) {
          t = 1.0;
        }

        return t;
      }

      void main() {
        float t;

        // drawing without animation, so show end state immediately
        if (duration == 0.0) {
          t = 1.0;
        // otherwise we are animating, so use cubic easing
        } else {
          t = easeCubicInOut(elapsed / duration);
        }

        vec2 position = mix(positionStart, positionEnd, t);
        vec3 color = mix(colorStart, colorEnd, t);

        // update the size of a point based on the prop pointWidth
        gl_PointSize = pointWidth;

        // send color to the fragment shader
        fragColor = color;

        // scale to normalized device coordinates
        // gl_Position is a special variable that holds the position
        // of a vertex
        gl_Position = vec4(normalizeCoords(position), 0.0, 1.0);
      }`,

    attributes,

    uniforms: {
      // by using `regl.prop` to pass these in, we can specify
      // them as arguments to our drawPoints function
      pointWidth: regl.prop('pointWidth'),

      // regl actually provides these as viewportWidth and
      // viewportHeight but I am using these outside and I want
      // to ensure they are the same numbers, so I am explicitly
      // passing them in.
      stageWidth: regl.prop('stageWidth'),
      stageHeight: regl.prop('stageHeight'),

      duration: regl.prop('duration'),
      elapsed: ({ time }, { startTime = 0}) => 1000 * (time - startTime)
    },

    // specify the number of points to draw
    count: points.length,

    // specify that each vertex is a point (not part of a mesh)
    primitive: 'points',
  })
}

const attributes = {
  // each of these gets mapped to a single entry for each of
  // the points. this means the vertex shader will receive
  // just the relevant value for a given point.
  positionStart: points.map(d => [d.sx, d.sy]),
  positionEnd: points.map(d => [d.tx, d.ty]),
  colorStart: points.map(d => d.colorStart),
  colorEnd: points.map(d => d.colorEnd)
}

function animate() {
  const animatePoints = createAnimator(attributes)

  let startTime = null

  const loop = regl.frame(({ time }) => {
    if (startTime === null) {
      startTime = time
    }

    regl.clear({
      color: [0, 0, 0, 0],
      depth: 1
    })

    animatePoints({
      pointWidth,
      stageWidth: width,
      stageHeight: height,
      duration,
      startTime,
    })

    if (time - startTime > duration / 1000) {
      console.log("hi")
      loop.cancel()
      let t = attributes.positionStart
      attributes.positionStart = attributes.positionEnd
      attributes.positionEnd = t
      t = attributes.colorStart
      attributes.colorStart = attributes.colorEnd
      attributes.colorEnd = t
      animate()
    }
  })
}

animate()
