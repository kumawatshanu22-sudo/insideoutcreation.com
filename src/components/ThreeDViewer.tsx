import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Rotate3d, ZoomIn, Eye, Sparkles, Sliders, Layers, FileText } from 'lucide-react';

interface ThreeDViewerProps {
  theme: string;
  finish: string;
  budget: string;
}

export default function ThreeDViewer({ theme, finish, budget }: ThreeDViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [controlsInfo, setControlsInfo] = useState({ zoom: 100, rotation: 0 });
  const [activeMaterial, setActiveMaterial] = useState<string | null>(null);

  // Keep track of parameters in ref to update materials dynamically
  const parametersRef = useRef({ theme, finish, budget });
  useEffect(() => {
    parametersRef.current = { theme, finish, budget };
  }, [theme, finish, budget]);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#121214'); // Classy dark background
    scene.fog = new THREE.FogExp2('#121214', 0.04);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(5, 4, 8);
    camera.lookAt(0, 0.5, 0);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight('#ffffff', 1.2);
    mainLight.position.set(6, 10, 8);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    // Accent soft light for mood
    const pointLight = new THREE.PointLight('#ffddaa', 1.5, 10);
    pointLight.position.set(-2, 2.5, -2);
    pointLight.castShadow = true;
    scene.add(pointLight);

    // Secondary soft blue/cool fill light from window direction
    const windowLight = new THREE.DirectionalLight('#aaccff', 0.6);
    windowLight.position.set(-8, 5, -5);
    scene.add(windowLight);

    // 5. Creating Room Geometries & Material Mapping
    // Base Groups
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    // Helper to get theme-based colors and properties
    const getThemeConfig = (currentTheme: string, currentFinish: string) => {
      const config = {
        wallColor: '#2d2d30',
        floorColor: '#423122',
        floorRoughness: 0.2,
        floorMetalness: 0.1,
        sofaColor: '#eae8e4',
        accentColor: '#bfa15f', // Gold/Brass
        cushionColor: '#5a5a40',
        tableColor: '#ffffff',
        tableMetalness: 0.0,
        tableRoughness: 0.1,
        tableMaterialType: 'marble',
        accentLightColor: '#ffbb88',
      };

      const t = currentTheme.toLowerCase();
      const f = currentFinish.toLowerCase();

      // Theme mappings
      if (t.includes('minimal')) {
        config.wallColor = '#f5f4ef';
        config.floorColor = '#d9cbbb'; // Light wood birch
        config.sofaColor = '#d5d2c8';
        config.cushionColor = '#9a968a';
        config.accentColor = '#8c8070';
        config.tableColor = '#e3e1da';
        config.accentLightColor = '#ffeedd';
      } else if (t.includes('classic')) {
        config.wallColor = '#1e2d3d'; // Elegant Slate Blue
        config.floorColor = '#2d1c0d'; // Deep Walnut
        config.sofaColor = '#e1d9cc';
        config.cushionColor = '#254e38'; // Dark Emerald
        config.accentColor = '#dfba5a'; // Bright Gold
        config.tableColor = '#ffffff'; // White marble
        config.accentLightColor = '#ffccaa';
      } else if (t.includes('industrial')) {
        config.wallColor = '#4a4b4e'; // Concrete Grey
        config.floorColor = '#3c352f'; // Dark distressed oak
        config.sofaColor = '#2b2a29'; // Charcoal/leather
        config.cushionColor = '#873e23'; // Rust orange
        config.accentColor = '#1f1f20'; // Black steel
        config.tableColor = '#1f1f20'; // Black metal / glass
        config.tableRoughness = 0.05;
        config.tableMetalness = 0.9;
        config.accentLightColor = '#ffaa66';
      } else if (t.includes('bohemian')) {
        config.wallColor = '#eedecd'; // Soft terracotta/cream
        config.floorColor = '#a88665'; // Warm bamboo
        config.sofaColor = '#dfd3c3';
        config.cushionColor = '#c87941'; // Ochre yellow/orange
        config.accentColor = '#c49e7a'; // Jute
        config.tableColor = '#d3c2b0'; // Rattan/warm wood
        config.accentLightColor = '#ffbc88';
      } else if (t.includes('deco')) {
        config.wallColor = '#10221e'; // Deep Forest Green/Emerald
        config.floorColor = '#101010'; // Polished black stone
        config.floorRoughness = 0.05;
        config.floorMetalness = 0.8;
        config.sofaColor = '#faedd8';
        config.cushionColor = '#141414';
        config.accentColor = '#e5b842'; // Shiny luxury gold
        config.tableColor = '#141414'; // Nero Marquina Black Marble
        config.accentLightColor = '#ffd000';
      }

      // Finish overrides
      if (f.includes('glass')) {
        config.tableColor = '#ffffff';
        config.tableMetalness = 0.95;
        config.tableRoughness = 0.01;
        config.tableMaterialType = 'glass';
      } else if (f.includes('stone') || f.includes('concrete')) {
        config.tableColor = '#7a7d80';
        config.tableRoughness = 0.8;
        config.tableMetalness = 0.1;
        config.tableMaterialType = 'stone';
      } else if (f.includes('velvet') || f.includes('gold')) {
        config.sofaColor = t.includes('classic') ? '#1e3d36' : '#571d2b'; // Luxurious emerald or burgundy velvet
        config.accentColor = '#ffd700';
      }

      return config;
    };

    let themeConfig = getThemeConfig(parametersRef.current.theme, parametersRef.current.finish);

    // --- Create Geometric Objects & Nodes inside the Room ---
    const materialsList: THREE.Material[] = [];

    // Floor Mesh
    const floorGeo = new THREE.PlaneGeometry(8, 8, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: themeConfig.floorColor,
      roughness: themeConfig.floorRoughness,
      metalness: themeConfig.floorMetalness,
    });
    materialsList.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    roomGroup.add(floor);

    // Decorative floor grid line details (represents customized layout blueprints)
    const gridHelper = new THREE.GridHelper(8, 16, '#5a5a40', '#323235');
    gridHelper.position.y = 0.005;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    (gridHelper.material as THREE.Material).transparent = true;
    roomGroup.add(gridHelper);

    // Main Back Wall
    const wallBackGeo = new THREE.BoxGeometry(8, 4, 0.2);
    const wallBackMat = new THREE.MeshStandardMaterial({
      color: themeConfig.wallColor,
      roughness: 0.9,
    });
    materialsList.push(wallBackMat);
    const wallBack = new THREE.Mesh(wallBackGeo, wallBackMat);
    wallBack.position.set(0, 2, -4);
    wallBack.receiveShadow = true;
    wallBack.castShadow = true;
    roomGroup.add(wallBack);

    // Wainscoting panel elements on the back wall for sophisticated shadows
    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0, -3.9);
    roomGroup.add(panelGroup);

    const createWainscotPanel = (xPos: number) => {
      const trimGeo = new THREE.BoxGeometry(1.6, 2.8, 0.05);
      const trimMat = new THREE.MeshStandardMaterial({
        color: themeConfig.wallColor,
        roughness: 0.95,
      });
      materialsList.push(trimMat);
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(xPos, 1.8, 0);
      trim.receiveShadow = true;
      trim.castShadow = true;
      panelGroup.add(trim);
    };
    createWainscotPanel(-2.7);
    createWainscotPanel(-0.9);
    createWainscotPanel(0.9);
    createWainscotPanel(2.7);

    // Side Left Wall (With stylish wide accent modern slit window)
    const wallLeftGeo = new THREE.BoxGeometry(0.2, 4, 8);
    const wallLeftMat = new THREE.MeshStandardMaterial({
      color: themeConfig.wallColor,
      roughness: 0.9,
    });
    materialsList.push(wallLeftMat);
    const wallLeft = new THREE.Mesh(wallLeftGeo, wallLeftMat);
    wallLeft.position.set(-4, 2, 0);
    wallLeft.receiveShadow = true;
    wallLeft.castShadow = true;
    roomGroup.add(wallLeft);

    // Window Slit Frame (represents architectural alignment)
    const windowFrameGeo = new THREE.BoxGeometry(0.05, 3.2, 2);
    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: '#121214',
      roughness: 0.4,
      metalness: 0.8,
    });
    materialsList.push(windowFrameMat);
    const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat);
    windowFrame.position.set(-3.9, 2, -1.5);
    roomGroup.add(windowFrame);

    // Window glow visualizer plane
    const glassGeo = new THREE.PlaneGeometry(1.9, 3.1);
    const glassMat = new THREE.MeshBasicMaterial({
      color: '#cceeff',
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    materialsList.push(glassMat);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(-3.87, 2, -1.5);
    roomGroup.add(glass);

    // Cozy custom Luxury Sofa (Consists of base, backrest, armrests, and plush seats)
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(0, 0, -1);
    roomGroup.add(sofaGroup);

    const sofaMat = new THREE.MeshStandardMaterial({
      color: themeConfig.sofaColor,
      roughness: 0.8,
      bumpScale: 0.05,
    });
    materialsList.push(sofaMat);

    // Sofa Base
    const sofaBaseGeo = new THREE.BoxGeometry(4.4, 0.4, 1.8);
    const sofaBase = new THREE.Mesh(sofaBaseGeo, sofaMat);
    sofaBase.position.y = 0.35;
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    sofaGroup.add(sofaBase);

    // Sofa Backrest
    const sofaBackGeo = new THREE.BoxGeometry(4.4, 1.1, 0.4);
    const sofaBack = new THREE.Mesh(sofaBackGeo, sofaMat);
    sofaBack.position.set(0, 1.1, -0.7);
    sofaBack.castShadow = true;
    sofaBack.receiveShadow = true;
    sofaGroup.add(sofaBack);

    // Sofa Armrests
    const armGeo = new THREE.BoxGeometry(0.4, 0.8, 1.8);
    
    const armLeft = new THREE.Mesh(armGeo, sofaMat);
    armLeft.position.set(-2.1, 0.75, 0);
    armLeft.castShadow = true;
    sofaGroup.add(armLeft);

    const armRight = new THREE.Mesh(armGeo, sofaMat);
    armRight.position.set(2.1, 0.75, 0);
    armRight.castShadow = true;
    sofaGroup.add(armRight);

    // Sofa Soft Seat Cushions
    const seatGeo = new THREE.BoxGeometry(1.8, 0.3, 1.4);
    const seatLeft = new THREE.Mesh(seatGeo, sofaMat);
    seatLeft.position.set(-0.95, 0.6, 0.1);
    seatLeft.castShadow = true;
    sofaGroup.add(seatLeft);

    const seatRight = new THREE.Mesh(seatGeo, sofaMat);
    seatRight.position.set(0.95, 0.6, 0.1);
    seatRight.castShadow = true;
    sofaGroup.add(seatRight);

    // Dynamic colorized throw pillows!
    const pillowGeo = new THREE.BoxGeometry(0.7, 0.7, 0.25);
    const pillowMat = new THREE.MeshStandardMaterial({
      color: themeConfig.cushionColor,
      roughness: 0.9,
    });
    materialsList.push(pillowMat);

    const pillowLeft = new THREE.Mesh(pillowGeo, pillowMat);
    pillowLeft.position.set(-1.6, 0.9, -0.35);
    pillowLeft.rotation.set(0.1, 0.3, 0.2);
    pillowLeft.castShadow = true;
    sofaGroup.add(pillowLeft);

    const pillowRight = new THREE.Mesh(pillowGeo, pillowMat);
    pillowRight.position.set(1.6, 0.9, -0.35);
    pillowRight.rotation.set(0.1, -0.3, -0.2);
    pillowRight.castShadow = true;
    sofaGroup.add(pillowRight);

    // Premium Marble / Metal Frame Coffee Table
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0, 0, 1.4);
    roomGroup.add(tableGroup);

    // Table Frame legs
    const frameMat = new THREE.MeshStandardMaterial({
      color: themeConfig.accentColor,
      metalness: 0.9,
      roughness: 0.15,
    });
    materialsList.push(frameMat);

    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.55);
    const createLeg = (x: number, z: number) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(x, 0.275, z);
      leg.castShadow = true;
      tableGroup.add(leg);
    };
    createLeg(-1.1, -0.5);
    createLeg(1.1, -0.5);
    createLeg(-1.1, 0.5);
    createLeg(1.1, 0.5);

    // Horizontal bottom gold frame bars
    const barGeoX = new THREE.BoxGeometry(2.2, 0.03, 0.03);
    const bottomBarX = new THREE.Mesh(barGeoX, frameMat);
    bottomBarX.position.set(0, 0.08, 0);
    tableGroup.add(bottomBarX);

    // Elegant Table Top (Dynamic finish)
    const topGeo = new THREE.BoxGeometry(2.4, 0.05, 1.2);
    let topMatConfig: any = {
      color: themeConfig.tableColor,
      roughness: themeConfig.tableRoughness,
      metalness: themeConfig.tableMetalness,
    };
    if (themeConfig.tableMaterialType === 'glass') {
      topMatConfig.transparent = true;
      topMatConfig.opacity = 0.65;
    }
    const topMat = new THREE.MeshStandardMaterial(topMatConfig);
    materialsList.push(topMat);

    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.y = 0.575;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    // Small interior detail on table: Minimal modern vase + Gold tray
    const trayGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.015, 24);
    const tray = new THREE.Mesh(trayGeo, frameMat);
    tray.position.set(-0.3, 0.61, 0);
    tableGroup.add(tray);

    const vaseGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.28, 16);
    const vaseMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.14,
      metalness: 0.1
    });
    materialsList.push(vaseMat);
    const vase = new THREE.Mesh(vaseGeo, vaseMat);
    vase.position.set(-0.3, 0.61 + 0.14, 0);
    vase.castShadow = true;
    tableGroup.add(vase);

    // Tall Architectural Linear Floor Lamp
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-3, 0, -3.2);
    roomGroup.add(lampGroup);

    const lampBaseGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24);
    const lampBase = new THREE.Mesh(lampBaseGeo, frameMat);
    lampBase.position.y = 0.02;
    lampBase.castShadow = true;
    lampGroup.add(lampBase);

    const lampPostGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.6);
    const lampPost = new THREE.Mesh(lampPostGeo, frameMat);
    lampPost.position.y = 1.32;
    lampPost.castShadow = true;
    lampGroup.add(lampPost);

    const lampShadeGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.38, 24);
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: '#222224',
      roughness: 0.3,
      metalness: 0.3
    });
    materialsList.push(lampShadeMat);
    const lampShade = new THREE.Mesh(lampShadeGeo, lampShadeMat);
    lampShade.position.set(0.15, 2.5, 0.1);
    lampShade.rotation.z = -0.15;
    lampShade.castShadow = true;
    lampGroup.add(lampShade);

    // Stylized Indoor Luxury Planter
    const plantGroup = new THREE.Group();
    plantGroup.position.set(3, 0, -3);
    roomGroup.add(plantGroup);

    // Pot of the plant (Metallic/Concrete finish based on settings)
    const potGeo = new THREE.CylinderGeometry(0.35, 0.26, 0.76, 24);
    const potMat = new THREE.MeshStandardMaterial({
      color: themeConfig.accentColor,
      roughness: 0.15,
      metalness: 0.8
    });
    materialsList.push(potMat);
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.38;
    pot.castShadow = true;
    plantGroup.add(pot);

    // Leaf shapes to look organic
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#1e4620',
      roughness: 0.6,
    });
    materialsList.push(leafMat);

    const createLeaf = (heightVal: number, scaleX: number, scaleY: number, rotateY: number, tilt: number) => {
      const leafGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(scaleX, scaleY, 0.05);
      leaf.position.set(0, heightVal + 0.38, 0);
      leaf.rotation.y = rotateY;
      leaf.rotation.x = tilt;
      leaf.castShadow = true;
      plantGroup.add(leaf);
    };
    createLeaf(0.5, 0.6, 2.0, 0, 0.4);
    createLeaf(0.6, 0.5, 1.8, Math.PI / 3, 0.5);
    createLeaf(0.6, 0.5, 1.8, -Math.PI / 3, 0.5);
    createLeaf(0.7, 0.4, 1.6, Math.PI / 1.5, 0.6);
    createLeaf(0.7, 0.4, 1.6, -Math.PI / 1.5, 0.6);

    // Dynamic update mechanism when props change (avoids full scene reboot)
    const intervalId = setInterval(() => {
      const currentTheme = parametersRef.current.theme;
      const currentFinish = parametersRef.current.finish;
      const currentConfig = getThemeConfig(currentTheme, currentFinish);

      // Smoothly update material colors
      floorMat.color.set(currentConfig.floorColor);
      floorMat.roughness = currentConfig.floorRoughness;
      floorMat.metalness = currentConfig.floorMetalness;

      wallBackMat.color.set(currentConfig.wallColor);
      wallLeftMat.color.set(currentConfig.wallColor);
      panelGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshStandardMaterial).color.set(currentConfig.wallColor);
        }
      });

      sofaMat.color.set(currentConfig.sofaColor);
      pillowMat.color.set(currentConfig.cushionColor);
      
      frameMat.color.set(currentConfig.accentColor);
      potMat.color.set(currentConfig.accentColor);

      topMat.color.set(currentConfig.tableColor);
      topMat.roughness = currentConfig.tableRoughness;
      topMat.metalness = currentConfig.tableMetalness;
      if (currentConfig.tableMaterialType === 'glass') {
        topMat.transparent = true;
        topMat.opacity = 0.65;
      } else {
        topMat.transparent = false;
        topMat.opacity = 1.0;
      }

      pointLight.color.set(currentConfig.accentLightColor);
    }, 1500);

    // 6. Interactive Orbit & Inertia Controls (Implementation without external model-viewer logic)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationAngleX = 0;
    let rotationAngleY = 0;
    let currentZoomRadius = 11;

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      rotationAngleX -= deltaX * 0.007;
      rotationAngleY = Math.max(-0.4, Math.min(1.1, rotationAngleY + deltaY * 0.007)); // Lock vertical orbit polar angle

      previousMousePosition = { x: e.clientX, y: e.clientY };

      // Update camera position based on orbit angles
      updateOrbitCamera();
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      currentZoomRadius = Math.max(5, Math.min(18, currentZoomRadius + e.deltaY * 0.005));
      updateOrbitCamera();
    };

    const updateOrbitCamera = () => {
      camera.position.x = currentZoomRadius * Math.sin(rotationAngleX) * Math.cos(rotationAngleY);
      camera.position.z = currentZoomRadius * Math.cos(rotationAngleX) * Math.cos(rotationAngleY);
      camera.position.y = currentZoomRadius * Math.sin(rotationAngleY) + 2.0;
      camera.lookAt(0, 1.0, 0);

      // Calculate info stats for rendering in overlay UI
      setControlsInfo({
        zoom: Math.round(((18 - currentZoomRadius) / 13) * 100),
        rotation: Math.round(((rotationAngleX % (Math.PI * 2)) / (Math.PI * 2)) * 360)
      });
    };

    // Initialize camera positioning
    rotationAngleX = 0.6;
    rotationAngleY = 0.35;
    updateOrbitCamera();

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // 7. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const elapsedTime = clock.getElapsedTime();
      
      // Auto-gentle subtle rotate camera if user not dragging (for alive cinematic feel)
      if (!isDragging) {
        rotationAngleX += 0.001; 
        updateOrbitCamera();
      }

      // Slightly animate the tree leaves wind sway
      plantGroup.children.forEach((child, idx) => {
        if (idx > 0 && child instanceof THREE.Mesh) {
          child.rotation.x += Math.sin(elapsedTime * 1.5 + idx) * 0.0005;
          child.rotation.y += Math.cos(elapsedTime * 1.2 + idx) * 0.0005;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // 8. Handle Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    // 9. Clean up resources
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);

      materialsList.forEach((mat) => mat.dispose());
      sofaBaseGeo.dispose();
      sofaBackGeo.dispose();
      armGeo.dispose();
      seatGeo.dispose();
      pillowGeo.dispose();
      legGeo.dispose();
      barGeoX.dispose();
      topGeo.dispose();
      trayGeo.dispose();
      vaseGeo.dispose();
      lampBaseGeo.dispose();
      lampPostGeo.dispose();
      lampShadeGeo.dispose();
      potGeo.dispose();
      floorGeo.dispose();
      wallBackGeo.dispose();
      wallLeftGeo.dispose();
      windowFrameGeo.dispose();
      glassGeo.dispose();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-850/60 group">
      {/* 3D WebGL Canvas Injection */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating 3D Interaction Helpers */}
      <div className="absolute top-6 left-6 flex flex-col gap-2 z-10 pointer-events-none">
        <div className="bg-zinc-900/80 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2.5 shadow-md">
          <Rotate3d size={14} className="text-[#5A5A40] animate-pulse" />
          <p className="text-white font-mono text-[9px] uppercase tracking-widest font-semibold">Interactive 3D Sandbox</p>
        </div>
        <div className="bg-zinc-950/70 backdrop-blur-sm border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-2 text-zinc-400 font-mono text-[9px]">
          <span>Theme: <strong className="text-white">{theme}</strong></span>
          <span className="text-zinc-600">|</span>
          <span>Finish: <strong className="text-white">{finish}</strong></span>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
        <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] text-zinc-300 shadow-lg pointer-events-none">
          <Eye size={12} className="text-[#5A5A40]" />
          <span>DRAG TO ORBIT</span>
        </div>
        <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] text-zinc-300 shadow-lg pointer-events-none">
          <ZoomIn size={12} className="text-[#5A5A40]" />
          <span>SCROLL TO ZOOM</span>
        </div>
      </div>

      {/* Bottom telemetry overlay representing luxury specs */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex gap-4">
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/5 px-4.5 py-2.5 rounded-2xl shadow-xl flex flex-col justify-center">
            <span className="text-[7.5px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5">CAMERA ROTATION</span>
            <span className="text-white font-mono text-xs font-semibold">{controlsInfo.rotation}°</span>
          </div>
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/5 px-4.5 py-2.5 rounded-2xl shadow-xl flex flex-col justify-center">
            <span className="text-[7.5px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5">FOV MAGNIFICATION</span>
            <span className="text-white font-mono text-xs font-semibold">{controlsInfo.zoom}%</span>
          </div>
        </div>

        <div className="bg-[#5A5A40]/90 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-white/10">
          <Sparkles size={11} className="text-white animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-white text-[9px] uppercase tracking-widest font-bold">Real-time WebGL Engine</span>
        </div>
      </div>
    </div>
  );
}
