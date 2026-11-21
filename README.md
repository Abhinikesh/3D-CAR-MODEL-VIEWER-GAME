# 3D Car Model and Viewer — Academic Computer Graphics System

A high-performance, academic-grade 3D automotive visualization, interactive configurator, single-player physics driving simulation, and wireless smartphone controller system built with **React 19**, **Three.js (r187)**, **React Three Fiber (v9)**, **Drei (v10)**, **Zustand (v5)**, and a **Python asset pipeline**.

---

## 1. Project Overview

The **3D Car Model and Viewer** bridges real-time WebGL rendering, numerical physics simulation, and local-network WebSocket communications into a single, cohesive automotive software experience.

The application operates in two synchronized modes:
1. **SHOWROOM MODE**: An interactive 3D automotive garage and configurator featuring Cook-Torrance PBR car paint customization (6 finish types, metallic flakes, clearcoat), multi-material wheel and rim styling, physical glass transmission, dynamic lighting systems (headlights, high beams, brake lights, hazards), kinematic closure rigging (doors, bonnet, boot), 360° camera views, and component raycast inspection.
2. **DRIVING MODE**: A real-time vehicle proving ground featuring a closed 1,204-meter handling circuit, 4-wheel independent raycast suspension simulation, longitudinal drivetrain dynamics (acceleration, progressive braking, aerodynamic drag, rolling resistance), front-wheel Ackermann steering kinematics, tire lateral handling dynamics, road boundary collision detection, a dynamic 9-perspective follow-camera system, and an authentic cockpit instrument cluster HUD.

### Wireless Smartphone Controller
Users can pair any modern smartphone browser to the desktop application over the local Wi-Fi network by scanning an on-screen QR code. The phone becomes a responsive wireless driving controller with analog steering, progressive vertical touch pedals, handbrake, and reverse gear engagement, while desktop physics, rendering, and camera systems remain server-authoritative.

---

## 2. Main Features

- **Photorealistic PBR Automotive Rendering**: 97 meshes, 213,347 triangles, multi-layer metallic paint, clearcoat reflections, transmission glass ($T=0.92$, $\text{IOR}=1.52$), and rubber tire materials.
- **Full Vehicle Customization**: Real-time paint palette (12 presets + hex picker), 6 paint finishes (solid, metallic, pearl, matte, satin, gloss), 9 rim finishes (gloss black, chrome, bronze, etc.), and 5 brake caliper accents.
- **Kinematic Closures**: Hierarchical rigging and smooth cubic ease-in-out animations for driver door ($-60^\circ$), passenger door ($+60^\circ$), bonnet ($+42^\circ$), and boot ($+48^\circ$).
- **Dynamic Lighting**: 10 functional automotive lighting states with physical SpotLights and PointLights (low beams, high beams, brake lights, 1.5 Hz ECE R48 hazard flashers).
- **Multiple Showroom Environments**: 4 presentation stages (Studio, Luxury Showroom, Outdoor Daylight, Cinematic Stage) with custom PBR floors and HDR reflection probes.
- **Procedural Handling Circuit**: 1,204.7-meter closed Catmull-Rom road spline, 10.0-meter road width, FIA red-and-white rumble kerbs, concrete gutters, solid boundary lines, dashed centerlines, start grid, and distance markers.
- **Deterministic Vehicle Physics Engine**: Fixed 60 Hz ($\Delta t = 1/60\text{s}$) numerical integration via Semi-Implicit Euler, 4-wheel independent raycast suspension ($k=35,000\text{ N/m}$, $c=3,200\text{ N}\cdot\text{s/m}$, anti-roll bars $8,000\text{ N/m}$), rigid body chassis dynamics ($1,450\text{kg}$), and zero-drift stationary stability.
- **Realistic Longitudinal Drivetrain**: $9,800\text{ N}$ tractive force ($250\text{ km/h}$ top speed), progressive braking ($15,200\text{ N}$), stop-before-reverse logic, reverse driving ($45\text{ km/h}$), aerodynamic drag, and pitch torque.
- **Front-Wheel Ackermann Steering & Tire Lateral Dynamics**: True Ackermann angles ($\delta_{\text{inner}} > \delta_{\text{outer}}$), speed-sensitive steering reduction curves (30° down to 12°), hyperbolic tangent friction saturation ($\mu F_z$), and restoring yaw torque.
- **Physics-Driven Wheel Kinematics**: Synchronized wheel spin ($\Delta\theta = v \cdot dt / R_{\text{tire}}$), differential cornering speeds ($v_{\text{outer}} > v_{\text{inner}}$), and dynamic visual suspension deflection ($\pm 40\text{mm}$).
- **Road Boundary Collision & Recovery**: Inelastic Armco barrier collisions ($e=0.18$, tangential barrier friction $0.45$), surface grip reduction on grass runoff ($\mu=0.65$ vs $1.15$), and instant vehicle recovery/reset (`KeyR`).
- **Dynamic Automotive Camera System**: 9 follow and spectator perspectives [CHASE, CLOSE, WIDE, HOOD, BUMPER, ORBIT 360°, AERIAL, TURN 1, HAIRPIN] with analytical exponential smoothing and speed-dependent framing.
- **Cockpit Instrument Cluster HUD**: Digital SI speedometer ($v_{\text{km/h}} = \|v\| \times 3.6$), authentic PRND transmission selector, live Throttle/Brake/Handbrake meters, steering telemetry, surface badges, and full simulation pause modal.
- **Local-Network Smartphone Controller**: Zero-cloud QR pairing, server-authoritative 256-bit crypto sessions (5-min expiry, 3-attempt brute-force lock), mobile web controller (`/controller`), 60 Hz rate-limited WebSocket transport (`/controller-ws`), and two-tier safety watchdog (750ms stale neutralizer, 2000ms disconnect fallback).
- **Persistent Vehicle Customization**: Seamless bidirectional mode transitions (`Showroom` $\leftrightarrow$ `Driving`) ensuring paint, wheels, and lighting persist with 0 duplicate GLB asset loads.
- **Real-Time Performance Telemetry**: On-screen developer Diagnostics HUD (`KeyD`) monitoring live smoothed FPS, frame time, draw calls, triangles, GPU geometries/textures, and JS heap.

