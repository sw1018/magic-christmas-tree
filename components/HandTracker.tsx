import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandState, useStore } from '../store';

const HandTracker: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const setHandState = useStore((state) => state.setHandState);
  const isDebug = useStore((state) => state.isDebug);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        startWebcam();
      } catch (error) {
        console.error("Error initializing hand landmarker:", error);
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: 640,
            height: 480
          }
        });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
        setLoading(false);
      }
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (video.currentTime > 0 && !video.paused && !video.ended) {
        const results = handLandmarker.detectForVideo(video, performance.now());

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (isDebug && results.landmarks) {
            const drawingUtils = new DrawingUtils(ctx);
            for (const landmarks of results.landmarks) {
              drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 2
              });
              drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
            }
          }
        }

        // Logic to determine Hand State
        if (results.landmarks.length > 0) {
          // Check for Pinch (Thumb tip vs Index tip distance)
          // Index tip: 8, Thumb tip: 4
          let isPinching = false;
          let isFist = false;
          let isOpen = false;

          for (const landmarks of results.landmarks) {
             const thumbTip = landmarks[4];
             const indexTip = landmarks[8];
             const middleTip = landmarks[12];
             const ringTip = landmarks[16];
             const pinkyTip = landmarks[20];
             const wrist = landmarks[0];

             // Distance for pinch
             const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
             
             // Check for Fist (Tips close to wrist or below knuckles)
             // Simple heuristic: If middle, ring, pinky tips are below their PIP joints (joints 10, 14, 18)
             // Y coordinates are inverted in some contexts, but here 0 is top. 
             // If tip.y > pip.y (lower on screen), finger is curled.
             const middlePip = landmarks[10];
             const ringPip = landmarks[14];
             const pinkyPip = landmarks[18];
             
             const fingersCurled = (middleTip.y > middlePip.y) && (ringTip.y > ringPip.y) && (pinkyTip.y > pinkyPip.y);
             
             if (pinchDist < 0.05) {
               isPinching = true;
             } else if (fingersCurled) {
               isFist = true;
             } else {
               isOpen = true;
             }
          }

          if (isPinching) {
            setHandState(HandState.PINCH);
          } else if (isFist) {
            setHandState(HandState.CLOSED);
          } else {
            setHandState(HandState.OPEN);
          }

        } else {
            // No hands detected, default state or maintain last?
            // Let's keep it responsive
           // setHandState(HandState.UNKNOWN);
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupLandmarker();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (handLandmarker) handLandmarker.close();
      cancelAnimationFrame(animationFrameId);
    };
  }, [setHandState, isDebug]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-opacity ${isDebug ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="relative w-48 h-36 rounded-lg overflow-hidden border-2 border-green-500 bg-black">
        {loading && <div className="absolute inset-0 flex items-center justify-center text-white text-xs">Init Vision...</div>}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100" width={640} height={480} />
      </div>
    </div>
  );
};

export default HandTracker;