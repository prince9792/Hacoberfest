"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260729_102822_0e6c87e8-c141-4744-bf32-ad30db296371.mp4";

function drawCover(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.clearRect(0, 0, width, height);
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function waitForMediaEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata") {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for video ${eventName}.`));
    }, 30000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The video could not be loaded for frame caching."));
    };

    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function seekTo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.001) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while seeking the video frame cache."));
    }, 10000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The video frame cache could not seek to a frame."));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}

export function ScrollVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const videoReadyRef = useRef(false);
  const cacheReadyRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !canvas || !context) return;

    let disposed = false;
    let targetProgress = 0;
    let progress = 0;
    let animationFrame = 0;
    let seeking = false;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const updateTarget = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      targetProgress =
        scrollableHeight > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
          : 0;
    };

    const render = () => {
      progress += (targetProgress - progress) * 0.12;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const frames = framesRef.current;

      if (cacheReadyRef.current && frames.length > 0) {
        const frameIndex = Math.min(
          frames.length - 1,
          Math.round(progress * (frames.length - 1))
        );
        const frame = frames[frameIndex];
        drawCover(context, frame, frame.width, frame.height, width, height);
      } else if (
        videoReadyRef.current &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : 0;
        const desiredTime = progress * duration;
        if (!seeking && Math.abs(video.currentTime - desiredTime) > 0.04) {
          seeking = true;
          video.currentTime = desiredTime;
        }
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          drawCover(context, video, video.videoWidth, video.videoHeight, width, height);
        }
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    const onSeeked = () => {
      seeking = false;
    };
    const onLoadedData = () => {
      videoReadyRef.current = true;
      setVideoReady(true);
    };

    resizeCanvas();
    updateTarget();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("scroll", updateTarget, { passive: true });
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadeddata", onLoadedData);
    animationFrame = window.requestAnimationFrame(render);

    const cacheFrames = async () => {
      const offscreenVideo = document.createElement("video");
      offscreenVideo.muted = true;
      offscreenVideo.playsInline = true;
      offscreenVideo.preload = "auto";
      offscreenVideo.src = VIDEO_URL;
      offscreenVideo.load();

      let frames: ImageBitmap[] = [];
      try {
        if (offscreenVideo.readyState < HTMLMediaElement.HAVE_METADATA) {
          await waitForMediaEvent(offscreenVideo, "loadedmetadata");
        }
        if (offscreenVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          await waitForMediaEvent(offscreenVideo, "loadeddata");
        }
        if (disposed || !Number.isFinite(offscreenVideo.duration)) return;

        const frameCount = Math.min(90, Math.max(24, Math.ceil(offscreenVideo.duration * 12)));
        for (let index = 0; index < frameCount; index += 1) {
          if (disposed) return;
          const time = (index / Math.max(1, frameCount - 1)) * Math.max(0, offscreenVideo.duration - 0.05);
          await seekTo(offscreenVideo, time);
          const resizedWidth = Math.min(960, offscreenVideo.videoWidth);
          const resizedHeight = Math.round(
            offscreenVideo.videoHeight * (resizedWidth / offscreenVideo.videoWidth)
          );
          const bitmap = await createImageBitmap(offscreenVideo, {
            resizeWidth: resizedWidth,
            resizeHeight: resizedHeight
          });
          frames.push(bitmap);
        }

        if (!disposed) {
          framesRef.current = frames;
          frames = [];
          cacheReadyRef.current = true;
          setCacheReady(true);
        }
      } catch (error) {
        if (!disposed) {
          console.warn("Scroll video frame cache unavailable; using direct video seeking.", error);
        }
      } finally {
        frames.forEach((frame) => frame.close());
        offscreenVideo.pause();
        offscreenVideo.removeAttribute("src");
        offscreenVideo.load();
      }
    };

    let cacheTimer: number | undefined;
    const beginCaching = () => {
      if (cacheTimer !== undefined) return;
      cacheTimer = window.setTimeout(() => {
        void cacheFrames();
      }, 300);
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      videoReadyRef.current = true;
      setVideoReady(true);
      beginCaching();
    } else {
      video.addEventListener("loadeddata", beginCaching, { once: true });
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      if (cacheTimer !== undefined) window.clearTimeout(cacheTimer);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", updateTarget);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("loadeddata", beginCaching);
      framesRef.current.forEach((frame) => frame.close());
      framesRef.current = [];
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0a0a0a]"
    >
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          videoReady && !cacheReady ? "opacity-100" : "opacity-0"
        }`}
        muted
        playsInline
        preload="auto"
        src={VIDEO_URL}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          cacheReady ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="absolute inset-0 bg-[#0a0a0a]/35" />
    </div>
  );
}