---

## 3. Technology Stack

### Frontend & Graphics
- **React 19** (`react`, `react-dom`): Component architecture and UI state management.
- **Three.js r187** (`three`): WebGL 2.0 rendering engine, scene graph, materials, shaders, and cameras.
- **React Three Fiber v9** (`@react-three/fiber`): Declarative 3D scene management inside React.
- **Drei v10** (`@react-three/drei`): Sky dome, Environment HDR probes, GizmoViewport, ContactShadows, OrbitControls.
- **Zustand v5** (`zustand`): High-performance decoupled stores (`appModeStore`, `vehiclePhysicsStore`, `vehicleInputStore`, `controllerSessionStore`, `paintStore`, `wheelStore`, `cameraStore`, `lightingStore`, `performanceStore`).
- **Lucide React** (`lucide-react`): Modern automotive SVG icon set.
- **QRCode** (`qrcode`): In-browser SVG/Canvas QR code generation for smartphone pairing.

### Tooling, Networking & Asset Pipeline
- **Vite 8** (`vite`, `@vitejs/plugin-react`): Ultra-fast ES module development server and build bundler.
- **ws** (`ws`): Embedded WebSocket server on `/controller-ws` with `noServer: true` path routing.
- **Python 3**: Standalone GLB inspection tools (`inspect_model.py`), automated hierarchy validation (`test_hierarchy.py`), and GLB structure parsing (`pygltflib`, `pytest`).

---

## 4. Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │                 USER BROWSER                 │
                               │                                              │
  ┌───────────────────────┐    │  ┌─────────────────┐    ┌─────────────────┐  │
  │   Mobile Smartphone   │    │  │  Studio Header  │    │  Configurator   │  │
  │   Touch Controller    │    │  │  & Navigation   │    │    Workspace    │  │
  │  (Portrait/Landscape) │    │  └────────┬────────┘    └────────┬────────┘  │
  └───────────┬───────────┘    │           │                      │           │
              │                │           ▼                      ▼           │
              │ Touch Packets  │  ┌────────────────────────────────────────┐  │
              │ (60 Hz WS)     │  │          Global Zustand Stores         │  │
              ▼                │  │  (appModeStore, vehicleInputStore,    │  │
  ┌───────────────────────┐    │  │   vehiclePhysicsStore, sessionStore)   │  │
  │  Vite Server Middleware│   │  └───────────────────┬────────────────────┘  │
  │  - /controller (HTML) │    │                      │                       │
  │  - /controller-ws (WS)│    │                      ▼                       │
  │  - REST Session API   │    │  ┌────────────────────────────────────────┐  │
  └───────────┬───────────┘    │  │     React Three Fiber / Three.js       │  │
              │                │  │  ┌──────────────────────────────────┐  │  │
              │ Dispatch Input │  │  │   ShowroomCanvas (WebGL2 Context)│  │  │
              └───────────────►│  │  │  ┌────────────┐  ┌────────────┐  │  │  │
                               │  │  │  │ShowroomScene│  │DrivingScene│  │  │  │
                               │  │  │  └────────────┘  └────────────┘  │  │  │
                               │  │  └──────────────────────────────────┘  │  │
                               │  └────────────────────────────────────────┘  │
                               └──────────────────────────────────────────────┘
