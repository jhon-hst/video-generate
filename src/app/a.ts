import fs from 'fs-extra'
import path from 'path'
import getMP3Duration from 'mp3-duration'
import { fileURLToPath } from 'url'

import { createSceneVideo } from './createSceneVideo'
import { mergeClipsXfade } from './mergeClipsXfade'
import { audioGenerator } from './audioGenerator'
import { imageGenerator } from './imageGenerator'
import { addBackgroundMusic } from './addBackgroundMusic' // <--- IMPORTAR AQUÍ
import { TRANSITION_DURATION } from '../constants'
import { sleep } from '../utils/sleep'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ... (El resto de tu código de carga de storyboard sigue igual) ...
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
  output: path.join(__dirname, '../output'),
  music: path.join(__dirname, '../assets/music') // <--- NUEVA RUTA DE MÚSICA
}

export async function main () {
  console.log('🚀 Iniciando Pipeline...')
  Object.values(dirs).forEach(d => fs.ensureDirSync(d))

  // Definir ruta de la música de fondo
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mp3') // Asegúrate que este archivo exista

  const clipsPaths = []
  const videoDurations = []

  // --- FASE 1: GENERAR ASSETS Y CLIPS ---
  for (let i = 0; i < storyboard.length; i++) {
    // ... (Toda tu lógica del bucle for sigue IGUAL) ...
    // ... (Generar Audio, Imagen, Calcular duración, Renderizar clip) ...

    // Voy a copiar una parte para mantener el contexto, pero asume que tu código va aquí:
    const scene = storyboard[i]
    // ... lógica existente ...
    const audioPath = path.join(dirs.audio, `scene_${scene.id}.mp3`)
    const imagePath = path.join(dirs.images, `scene_${scene.id}.png`)
    const videoClipPath = path.join(dirs.temp, `scene_${scene.id}.mp4`)

    // (Simulación de tu código original para no repetir todo)
    if (fs.existsSync(audioPath)) {
      const audioDuration = await getMP3Duration(audioPath)
      const videoDuration = audioDuration + TRANSITION_DURATION
      videoDurations.push(videoDuration)
      if (fs.existsSync(imagePath)) {
        // Aquí llamarías a createSceneVideo si el clip no existe
        if (!fs.existsSync(videoClipPath)) {
          await createSceneVideo({ imagePath, audioPath, duration: videoDuration, outputPath: videoClipPath })
        }
        clipsPaths.push(videoClipPath)
      }
    }
  }

  // --- FASE 2: UNIR CLIPS ---
  console.log('\n--- 🎞️ Uniendo clips con transiciones... ---')

  // Creamos un nombre temporal para el video mudo (solo voz)
  const rawVideoPath = path.join(dirs.output, 'video_raw.mp4')
  const finalVideoPath = path.join(dirs.output, 'final_video.mp4')

  await mergeClipsXfade({
    clipsPaths,
    finalOutput: rawVideoPath, // Guardamos primero el video SIN música
    durations: videoDurations
  })

  // --- FASE 3: AÑADIR MÚSICA DE FONDO ---
  console.log('\n--- 🎵 Procesando Audio Final... ---')

  if (fs.existsSync(backgroundMusicFile)) {
    try {
      await addBackgroundMusic({
        videoPath: rawVideoPath,
        musicPath: backgroundMusicFile,
        outputPath: finalVideoPath,
        volume: 0.15 // 15% de volumen para que no tape la voz
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
} main()
