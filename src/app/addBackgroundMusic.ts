import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs-extra'

/**
 * Mezcla un video con música de fondo, ajustando el volumen de la música
 * y asegurando que dure lo mismo que el video.
 */

interface AddBackgroundMusicParams {
  videoPath: string
  musicPath: string
  outputPath: string
  volume?: number
}
export const addBackgroundMusic = ({ videoPath, musicPath, outputPath, volume = 0.1 }: AddBackgroundMusicParams) => {
  return new Promise((resolve, reject) => {
    console.log('🎵 Añadiendo música de fondo...')

    if (!fs.existsSync(musicPath)) {
      return reject(new Error(`No se encontró el archivo de música: ${musicPath}`))
    }

    ffmpeg()
      .input(videoPath)
      // Input 1: La música. "-stream_loop -1" hace que la música se repita si el video es muy largo
      .input(musicPath)
      .inputOption('-stream_loop -1')
      .complexFilter([
        // 1. Bajamos el volumen de la música (input 1) a un porcentaje (ej. 0.1 = 10%)
        `[1:a]volume=${volume}[music]`,
        // 2. Mezclamos el audio original del video (0:a) con la música ajustada [music]
        // inputs=2: mezclamos 2 audios
        // duration=first: la duración final será la del primer input (el video)
        '[0:a][music]amix=inputs=2:duration=first[audio_out]'
      ])
      // Mapeamos el video original (copia directa, sin recodificar video = muy rápido)
      .outputOptions(['-map 0:v', '-map [audio_out]', '-c:v copy', '-c:a aac'])
      .save(outputPath)
      .on('end', () => {
        console.log('✅ Música de fondo añadida correctamente.')
        resolve(null)
      })
      .on('error', (err) => {
        console.error('❌ Error añadiendo música:', err)
        reject(err)
      })
  })
}