```

The system employs strict separation of concerns:
- **Numerical Physics**: Evaluated at a deterministic 60 Hz fixed timestep inside `VehiclePhysicsWorld.jsx`, writing to scratch memory buffers without triggering React state re-renders.
- **State Synchronization**: Decoupled Zustand stores receive throttled (~10 Hz) telemetry snapshots for DOM UI display (HUD speedometer, pedals, diagnostics).
- **Asset Continuity**: `ConfiguredVehicle.jsx` acts as the single source of truth for 3D meshes and materials, ensuring all customization state transfers seamlessly across mode boundaries.

---

## 5. Prerequisites

Before running the application, ensure the following are installed:
- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **npm**: `v9.0.0` or higher
- **Python**: `3.10+` (optional, for asset pipeline scripts and pytest tests)
- **Modern Web Browser**: Google Chrome (recommended for full WebGL 2.0 and performance diagnostics), Safari, Firefox, or Edge.

---

## 6. Installation

Clone or download the project repository to your computer:

```bash
cd "3D CAR MODEL"
```

Install all Node.js dependencies:

```bash
npm install
```

*(Optional) Set up Python test environment:*

```bash
python3 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate
pip install pytest pygltflib
```

---

## 7. Startup Instructions

Start the application with Vite:

```bash
npm run dev
```

The Vite development server will bind to port `5173` and output its connection endpoints:

```
  VITE v8.3.8  ready in 140 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://10.97.150.40:5173/
```

Open your browser and navigate to:
**`http://localhost:5173/`**

> **Note on Local Network Access**: Vite binds to `0.0.0.0` (all network interfaces), allowing other devices on the same Wi-Fi network to reach the smartphone controller.

---

## 8. Showroom Usage

1. **Viewing the Car**:
   - **Orbit Rotation**: Click and drag with the left mouse button.
   - **Zoom**: Scroll the mouse wheel (clamped between 1.2m and 18.0m).
   - **Pan**: Right-click and drag.
2. **Camera Dock**:
   - Use the floating camera dock at the bottom of the viewport to instantly transition to 8 studio angles (`ISO FRONT`, `SIDE`, `FRONT`, `REAR`, `WHEEL`, etc.) or activate `360° SPIN`.
3. **Customizing the Vehicle**:
   - Use the right-hand **Configurator Workspace** drawer:
     - **Paint Tab**: Select from 12 curated automotive paint presets, pick a custom hex color, or switch between 6 finishes (Metallic, Pearl, Matte, Satin, Gloss, Solid).
     - **Wheels Tab**: Select from 9 rim finishes (Gloss Black, Bronze Satin, Silver Metallic, etc.) and 5 brake caliper colors.
     - **Closures Tab**: Click individual buttons to open/close the Driver Door, Passenger Door, Bonnet, or Boot.
     - **Lighting Tab**: Toggle Headlights (Low/High Beam), Parking Lights, or Hazard Warning Flashers.
     - **Environment Tab**: Switch between Studio, Luxury Showroom, Outdoor Daylight, and Cinematic photoshoot stages.
4. **Entering Driving Mode**:
   - Click the prominent cyan **TEST DRIVE** button in the header bar.

---

## 9. Driving Mode Usage

1. **Vehicle Movement**:
   - Drive the customized car on the 1,200m outdoor handling circuit using keyboard controls.
2. **Dynamic Driving Camera**:
   - Press **Key C** to cycle through 5 follow-camera views: `CHASE` (default), `CLOSE`, `WIDE`, `HOOD`, and `BUMPER`.
   - Number keys `1`–`9` select individual perspectives (`6` for 360° vehicle orbit inspection, `7` for aerial overview, `8` for Turn 1, `9` for Hairpin).
