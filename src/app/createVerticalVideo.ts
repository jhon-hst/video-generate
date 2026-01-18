import ffmpeg from 'fluent-ffmpeg'

interface VerticalVideoOptions {
  inputPath: string
  outputPath: string
  /**
   * Factor de zoom para el recorte.
   * 1.0 = Ajustar al ancho (barras negras grandes).
   * ~3.15 = Llenar altura (pantalla completa, mucho recorte lateral).
   * Recomendado: 1.5 - 1.8
   */
  zoomFactor?: number
}

export const createVerticalVideo = ({
  inputPath,
  outputPath,
  zoomFactor = 1.5
}: VerticalVideoOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`📱 Creando versión vertical (Zoom: ${zoomFactor}x)...`)

    // Calculamos el ancho escalado basado en el zoom.
    // El ancho base objetivo es 1080px.
    let scaledWidth: number = Math.floor(1080 * zoomFactor)

    // FFmpeg requiere que las dimensiones sean divisibles por 2 para ciertos códecs
    if (scaledWidth % 2 !== 0) scaledWidth += 1

    ffmpeg(inputPath)
      .complexFilter([
        // 1. Escalar: Forzamos el nuevo ancho, la altura (-2) se calcula automáticamente manteniendo el aspect ratio
        `scale=${scaledWidth}:-2[scaled]`,

        // 2. Crop (Recortar): Cortamos el centro para que quede exactamente en 1080px de ancho
        // w=1080, h=altura_actual (ih), x=(ancho_actual - 1080) / 2, y=0
        '[scaled]crop=1080:ih:(iw-1080)/2:0[cropped]',

        // 3. Pad (Rellenar): Ponemos el resultado en un canvas de 1080x1920 (9:16)
        // Centramos verticalmente: (1920 - altura_actual) / 2
        '[cropped]pad=1080:1920:-1:(oh-ih)/2:color=black[final]'
      ])
      .outputOptions([
        '-map [final]', // Usamos el video procesado
        '-map 0:a', // Mantenemos el audio original
        '-c:v libx264', // Re-codificamos video a h264
        '-c:a copy' // Copiamos el audio sin re-procesar (más rápido)
      ])
      .save(outputPath)
      .on('end', () => {
        console.log('✅ Video vertical generado con éxito.')
        resolve()
      })
      .on('error', (err: Error) => {
        console.error('❌ Error creando video vertical:', err)
        reject(err)
      })
  })
}
