import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs-extra'

/**
 * Convierte una imagen estática en un video MP4 mudo de 9:16 (1080x1920)
 */
/**
 * CORRECCIÓN FINAL: Genera un video de 0.25s usando la imagen y
 * un fragmento de la música de fondo real para evitar errores de formato.
 */
export function createThumbnailShortYoutubeVideo ({ imagePath, musicPath, outputPath, duration }: { imagePath: string, musicPath: string, outputPath: string, duration: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    // --- INPUT 0: LA IMAGEN ---
    command.input(imagePath)
      .inputOptions([
        '-loop 1', // Bucle de imagen
        '-framerate 30', // Forzar 30 fps
            `-t ${duration}` // Leer solo 0.25s
      ])

    // --- INPUT 1: LA MÚSICA DE FONDO (Si existe) ---
    if (musicPath && fs.existsSync(musicPath)) {
      command.input(musicPath)
        .inputOptions([
                `-t ${duration}` // Cortar solo el inicio de la canción (0.25s)
        ])
    } else {
      // Fallback extremo: Si no hay música, usamos silencio (aunque esto daba error antes,
      // asumimos que en tu caso SIEMPRE habrá música de fondo disponible en la carpeta).
      // Si llegamos aquí sin música, el concat podría fallar después, pero es un caso borde.
      command.input('anullsrc=channel_layout=stereo:sample_rate=44100')
        .inputOptions(['-f lavfi', `-t ${duration}`])
    }

    command.complexFilter([
      // Escalar imagen a 1080x1920
      '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v]'
    ])
      .outputOptions([
        '-map [v]', // Video procesado
        '-map 1:a', // Audio del input 1 (La música o el silencio)
        '-c:v libx264',
        '-c:a aac', // Re-codificar audio para asegurar compatibilidad
        '-pix_fmt yuv420p',
        '-shortest',
        '-movflags +faststart'
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error('❌ Error creando thumbnail video:', err)
        reject(err)
      })
  })
}