3. **Driving HUD**:
   - Monitor real SI digital speed ($v_{\text{km/h}}$), PRND transmission gear, live Throttle/Brake/Handbrake meters, and steering angle.
4. **Simulation Pause**:
   - Press **Escape** or **Key P** to pause the simulation. A full-screen translucent modal will freeze physics and allow resuming or track restart.
5. **Recovery**:
   - If the vehicle runs off-road or collides with a guardrail, press **Key R** for instant recovery back to the track spawn point with resting suspension.
6. **Return to Showroom**:
   - Click **STUDIO CONFIG** in the header or **EXIT TO SHOWROOM** on the HUD. All customizations made in Showroom persist cleanly.

---

## 10. Smartphone Pairing Instructions

1. **Open Pairing Drawer**:
   - In Driving Mode, click the **CONNECT PHONE** button in the top header or driving HUD.
2. **Scan QR Code**:
   - The computer screen will display a dynamic QR code containing a secure, local-network URL (e.g. `http://10.97.150.40:5173/controller?session=...&token=...`).
   - Open your smartphone camera or QR reader and scan the code.
3. **Drive Wirelessly**:
   - The phone opens the dedicated mobile driving controller page.
   - The computer HUD will update to indicate **CONNECTED: SMARTPHONE CONTROLLER**.
   - Drive using the touch steering pad and vertical pedals on your handset.

---

## 11. Local Wi-Fi Requirements

For smartphone pairing to function:
- **Same Network**: Both the computer running the application and the smartphone must be connected to the **same local Wi-Fi router or hotspot**.
- **No Cloud Required**: Communication is 100% peer-to-peer over the local network via HTTP and WebSocket. No internet access, external cloud servers, or mobile app installations are required.
- **Client Isolation**: Ensure that guest Wi-Fi or router "Client Isolation / AP Isolation" is disabled, as it blocks devices on the same Wi-Fi from connecting to each other.

---

## 12. Controls Reference

### Desktop Keyboard Controls

| Key | Action | Behavior |
| :---: | :--- | :--- |
| **W** / **↑** | Accelerate | Progressive throttle in Drive gear ($D$). Brakes if moving backward ($v < -0.35\text{ m/s}$). |
| **S** / **↓** | Brake / Reverse | Progressive service braking when moving forward. Automatically engages Reverse gear ($R$) at standstill. |
| **A** / **←** | Steer Left | Smooth left steering articulation ($\text{steer} = -1.0$). |
| **D** / **→** | Steer Right | Smooth right steering articulation ($\text{steer} = +1.0$). |
| **Spacebar** | Handbrake | Emergency rear-wheel lock ($100\%$ braking force, cut throttle). |
| **G** | Reverse Mode | Hold to toggle explicit reverse gear intent at standstill. |
| **R** | Reset Vehicle | Instant vehicle recovery to spawn coordinates $[0, 0.002, 0]$ with zeroed velocities. |
| **C** | Cycle Camera | Cycle follow camera view: `CHASE` $\rightarrow$ `CLOSE` $\rightarrow$ `WIDE` $\rightarrow$ `HOOD` $\rightarrow$ `BUMPER`. |
| **1 – 9** | Select Camera View | Direct camera perspective selection (1: Chase, 2: Close, 3: Wide, 4: Hood, 5: Bumper, 6: Orbit, 7: Aerial, 8: Turn 1, 9: Hairpin). |
| **Esc** / **P** | Pause / Resume | Toggle physics simulation pause modal. |
| **D** | Diagnostics HUD | Toggle real-time GPU and frame telemetry HUD. |

### Mobile Touch Controls

| Control | Action | Ergonomics & Behavior |
| :---: | :--- | :--- |
| **Steering Zone** | Horizontal Drag | Analog $[-1.0, +1.0]$ with visual center notch and automatic spring-back return to $0.0$ on finger lift. |
| **Gas Pedal (Right)** | Hold to Accelerate | Progressive vertical touch fill ($0-100\%$). Zeros instantly on touch release or `touchcancel`. |
| **Brake Pedal (Left)**| Hold to Brake / Reverse | Progressive service braking when moving forward; engages reverse throttle at standstill. |
| **EBRAKE Button** | Handbrake Toggle | Activates emergency rear brake lock. |
| **REV Button** | Reverse Toggle | Explicitly toggles transmission between Drive ($D$) and Reverse ($R$). |
| **CAM Button** | Cycle Camera | One-shot action sending camera view cycle command to the computer. |
| **RESET Button** | Vehicle Recovery | One-shot action requesting vehicle spawn reset on the computer. |
| **Disconnect** | Terminate Session | Disconnects phone and immediately restores driving control authority to desktop keyboard. |

