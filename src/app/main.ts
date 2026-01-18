import fs from 'fs-extra'
import path from 'path'
import getMP3Duration from 'mp3-duration'
import { fileURLToPath } from 'url'

import { createSceneVideo } from './createSceneVideo'
import { mergeClipsXfade } from './mergeClipsXfade'
import { audioGenerator } from './audioGenerator'
import { imageGenerator } from './imageGenerator'
import { BACKGROUND_VOLUME_AUDIO, TRANSITION_DURATION } from '../constants'
import { sleep } from '../utils/sleep'
import { addBackgroundMusic } from './addBackgroundMusic'
import { createVerticalVideo } from './createVerticalVideo'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storyboardPath = new URL('../data/storyboard.json', import.meta.url)
if (!fs.existsSync(storyboardPath)) {
  console.error('❌ No encuentro storyboard.json')
  process.exit(1)
}
const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'))

const dirs = {
  audio: path.join(__dirname, '../assets/audio'),
  images: path.join(__dirname, '../assets/images'),
  temp: path.join(__dirname, '../assets/temp_clips'),
  music: path.join(__dirname, '../assets/backgroundAudio'), // <--- NUEVA RUTA DE MÚSICA
  output: path.join(__dirname, '../output')

}

export async function main () {
  console.log('🚀 Iniciando Pipeline...')
  Object.values(dirs).forEach(d => fs.ensureDirSync(d))

  const clipsPaths = []
  const videoDurations = []

  // --- FASE 1: GENERAR ASSETS Y CLIPS ---
  for (let i = 0; i < storyboard.length; i++) {
    const scene = storyboard[i]
    console.log(`\n--- 🎬 Escena ${scene.id}: ${scene.text.substring(0, 20)}... ---`)

    const audioPath = path.join(dirs.audio, `scene_${scene.id}.mp3`)
    const imagePath = path.join(dirs.images, `scene_${scene.id}.png`)
    const videoClipPath = path.join(dirs.temp, `scene_${scene.id}.mp4`)

    // 1. GENERAR AUDIO (Si no existe)
    if (!fs.existsSync(audioPath)) {
      try {
        console.log(`🎤 Generando audio para escena ${scene.id}...`)
        await audioGenerator({ text: scene.text, outputPath: audioPath })
      } catch (error) {
        console.error(`❌ Error generando audio escena ${scene.id}:`, error.message)
        // Si falla el audio, no podemos seguir con esta escena
        continue
      }
    }

    // 2. GENERAR IMAGEN (Si no existe)
    if (!fs.existsSync(imagePath)) {
      try {
        // Generamos imagen con Flash y forzamos 16:9
        console.log(`🎤 Generando imagen para escena ${scene.id}...`)
        await imageGenerator({
          rawPrompt: scene.imagePrompt,
          outputPath: imagePath,
          options: { aspectRatio: '16:9', model: 'gemini-2.5-flash-image' }
        })

        console.log('zzz Esperando 5 segundos para enfriar la API de Gemini...')
        await sleep(5000)
      } catch (error) {
        console.error(`❌ Error generando imagen escena ${scene.id}:`, error.message)
      }
    }

    // 3. CALCULAR DURACIÓN
    // Verificamos que el audio exista antes de medirlo
    if (fs.existsSync(audioPath)) {
      const audioDuration = await getMP3Duration(audioPath)

      // El video dura Audio + Transición
      const videoDuration = audioDuration + TRANSITION_DURATION
      videoDurations.push(videoDuration)

      console.log(`⏱️ Audio: ${audioDuration.toFixed(2)}s | Video Clip: ${videoDuration.toFixed(2)}s`)

      // 4. RENDERIZAR VIDEO CLIP
      // Validamos que la imagen exista, si no, usamos un placeholder o saltamos (aquí asumo que existe)
      if (fs.existsSync(imagePath)) {
        await createSceneVideo({
          imagePath,
          audioPath,
          duration: videoDuration,
          outputPath: videoClipPath
        })
        clipsPaths.push(videoClipPath)
      } else {
        console.error('⚠️ Imagen no encontrada, saltando generación de video para esta escena.')
      }
    } else {
      console.error('⚠️ Audio no encontrado, saltando escena.')
    }
  }

  // // 5 UNIR CLIPS CON TRANSICIONES
  console.log('\n--- FASE 5 🎞️ Uniendo clips con transiciones... ---')

  // Creamos un nombre temporal para el video mudo (solo voz)
  const rawVideoPath = path.join(dirs.output, 'video_raw.mp4')
  const finalVideoPath = path.join(dirs.output, 'final_video.mp4')
  await mergeClipsXfade({
    clipsPaths,
    finalOutput: rawVideoPath,
    durations: videoDurations
  })

  // --- FASE 6: AÑADIR MÚSICA DE FONDO ---
  console.log('\n--- FASE 6 🎵 Procesando Audio Final... ---')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  if (fs.existsSync(backgroundMusicFile)) {
    try {
      await addBackgroundMusic({
        videoPath: rawVideoPath,
        musicPath: backgroundMusicFile,
        outputPath: finalVideoPath,
        volume: BACKGROUND_VOLUME_AUDIO
      })

      // Opcional: Borrar el video intermedio
      // fs.unlinkSync(rawVideoPath)
      console.log(`✨ Video completado: ${finalVideoPath}`)
    } catch (error) {
      console.error('Error poniendo música, entregando video sin música', error)
    }
  } else {
    console.warn('⚠️ No se encontró archivo de música de fondo, se omite este paso.')
    // Si no hay música, renombramos el raw a final para tener un output consistente
    fs.copyFileSync(rawVideoPath, finalVideoPath)
  }

  // --- FASE 7: VIDEO VERTICAL ---
  console.log('\n--- FASE 7 📱 Generando versión 9:16 (TikTok/Reels)... ---')
  const verticalVideoPath = path.join(dirs.output, 'final_video_9_16.mp4')
  if (fs.existsSync(finalVideoPath)) {
    try {
      await createVerticalVideo({
        inputPath: finalVideoPath,
        outputPath: verticalVideoPath,
        zoomFactor: 1.8
      })
      console.log(`✨ Video Vertical listo en: ${verticalVideoPath}`)
    } catch (error) {
      console.error('⚠️ Falló la generación del video vertical.', error)
    }
  } else {
    console.error('⚠️ No existe final_video.mp4, no se puede crear la versión vertical.')
  }
}

main()
