const vsSource = `
attribute vec4 aVertexPosition;
attribute vec4 aVertexColor;
attribute vec2 aTextureCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying lowp vec4 vColor;
varying highp vec2 vTextureCoord;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vColor = aVertexColor;
    vTextureCoord = aTextureCoord;
}
`;

const fsSource = `
precision mediump float;

varying lowp vec4 vColor;
varying highp vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform bool uUseTexture;

void main() {
    if (uUseTexture) {
        vec4 texColor = texture2D(uSampler, vTextureCoord);
        // Modern blend mode - multiply colors with texture
        gl_FragColor = vec4(vColor.rgb * (1.0 - texColor.a) + texColor.rgb, 0.8); // Reduced alpha for transparency
    } else {
        gl_FragColor = vec4(vColor.rgb, 0.8); // Added transparency
    }
}
`;

let canvas;
let gl;
let programInfo;
let buffers;
let textures;
let rotation = 0.0;
let then = 0;

function main() {
    canvas = document.getElementById("glCanvas");
    gl = canvas.getContext("webgl", { alpha: true }) || canvas.getContext("experimental-webgl", { alpha: true });

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }

    // Enable transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
            textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
            uUseTexture: gl.getUniformLocation(shaderProgram, 'uUseTexture'),
        },
    };

    buffers = initBuffers(gl);
    textures = initTextures(gl);

    // Set canvas size to be smaller - not covering the whole screen
    canvas.style.width = '50vw';
    canvas.style.height = '50vh';
    canvas.style.position = 'absolute';
    canvas.style.top = '50%';
    canvas.style.left = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.zIndex = '1'; // Ensure it's above background but below other elements

    requestAnimationFrame(render);
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initBuffers(gl) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
        // Front face
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,
        
        // Back face
        -1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0, -1.0, -1.0,
        
        // Top face
        -1.0,  1.0, -1.0,
        -1.0,  1.0,  1.0,
         1.0,  1.0,  1.0,
         1.0,  1.0, -1.0,
        
        // Bottom face
        -1.0, -1.0, -1.0,
         1.0, -1.0, -1.0,
         1.0, -1.0,  1.0,
        -1.0, -1.0,  1.0,
        
        // Right face
         1.0, -1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,
        
        // Left face
        -1.0, -1.0, -1.0,
        -1.0, -1.0,  1.0,
        -1.0,  1.0,  1.0,
        -1.0,  1.0, -1.0,
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

    // Instead of using fixed face colors, create vertex colors directly
    let colors = [];

    // For each vertex in positions (x,y,z triplets)
    for (let i = 0; i < positions.length; i += 3) {
        // Create normalized color components from position
        // Map from [-1,1] to [0,1] range
        const r = (positions[i] + 1.0) / 2.0;      // x maps to red
        const g = (positions[i+1] + 1.0) / 2.0;    // y maps to green
        const b = (positions[i+2] + 1.0) / 2.0;    // z maps to blue
        
        // Add this color for current vertex (RGBA)
        colors.push(r, g, b, 1.0);
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    const indices = [
        0,  1,  2,      0,  2,  3,    
        4,  5,  6,      4,  6,  7,    
        8,  9,  10,     8,  10, 11,   
        12, 13, 14,     12, 14, 15,   
        16, 17, 18,     16, 18, 19,   
        20, 21, 22,     20, 22, 23,   
    ];

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Texture coordinate buffer
    const textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

    const textureCoordinates = [
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        
        // Back face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        
        // Top face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        
        // Bottom face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        
        // Right face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        
        // Left face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        color: colorBuffer,
        indices: indexBuffer,
        textureCoord: textureCoordBuffer,
        vertexCount: 36,
    };
}