---

## 13. Testing Instructions

The project features a comprehensive test suite across unit, integration, physics, network, and Python asset layers:

### Run Full Regression Suite
To run all test suites in sequence:

```bash
# Node.js Test Suites (Parts 21–39)
node python/tests/test_part39_performance_regression.mjs
node python/tests/test_part38_interface_polish_integration.mjs
node python/tests/test_part37_websocket_control.mjs
node python/tests/test_part36_mobile_controller.mjs
node python/tests/test_part35_qr_pairing.mjs
node python/tests/test_part34_smartphone_controller.mjs
node python/tests/test_part33_keyboard_input.mjs
node python/tests/test_part32_driving_hud.mjs
node python/tests/test_part31_driving_camera.mjs
node python/tests/test_part30_collision_recovery.mjs
node python/tests/test_part29_wheel_integration.mjs
node python/tests/test_part28_steering_handling.mjs
node python/tests/test_part27_acceleration_braking.mjs
node python/tests/test_part26_vehicle_physics.mjs
node python/tests/test_part25_vehicle_integration.mjs
node python/tests/test_part23_road_environment.mjs
node python/tests/test_part22_road_geometry.mjs
node python/tests/test_part21_scene_separation.mjs

# Python Asset & Hierarchy Tests
pytest python/tests/test_glb_reader.py python/tests/test_hierarchy.py python/tests/test_validation.py

# Production Build Verification
npm run build
```

### Live Performance Profiling & Demonstration Evidence Capture
To run the automated Chrome DevTools Protocol measurement and evidence capture scripts:

```bash
# Capture live performance audit (FPS, draw calls, triangles, memory, physics step)
node python/tests/measure_part39_performance.mjs

# Capture all 12 Phase 8 demonstration screenshots
node python/tests/capture_part40_final_evidence.mjs
```

---

## 14. Known Limitations & Honest Disclosure

In adherence to strict academic engineering principles, all known limitations are disclosed:

1. **Asset Geometry Topologies**:
   - **Front Turn Signals**: The 3D model geometry lacks separate left/right front turn indicator mesh nodes. Dynamic turn signaling is simulated via directional light sources and rear taillight emissive strips (`BodyTaillights`).
   - **Brake Lights**: The physical taillight is a unified single mesh (`BodyTaillights`). Brake warning illumination uses dual-intensity emissive scaling rather than a distinct geometric high-mount brake lamp.
2. **Simplified Raycast Suspension Model**:
   - Wheel collisions use single-point vertical raycasts from the suspension mount to the ground plane, rather than volumetric 3D tire contact patch meshes. This delivers stable 60 Hz performance and zero drift, but does not simulate tire sidewall flex or dynamic rim deformation.
3. **Local Wi-Fi Network Dependency**:
   - Smartphone pairing requires both devices to reside on the same IP subnet without AP client isolation. It does not provide NAT traversal or cloud TURN/STUN relays (deliberate architectural design for data privacy and zero cloud dependencies).
4. **Physical Device Handset Verification**:
   - Automated unit tests, WebSocket protocol tests, CDP emulated touch interactions, and responsive CSS viewport tests pass with 100% success. Physical device testing depends on the end-user's local handset hardware and Wi-Fi environment.

---

## 15. Asset Attribution & Licensing Reference

### Production Vehicle Model
- **Model Name**: *Car Concept*
- **Source**: [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept)
- **Original Authors**: Darmstadt Graphics Group GmbH & Eric Chadwick (based on Unity Fan CC0 model)
- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- **File**: `public/models/car.glb` ($11,802,676\text{ bytes}$, 97 meshes, 213,347 triangles, 162,766 vertices)

### Environment Lighting Maps
- **HDRI Name**: *Studio Small 08 1K*
- **Source**: [Poly Haven](https://polyhaven.com/a/studio_small_08)
- **Authors**: Sergej Majboroda & Greg Zaal
- **License**: Creative Commons CC0 Public Domain Dedication
- **File**: `public/environments/studio_small_08_1k.hdr` ($1,509,172\text{ bytes}$)
# 3D-CAR-MODEL-VIEWER-GAME
