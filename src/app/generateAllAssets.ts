import fs from 'fs-extra'
import path from 'path'
import getMP3Duration from 'mp3-duration'

import { createSceneVideo } from './createSceneVideo'
import { audioGenerator } from './audioGenerator'
import { imageGenerator } from './imageGenerator'
import { sleep } from '../utils/sleep'
import { Dirs } from './main'
import { TRANSITION_DURATION } from '../constants'

// Estructura de cada escena en tu storyboard.json
interface Scene {
  id: number
  text: string
  imagePrompt: string
}

// Lo que devuelve la función generadora de assets
interface AssetResult {
  clipsPaths: string[]
  videoDurations: number[]
}

/**
 * 🏭 FASE 1: FÁBRICA DE ASSETS
 * Itera sobre el guion y asegura que existan el audio, la imagen y el clip de video
 * para cada escena. Si algo falta, lo crea.
 */
export async function generateAllAssets ({ storyboardData, dirs, isShort }: {storyboardData: Scene[], dirs: Dirs, isShort: boolean}): Promise<AssetResult> {
  const clipsPaths: string[] = []
  const videoDurations: number[] = []

  console.log('\n--- 🏭 FASE 1: Generando Assets y Clips Individuales ---')

  for (let i = 0; i < storyboardData.length; i++) {
    const scene = storyboardData[i]
    console.log(`\n🎬 Procesando Escena ${scene.id}: "${scene.text.substring(0, 30)}..."`)

    // Definimos las rutas esperadas para esta escena
    const audioPath = path.join(isShort ? dirs.shortAudio : dirs.audio, `scene_${scene.id}.mp3`)
    const imagePath = path.join(isShort ? dirs.shortImages : dirs.images, `scene_${scene.id}.png`)
    const videoClipPath = path.join(isShort ? dirs.shortTemp : dirs.temp, `scene_${scene.id}.mp4`)

    // A. GENERAR AUDIO (Solo si no existe ya)
    if (!fs.existsSync(audioPath)) {
      try {
        console.log('   🎤 Generando voz IA...')
        await audioGenerator({ text: scene.text, outputPath: audioPath })
      } catch (error: any) {
        console.error('   ❌ Error generando audio:', error.message)
        continue // Si no hay audio, no podemos hacer esta escena, pasamos a la siguiente
      }
    }

    // B. GENERAR IMAGEN (Solo si no existe ya)
    if (!fs.existsSync(imagePath)) {
      try {
        console.log('   🎨 Generando imagen con Gemini...')
        await imageGenerator({
          rawPrompt: scene.imagePrompt,
          outputPath: imagePath,
          options: { aspectRatio: isShort ? '9:16' : '16:9', model: 'gemini-2.5-flash-image' }
        })

        console.log('   zzz Enfriando API (Wait 5s)...')
        await sleep(5000) // Pausa para no saturar la API
      } catch (error: any) {
        console.error('   ❌ Error generando imagen:', error.message)
      }
    }

    // C. RENDERIZAR CLIP DE VIDEO (Imagen + Audio)
    // Solo procedemos si tenemos el audio (la imagen es opcional, aunque ideal)
    if (fs.existsSync(audioPath)) {
      // Calculamos cuánto debe durar el video
      const audioDuration: number = await getMP3Duration(audioPath)
      const totalDuration = audioDuration + TRANSITION_DURATION

      videoDurations.push(totalDuration)
      console.log(`   ⏱️ Audio: ${audioDuration.toFixed(2)}s | Video Final: ${totalDuration.toFixed(2)}s`)

      if (fs.existsSync(imagePath)) {
        // Solo renderizamos si el archivo de video NO existe (para ahorrar tiempo en re-runs)
        if (!fs.existsSync(videoClipPath)) {
          await createSceneVideo({
            imagePath,
            audioPath,
            duration: totalDuration,
            outputPath: videoClipPath,
            isShort
          })
        } else {
          console.log('   ✅ Clip de video ya existe, usándolo.')
        }
        clipsPaths.push(videoClipPath)
      } else {
        console.error('   ⚠️ Falta la imagen. Saltando generación de video para esta escena.')
      }
    }
  }

  return { clipsPaths, videoDurations }
}