function createTextTexture(gl, text, fontSize = 32, background = 'transparent', textColor = 'white', font = 'bold sans-serif') {
    // Create a canvas element to draw text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Size the canvas for text
    canvas.width = 256;
    canvas.height = 256;
    
    // Clear with background color
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Style the text
    ctx.font = `${fontSize}px ${font}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text centered
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    
    return texture;
}

function initTextures(gl) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 256;
    bgCanvas.height = 256;
    const bgCtx = bgCanvas.getContext('2d');
    
    const gradient = bgCtx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#222');
    gradient.addColorStop(1, '#444');
    bgCtx.fillStyle = gradient;
    bgCtx.fillRect(0, 0, 256, 256);

   const textures = {
    front: createTextTexture(gl, "", 200, 'rgba(0,0,0,0.4)', '#ffffff', 'bold 200px Arial'),
    back: createTextTexture(gl, "", 200, 'rgba(0,0,0,0.4)', '#ffffff', 'bold 200px Arial'),
    top: createTextTexture(gl, "", 200, 'rgba(0,0,0,0.4)', '#ffffff', 'bold 200px Arial'),
    bottom: createTextTexture(gl, "", 200, 'rgba(0,0,0,0.4)', '#ffffff', 'bold 200px Arial'),
    right: createTextTexture(gl, "", 200, 'rgba(0,0,0,0.4)', '#ffffff', 'bold 200px Arial'),
    left: createTextTexture(gl, "", 240, 'rgba(0,0,0,0.4)', '#ffffff', 'bold 240px Arial')
};
    
    return textures;
}

function render(now) {
    now *= 0.001;  
    const deltaTime = now - then;
    then = now;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    rotation += deltaTime;

    // Updated to make the background transparent
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Set alpha to 0 for full transparency
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = 45 * Math.PI / 180;   
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    const modelViewMatrix = mat4.create();

    mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -6.0]);
    mat4.scale(modelViewMatrix, modelViewMatrix, [0.5, 0.5, 0.5]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, rotation, [0.5, 1, 0.5]);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        3,        
        gl.FLOAT, 
        false,    
        0,        
        0        
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexColor,
        4,        
        gl.FLOAT, 
        false,    
        0,     
        0         
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoord,
        2,        
        gl.FLOAT, 
        false,    
        0,     
        0         
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.useProgram(programInfo.program);

    // Pass matrices
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix
    );
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix
    );

    drawFace(gl, programInfo, buffers, textures.front, 0, 6);
    drawFace(gl, programInfo, buffers, textures.back, 6, 6);
    drawFace(gl, programInfo, buffers, textures.top, 12, 6);
    drawFace(gl, programInfo, buffers, textures.bottom, 18, 6);
    drawFace(gl, programInfo, buffers, textures.right, 24, 6);
    drawFace(gl, programInfo, buffers, textures.left, 30, 6);

    requestAnimationFrame(render);
}

function drawFace(gl, programInfo, buffers, texture, startIndex, count) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);
    gl.uniform1i(programInfo.uniformLocations.uUseTexture, 1);

    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, startIndex * 2);
}

const mat4 = {
create: function() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
},

perspective: function(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    
    return out;
},

translate: function(out, a, v) {
    const x = v[0], y = v[1], z = v[2];
    
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    
    return out;
},

rotate: function(out, a, rad, axis) {
    let x = axis[0], y = axis[1], z = axis[2];
    let len = Math.hypot(x, y, z);
    
    if (len < 0.000001) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;
    
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const t = 1 - c;
    
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    
    const b00 = x * x * t + c;
    const b01 = y * x * t + z * s;
    const b02 = z * x * t - y * s;
    const b10 = x * y * t - z * s;
    const b11 = y * y * t + c;
    const b12 = z * y * t + x * s;
    const b20 = x * z * t + y * s;
    const b21 = y * z * t - x * s;
    const b22 = z * z * t + c;
    
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;
    
    if (a !== out) {
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    
    return out;
},

scale: function(out, a, v) {
    const x = v[0], y = v[1], z = v[2];

    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];

    return out;
}
};

window.onload = main;