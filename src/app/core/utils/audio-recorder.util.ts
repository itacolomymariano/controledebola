export interface AudioRecordingSession {
  stop: () => Promise<{ blob: Blob; mimeType: string; durationMs: number } | null>;
  cancel: () => void;
}

export async function startAudioRecording(
  maxDurationMs: number,
  onRemainingMs?: (remainingMs: number) => void
): Promise<AudioRecordingSession> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microfone nao disponivel neste dispositivo.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  let stopped = false;
  let timerId: ReturnType<typeof setInterval> | undefined;
  let maxTimeoutId: ReturnType<typeof setTimeout> | undefined;

  const cleanup = (): void => {
    if (timerId) clearInterval(timerId);
    if (maxTimeoutId) clearTimeout(maxTimeoutId);
    stream.getTracks().forEach((track) => track.stop());
  };

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const stopPromise = new Promise<{ blob: Blob; mimeType: string; durationMs: number } | null>(
    (resolve) => {
      recorder.addEventListener('stop', () => {
        cleanup();
        if (!chunks.length) {
          resolve(null);
          return;
        }
        const type = recorder.mimeType || mimeType || 'audio/webm';
        resolve({
          blob: new Blob(chunks, { type }),
          mimeType: type,
          durationMs: Date.now() - startedAt,
        });
      });
    }
  );

  recorder.start(250);

  if (onRemainingMs) {
    onRemainingMs(maxDurationMs);
    timerId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      onRemainingMs(Math.max(0, maxDurationMs - elapsed));
    }, 200);
  }

  maxTimeoutId = setTimeout(() => {
    if (stopped) return;
    stopped = true;
    if (recorder.state === 'recording') {
      recorder.stop();
    } else {
      cleanup();
    }
  }, maxDurationMs);

  return {
    stop: async () => {
      if (stopped) {
        return stopPromise;
      }
      stopped = true;
      if (recorder.state === 'recording') {
        recorder.stop();
      } else {
        cleanup();
      }
      return stopPromise;
    },
    cancel: () => {
      if (stopped) return;
      stopped = true;
      chunks.length = 0;
      if (recorder.state === 'recording') {
        recorder.stop();
      } else {
        cleanup();
      }
    },
  };
}
