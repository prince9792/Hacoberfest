// Web Audio API ambient synthesizer for Tool Doctor landing page

class AmbientAudioService {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;

  public async toggle(): Promise<{ isPlaying: boolean; error?: string }> {
    if (this.isPlaying) {
      await this.stop();
      return { isPlaying: false };
    }

    try {
      if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
        return {
          isPlaying: false,
          error: 'This browser does not support ambient audio.',
        };
      }

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();

      if (ctx.state !== 'running') {
        throw new Error('Browser prevented audio playback. Click sound button again.');
      }

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, ctx.currentTime);
      compressor.knee.setValueAtTime(12, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.01, ctx.currentTime);
      compressor.release.setValueAtTime(0.2, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.6);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      const harmonics = [
        { frequency: 110, volume: 0.45 },
        { frequency: 164.81, volume: 0.28 },
        { frequency: 220, volume: 0.2 },
        { frequency: 329.63, volume: 0.12 },
        { frequency: 440, volume: 0.07 },
      ];

      harmonics.forEach(({ frequency, volume }) => {
        const osc = ctx.createOscillator();
        const voice = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        voice.gain.setValueAtTime(volume, ctx.currentTime);
        osc.connect(voice);
        voice.connect(master);
        osc.start();
      });

      this.audioContext = ctx;
      this.isPlaying = true;
      return { isPlaying: true };
    } catch (err) {
      if (this.audioContext && this.audioContext.state !== 'closed') {
        void this.audioContext.close();
      }
      this.audioContext = null;
      this.isPlaying = false;
      return {
        isPlaying: false,
        error: err instanceof Error ? err.message : 'Ambient sound could not be initialized.',
      };
    }
  }

  public async stop(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        // ignore
      }
    }
    this.audioContext = null;
    this.isPlaying = false;
  }

  public getStatus(): boolean {
    return this.isPlaying;
  }
}

export const ambientAudio = new AmbientAudioService();
