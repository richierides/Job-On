import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Room } from "./model";
import { buildRoomScene, disposeRoomScene } from "./render/scene";
import { Action, s } from "./ui";
export default function RoomRender({ room }: { room: Room }) {
  const host = useRef<HTMLDivElement>(null),
    rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const node = host.current;
    if (
      !node ||
      room.height === null ||
      room.items.some((i) => i.height === null)
    )
      return;
    setReady(false);
    setError("");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "This browser could not start the 3D preview. Try a browser with WebGL enabled. Your plan is still saved.",
      );
      return;
    }
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    node.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      `3D preview of ${room.name}`,
    );
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    const scene = buildRoomScene(room);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 500);
    const target = new THREE.Vector3(0, room.height / 400, 0);
    const radius = Math.hypot(room.width, room.depth, room.height) / 200;
    camera.position.copy(
      new THREE.Vector3(1, 0.95, 1.25)
        .normalize()
        .multiplyScalar((radius / Math.sin((19 * Math.PI) / 180)) * 1.1)
        .add(target),
    );
    camera.lookAt(target);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = radius * 0.7;
    controls.maxDistance = radius * 8;
    controls.update();
    const draw = () => renderer.render(scene, camera);
    const resize = () => {
      const width = node.clientWidth || 320;
      renderer.setSize(width, 340, false);
      camera.aspect = width / 340;
      camera.updateProjectionMatrix();
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    controls.addEventListener("change", draw);
    resize();
    setReady(true);
    const revealFrame = requestAnimationFrame(() =>
      node.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
    const lost = (event: Event) => {
      event.preventDefault();
      setError(
        "The 3D preview was interrupted. Return to Layout, then reopen Reveal to try again.",
      );
      setReady(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(revealFrame);
      observer.disconnect();
      controls.removeEventListener("change", draw);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeRoomScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
    };
  }, [room]);
  const download = () => {
    try {
      const a = document.createElement("a");
      a.href = rendererRef.current!.domElement.toDataURL("image/png");
      a.download = "hometaking-room.png";
      a.click();
    } catch {
      setError(
        "The image could not be saved. You can still view the room here.",
      );
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <div
        ref={host}
        data-testid="room-render"
        style={{
          height: 340,
          width: "100%",
          opacity: ready ? 1 : 0.3,
          transition: "opacity 650ms ease",
          overflow: "hidden",
          background: "#F2F0E9",
        }}
      />
      {!!error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : (
        <Text style={s.muted}>
          {ready
            ? "Drag to look around. Scroll or pinch to zoom."
            : "Rendering your room…"}
        </Text>
      )}
      <Action
        secondary
        icon="download"
        label="Save rendered image"
        disabled={!ready}
        onPress={download}
      />
    </View>
  );
}
