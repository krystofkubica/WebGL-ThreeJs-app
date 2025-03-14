(function() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('bg-canvas').appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0.5, 0.5);
    const mousePrev = new THREE.Vector2(0.5, 0.5);
    const mouseVelocity = new THREE.Vector2(0, 0);

    let mousePressed = false;
    let pulseTime = 0;
    
    // shader for the animated background
    const fragmentShader = `
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 mouse;
        uniform vec2 mouseVelocity;
        uniform float pulse;
        
        #define PI 3.14159265359
        
        float noise(vec3 p) {
            vec3 i = floor(p);
            vec4 a = dot(i, vec3(1., 57., 21.)) + vec4(0., 57., 21., 78.);
            vec3 f = cos((p-i)*PI)*(-.5)+.5;
            a = mix(sin(cos(a)*a), sin(cos(1.+a)*(1.+a)), f.x);
            a.xy = mix(a.xz, a.yw, f.y);
            return mix(a.x, a.y, f.z);
        }
        
        float fbm(vec3 p) {
            float v = 0.0;
            v += noise(p * 1.0) * 0.5;
            v += noise(p * 2.0) * 0.25;
            v += noise(p * 4.0) * 0.125;
            v += noise(p * 8.0) * 0.0625;
            return v;
        }
        
        void main() {
            /* Normalized coordinates */
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            
            /* Distance from mouse */
            vec2 mouseOffset = mouse - uv;
            float dist = length(mouseOffset);
            
            /* Mouse interaction wave */
            float mouseWave = sin(dist * 20.0 - time * 2.0) * 0.05 * exp(-dist * 3.0) * length(mouseVelocity) * 2.0;
            uv += mouseWave * mouseOffset;
            
            /* Click pulse wave */
            float clickWave = sin(dist * 15.0 - pulse * 5.0) * 0.05 * exp(-dist * 2.0 - pulse * 2.0) * pulse;
            uv += clickWave * normalize(mouseOffset + vec2(0.001));
            
            /* Create 3D effect with time */
            vec3 p = vec3(uv * 5.0, time * 0.1);
            
            /* Distort with fbm */
            p.x += fbm(p + vec3(0.0, 0.0, time * 0.1)) * 2.0;
            p.y += fbm(p + vec3(0.0, 0.0, time * 0.15)) * 2.0;
            
            /* Generate colors */
            float n = fbm(p * 0.6);
            
            /* Create multiple layers for depth effect */
            float n2 = fbm(p * 0.3 + vec3(mouse * 0.5, time * 0.05));
            float n3 = fbm(p * 0.9 + vec3(sin(time * 0.2), cos(time * 0.2), 0.0));
            
            /* Color palettes */
            vec3 color1 = vec3(0.0, 0.5, 1.0); /* Blue */
            vec3 color2 = vec3(1.0, 0.1, 0.8); /* Magenta */
            vec3 color3 = vec3(0.0, 1.0, 0.7); /* Cyan */
            
            /* Mix colors based on noise and time */
            vec3 color = mix(color1, color2, n);
            color = mix(color, color3, n2 * n3);
            
            /* Add glow and highlights */
            color += vec3(pow(n3, 4.0)) * 0.5; /* Bright highlights */
            
            /* Add dark areas for contrast */
            color *= 0.8 + 0.5 * n;
            
            /* Mouse hover glow */
            color += vec3(0.2, 0.5, 1.0) * (1.0 - smoothstep(0.0, 0.3, dist)) * 0.5;
            
            /* Click pulse glow */
            color += vec3(1.0, 0.3, 0.7) * pulse * exp(-dist * 3.0) * 2.0;
            
            /* Grid effect for tech feel */
            float gridX = smoothstep(0.95, 0.99, sin(uv.x * 50.0 + time) * 0.5 + 0.5) * 0.5;
            float gridY = smoothstep(0.95, 0.99, sin(uv.y * 50.0 + time * 0.7) * 0.5 + 0.5) * 0.5;
            color += vec3(gridX + gridY) * 0.2;
            
            /* Vignette effect */
            float vignette = 1.0 - smoothstep(0.4, 1.4, length(uv - 0.5) * 1.5);
            color *= vignette;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const vertexShader = `
        void main() {
            gl_Position = vec4(position, 1.0);
        }
    `;

    const uniforms = {
        time: { value: 0.0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        mouse: { value: new THREE.Vector2(0.5, 0.5) },
        mouseVelocity: { value: new THREE.Vector2(0.0, 0.0) },
        pulse: { value: 0.0 }
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 5;
        positions[i+1] = (Math.random() - 0.5) * 5;
        positions[i+2] = Math.random() * 2;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // mouse movement
    document.addEventListener('mousemove', (e) => {
        mousePrev.copy(mouse);
        mouse.x = e.clientX / window.innerWidth;
        mouse.y = 1.0 - e.clientY / window.innerHeight; // Invert Y for correct orientation
        
        mouseVelocity.subVectors(mouse, mousePrev);
    });
    
    document.addEventListener('mousedown', () => {
        mousePressed = true;
        pulseTime = 1.0;
    });
    
    document.addEventListener('mouseup', () => {
        mousePressed = false;
    });
    
    // Handle touch events for mobile
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            mousePressed = true;
            pulseTime = 1.0;
            mouse.x = e.touches[0].clientX / window.innerWidth;
            mouse.y = 1.0 - e.touches[0].clientY / window.innerHeight;
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mousePrev.copy(mouse);
            mouse.x = e.touches[0].clientX / window.innerWidth;
            mouse.y = 1.0 - e.touches[0].clientY / window.innerHeight;
            mouseVelocity.subVectors(mouse, mousePrev);
        }
    });
    
    document.addEventListener('touchend', () => {
        mousePressed = false;
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        // Update time for animations
        uniforms.time.value += 0.01;
        uniforms.mouse.value.copy(mouse);
        uniforms.mouseVelocity.value.copy(mouseVelocity);
        
        // Update pulse effect
        if (pulseTime > 0) {
            pulseTime -= 0.02;
            uniforms.pulse.value = pulseTime;
        } else {
            pulseTime = 0;
        }
        
        // Fade mouse velocity
        mouseVelocity.multiplyScalar(0.95);
        
        // Animate particles
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 2] -= 0.01;
            if (positions[i + 2] < 0) {
                positions[i] = (Math.random() - 0.5) * 5;
                positions[i + 1] = (Math.random() - 0.5) * 5;
                positions[i + 2] = 2;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        
        particles.rotation.z += 0.001;
        
        renderer.render(scene, camera);
    }
    
    animate();
})();