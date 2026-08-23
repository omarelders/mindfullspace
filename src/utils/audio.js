let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playBeep(frequency = 880, duration = 1.0) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0.38, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}

export function fireNotification(title, body) {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icons/icon-192.png', silent: true })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') new Notification(title, { body, icon: '/icons/icon-192.png', silent: true })
      })
    }
  } catch {}
}

export function playAchievementSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    // High-quality celebratory ascending pentatonic arpeggio (C5 -> E5 -> G5 -> A5 -> C6)
    const notes = [
      { freq: 523.25, delay: 0.0, duration: 0.22 },
      { freq: 659.25, delay: 0.05, duration: 0.22 },
      { freq: 783.99, delay: 0.10, duration: 0.25 },
      { freq: 880.00, delay: 0.15, duration: 0.28 },
      { freq: 1046.50, delay: 0.20, duration: 0.65 },
    ]

    notes.forEach(({ freq, delay, duration }, index) => {
      const startTime = ctx.currentTime + delay
      const isLast = index === notes.length - 1

      // Fundamental oscillator (smooth bell tone)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, startTime)

      // 1st Overtone: Octave higher triangle wave for crystal chime clarity
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 2, startTime)

      // 2nd Overtone: Perfect fifth harmonic for rich, polyphonic shimmer
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      osc3.type = 'sine'
      osc3.frequency.setValueAtTime(freq * 1.5, startTime)

      osc1.connect(gain1)
      osc2.connect(gain2)
      osc3.connect(gain3)
      gain1.connect(ctx.destination)
      gain2.connect(ctx.destination)
      gain3.connect(ctx.destination)

      // Peak volume is slightly higher on the final triumphant note
      const peak1 = isLast ? 0.28 : 0.22
      const peak2 = isLast ? 0.10 : 0.07
      const peak3 = isLast ? 0.05 : 0.03

      // Smooth attack and exponential decay
      gain1.gain.setValueAtTime(0.0001, startTime)
      gain1.gain.linearRampToValueAtTime(peak1, startTime + 0.015)
      gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

      gain2.gain.setValueAtTime(0.0001, startTime)
      gain2.gain.linearRampToValueAtTime(peak2, startTime + 0.012)
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.8)

      gain3.gain.setValueAtTime(0.0001, startTime)
      gain3.gain.linearRampToValueAtTime(peak3, startTime + 0.012)
      gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7)

      osc1.start(startTime)
      osc1.stop(startTime + duration + 0.05)
      osc2.start(startTime)
      osc2.stop(startTime + duration + 0.05)
      osc3.start(startTime)
      osc3.stop(startTime + duration + 0.05)
    })
  } catch {}
}

export function playTaskCompleteSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    // Iconic Apple Pay style "Ta-Ding" two-tone octave chime (E5 -> E6)
    // 75ms separation creates that tactile, snappy double-tap rhythm
    const notes = [
      { freq: 659.25, delay: 0.00, duration: 0.11, isStrikeOnly: false }, // E5
      { freq: 1318.51, delay: 0.075, duration: 0.65, isStrikeOnly: true }, // E6 (Octave jump)
    ]

    notes.forEach(({ freq, delay, duration, isStrikeOnly }, index) => {
      const startTime = ctx.currentTime + delay
      const isLast = index === notes.length - 1

      // 1. Mallet Strike Oscillator (Percussive attack like a marimba/glass tap)
      const oscMallet = ctx.createOscillator()
      const gainMallet = ctx.createGain()
      oscMallet.type = 'sine'
      // Rapid downward pitch bend creates the physical "mallet impact" click
      oscMallet.frequency.setValueAtTime(freq * 1.35, startTime)
      oscMallet.frequency.exponentialRampToValueAtTime(freq, startTime + 0.015)
      
      oscMallet.connect(gainMallet)
      gainMallet.connect(ctx.destination)

      const malletPeak = isLast ? 0.22 : 0.16
      gainMallet.gain.setValueAtTime(0.0001, startTime)
      gainMallet.gain.linearRampToValueAtTime(malletPeak, startTime + 0.005)
      gainMallet.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045)
      oscMallet.start(startTime)
      oscMallet.stop(startTime + 0.06)

      // 2. Fundamental Resonance (Pure glass bell tone)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, startTime)

      // 3. 1st Overtone (Octave harmonic for crystal clarity)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 2, startTime)

      // 4. 2nd Overtone (3rd harmonic for high-end Retina shimmer)
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      osc3.type = 'sine'
      osc3.frequency.setValueAtTime(freq * 3, startTime)

      osc1.connect(gain1)
      osc2.connect(gain2)
      osc3.connect(gain3)
      gain1.connect(ctx.destination)
      gain2.connect(ctx.destination)
      gain3.connect(ctx.destination)

      const peak1 = isLast ? 0.35 : 0.22
      const peak2 = isLast ? 0.10 : 0.06
      const peak3 = isLast ? 0.04 : 0.02

      gain1.gain.setValueAtTime(0.0001, startTime)
      gain1.gain.linearRampToValueAtTime(peak1, startTime + 0.01)
      gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

      gain2.gain.setValueAtTime(0.0001, startTime)
      gain2.gain.linearRampToValueAtTime(peak2, startTime + 0.008)
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.75)

      gain3.gain.setValueAtTime(0.0001, startTime)
      gain3.gain.linearRampToValueAtTime(peak3, startTime + 0.008)
      gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6)

      osc1.start(startTime)
      osc1.stop(startTime + duration + 0.05)
      osc2.start(startTime)
      osc2.stop(startTime + duration + 0.05)
      osc3.start(startTime)
      osc3.stop(startTime + duration + 0.05)
    })
  } catch {}
}

