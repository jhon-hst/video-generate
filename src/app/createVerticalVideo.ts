import ffmpeg from 'fluent-ffmpeg'

interface VerticalVideoOptions {
  inputPath: string
  outputPath: string
  /**
   * Factor de zoom para el recorte del video principal.
   * 1.0 = Ajustar al ancho.
   * Recomendado: 1.5 - 1.8
   */
  zoomFactor?: number
  /**
   * Intensidad del desenfoque del fondo (Opcional).
   * Por defecto: 40
   */
  blurIntensity?: number
}

export const createVerticalVideo = ({
  inputPath,
  outputPath,
  zoomFactor = 1.8,
  blurIntensity = 40 // Nuevo parámetro para controlar qué tan borroso se ve
}: VerticalVideoOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`📱 Creando versión vertical con fondo borroso (Zoom: ${zoomFactor}x)...`)

    // Calculamos el ancho del video frontal (igual que tu lógica original)
    let scaledWidth: number = Math.floor(1080 * zoomFactor)
    if (scaledWidth % 2 !== 0) scaledWidth += 1

    ffmpeg(inputPath)
      .complexFilter([
        // --- 1. CAPA DE FONDO (Background) ---
        // Tomamos la entrada [0:v], la escalamos para cubrir 1080x1920 (increase)
        // Recortamos los excesos para que sea exactamente 1080x1920
        // Aplicamos boxblur (intensidad del desenfoque)
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=${blurIntensity}[bg]`,

        // --- 2. CAPA FRONTAL (Foreground) ---
        // Tu lógica original: Escalar según zoom y recortar a 1080px de ancho.
        // Nota: Ya no usamos 'pad' aquí, porque lo pondremos encima del fondo.
        `[0:v]scale=${scaledWidth}:-2,crop=1080:ih:(iw-1080)/2:0[fg]`,

        // --- 3. COMPOSICIÓN (Overlay) ---
        // Ponemos [fg] encima de [bg].
        // x=0 (centrado horizontalmente ya que ambos son 1080)
        // y=(main_h-overlay_h)/2 (centrado verticalmente automáticamente)
        '[bg][fg]overlay=0:(H-h)/2[final]'
      ])
      .outputOptions([
        '-map [final]', // Usamos el resultado del overlay
        '-map 0:a', // Mantenemos el audio original
        '-c:v libx264',
        '-c:a copy'
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
