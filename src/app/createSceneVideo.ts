import ffmpeg from 'fluent-ffmpeg'

export async function createSceneVideo ({ imagePath, audioPath, duration, outputPath }: {imagePath: string, audioPath: string, duration: number, outputPath: string }) {
  const RESOLUTION = '1344x768'
  const FPS = 60

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
    // loop la imagen exactamente lo que dura el audio
      .loop(duration)
      .input(audioPath)
      .videoFilters([
                // Escalamos y forzamos formato seguro
                `scale=${RESOLUTION}`,
                'format=yuv420p'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast',
        '-pix_fmt yuv420p',
                `-r ${FPS}`,
                `-t ${duration}`
      ])
      .save(outputPath)
      .on('end', () => {
        console.log(`✅ Clip renderizado (sin efectos) → ${outputPath}`)
        resolve(null)
      })
      .on('error', (err) => {
        console.error('❌ Error FFmpeg Escena:', err.message)
        reject(err)
      })
  })
}
