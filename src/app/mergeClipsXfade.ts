import fs from 'fs-extra'
import ffmpeg from 'fluent-ffmpeg'
import { TRANSITION_DURATION } from '../constants'

export async function mergeClipsXfade ({ clipsPaths, finalOutput, durations }: {clipsPaths: string[], finalOutput: string, durations: number[]}) {
  if (clipsPaths.length === 0) return
  if (clipsPaths.length === 1) {
    await fs.copy(clipsPaths[0], finalOutput)
    return
  }

  const command = ffmpeg()
  clipsPaths.forEach(p => command.input(p))

  const filterComplex = []
  let prevVideo = '0:v'
  let currentOffset = 0

  for (let i = 1; i < clipsPaths.length; i++) {
    const prevDuration = durations[i - 1]
    currentOffset += (prevDuration - TRANSITION_DURATION)

    const nextVideo = `${i}:v`
    const outputLabel = `v${i}`

    filterComplex.push({
      filter: 'xfade',
      options: { transition: 'fade', duration: TRANSITION_DURATION, offset: currentOffset },
      inputs: [prevVideo, nextVideo],
      outputs: outputLabel
    })
    prevVideo = outputLabel
  }

  const audioInputs = clipsPaths.map((_, i) => `${i}:a`)
  filterComplex.push({
    filter: 'concat',
    options: { n: clipsPaths.length, v: 0, a: 1 },
    inputs: audioInputs,
    outputs: 'aout'
  })

  return new Promise((resolve, reject) => {
    command
      .complexFilter(filterComplex)
      .outputOptions(['-map', `[${prevVideo}]`, '-map', '[aout]', '-c:v libx264', '-pix_fmt yuv420p', '-shortest'])
      .save(finalOutput)
      .on('end', () => {
        console.log(`\n🎉 VIDEO RENDERIZADO EN: ${finalOutput}`)
        resolve(null)
      })
      .on('error', (err) => {
        console.error('❌ Error en Merge:', err.message)
        reject(err)
      })
  })
}
