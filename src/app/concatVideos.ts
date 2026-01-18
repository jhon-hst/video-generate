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
