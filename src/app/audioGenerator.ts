import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import fs from 'fs-extra'
import { config } from 'dotenv'
config()

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

const VOICE_ID = 'qRUgOhnxGASxirG4fKjv'

const elevenlabs = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY
})

async function streamToBuffer (
  readableStream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = readableStream.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }

  return Buffer.from(
    Uint8Array.from(chunks.flatMap(chunk => Array.from(chunk)))
  )
}

export async function audioGenerator ({ text, outputPath }: {text: string, outputPath: string}) {
  try {
    console.log('🎤 Generando voz con ElevenLabs SDK...')

    const audioStream = await elevenlabs.textToSpeech.convert(
      VOICE_ID,
      {
        text,
        modelId: 'eleven_flash_v2_5',
        outputFormat: 'mp3_44100_128'
      }
    )

    // 🔥 Convertir ReadableStream → Buffer
    const audioBuffer = await streamToBuffer(audioStream)

    await fs.writeFile(outputPath, audioBuffer)

    console.log(`✅ Audio guardado: ${outputPath}`)
  } catch (error) {
    console.error('❌ Error generando audio:', error)
    throw error
  }
}
