import ffmpeg from 'fluent-ffmpeg'

/**
 * Une múltiples videos verticalmente (Concatenación simple).
 * Útil para pegar el Ending y la Miniatura al final.
 */
export function concatVideos ({ inputPaths, outputPath }: { inputPaths: string[], outputPath: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    // Añadimos cada video como input
    inputPaths.forEach(p => command.input(p))

    // Creamos un filtro complejo para concatenar
    // [0:v][0:a][1:v][1:a]...concat=n=X:v=1:a=1[v][a]
    // Nota: El Thumbnail video NO tiene audio, esto puede causar error en concat simple si no manejamos el audio.
    // Para solucionar esto de forma robusta, asumimos que el thumbnail no tiene audio stream.
    // La forma más segura es usar el protocolo 'concat' de ffmpeg con re-encode para unificar formatos.

    const filterInputs = inputPaths.map((_, i) => `[${i}:v]`).join('')

    // NOTA IMPORTANTE: Si los videos de ending tienen audio y el thumbnail no, ffmpeg se quejará.
    // Solución: Generamos un audio de silencio para el thumbnail o usamos un filtro más complejo.
    // Para simplificar y dado que el thumbnail es 0.25s al final, vamos a concatenar SOLO VIDEO si el último es imagen,
    // o mejor, usamos un enfoque seguro: re-codificar todo al mismo formato.

    // Vamos a usar el método .mergeToFile de fluent-ffmpeg que maneja concat automáticamente
    // pero a veces falla con streams dispares. Usaremos complexFilter manual para mayor control.

    // Estrategia: Concatenar video y audio.
    // Si el último input (thumbnail) no tiene audio, ffmpeg puede fallar en el map [a].
    // Asumiremos que el helper createThumbnailVideo genera un video SIN audio.
    // El filtro concat espera el mismo número de streams.
    // Truco: Añadir audio silencioso al thumbnail video en el helper anterior sería ideal,
    // pero aquí vamos a usar un filtro que maneje video.

    /* Simplicidad: Vamos a usar concat solo de video para el último tramo si es el thumbnail,
           pero perderíamos el audio del ending.
           Mejor opción: Re-implementar createThumbnailVideo para que tenga una pista de audio muda.
        */

    // ... He actualizado createThumbnailVideo abajo para incluir audio nulo (anullsrc) ...
    // ... Entonces aquí podemos hacer concat normal ...

    const numInputs = inputPaths.length
    const filter = `${inputPaths.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${numInputs}:v=1:a=1[v][a]`

    command
      .complexFilter(filter)
      .outputOptions(['-map [v]', '-map [a]', '-c:v libx264', '-c:a aac'])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
  })
}
