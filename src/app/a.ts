import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
// @ts-ignore: mp3-duration no tiene tipos oficiales a veces, si tienes @types/mp3-duration omite esto
import getMP3Duration from 'mp3-duration'

// Imports de tus utilidades (Asumiendo que estas ya existen)
import { createSceneVideo } from './createSceneVideo'
import { mergeClipsXfade } from './mergeClipsXfade'
import { audioGenerator } from './audioGenerator'
import { imageGenerator } from './imageGenerator'
import { BACKGROUND_VOLUME_AUDIO, TRANSITION_DURATION, ZOOM_FACTOR } from '../constants'
import { sleep } from '../utils/sleep'
import { addBackgroundMusic } from './addBackgroundMusic'
import { createVerticalVideo } from './createVerticalVideo'

// --- 1. DEFINICIÓN DE TIPOS (INTERFACES) ---

interface Scene {
  id: number
  text: string
  imagePrompt: string
  source?: string // Opcional, por si acaso
}

interface ShortConfig {
  name: string
  startId: number
  endId: number
  zoom: number
}

interface Dirs {
  audio: string
  images: string
  temp: string
  music: string
  output: string
  shorts: string
}

interface AssetResult {
  clipsPaths: string[]
  videoDurations: number[]
}

interface ShortAssets {
    clips: string[]
    durations: number[]
}

// --- 2. CONFIGURACIÓN Y CONSTANTES ---

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SHORTS_CONFIG: ShortConfig[] = [
  { name: 'short_intro_cliffhanger', startId: 1, endId: 3, zoom: ZOOM_FACTOR },
  { name: 'short_king_political_trick', startId: 25, endId: 26, zoom: ZOOM_FACTOR },
  { name: 'short_science_vs_religion', startId: 70, endId: 73, zoom: ZOOM_FACTOR }
]

const dirs: Dirs = {
  audio: path.join(__dirname, '../assets/audio'),
  images: path.join(__dirname, '../assets/images'),
  temp: path.join(__dirname, '../assets/temp_clips'),
  music: path.join(__dirname, '../assets/backgroundAudio'),
  output: path.join(__dirname, '../output'),
  shorts: path.join(__dirname, '../output/shorts')
}

// Cargar Storyboard
const storyboardPath = new URL('../data/storyboard.json', import.meta.url)
if (!fs.existsSync(storyboardPath)) {
  console.error('❌ No encuentro storyboard.json')
  process.exit(1)
}

// Tipamos el JSON parseado como un Array de Scene
const storyboard: Scene[] = JSON.parse(fs.readFileSync(storyboardPath.pathname, 'utf-8'))

// --- 3. FUNCIÓN PRINCIPAL (ORQUESTADOR) ---

export async function main (): Promise<void> {
  console.log('🚀 Iniciando Pipeline Modular...')

  // 1. Inicializar directorios
  Object.values(dirs).forEach((d: string) => fs.ensureDirSync(d))

  // 2. FASE: Generación de Assets (Audio, Imagen, Video Clips)
  const { clipsPaths, videoDurations } = await generateAllAssets(storyboard)

  // 3. FASE: Video Principal (Horizontal + Vertical)
  if (clipsPaths.length > 0) {
    await createMainVideoPipeline(clipsPaths, videoDurations)
  } else {
    console.error('⚠️ No hay clips generados, saltando video principal.')
  }

  // 4. FASE: Shorts (Cliffhangers)
  await createShortsPipeline()

  console.log('\n🏁 Pipeline finalizado con éxito.')
}

// --- 4. FUNCIONES DE LÓGICA (WORKERS) ---

/**
 * FASE 1: Se encarga de iterar el storyboard y generar audios, imágenes y clips individuales.
 */
async function generateAllAssets (storyboardData: Scene[]): Promise<AssetResult> {
  const clipsPaths: string[] = []
  const videoDurations: number[] = []

  console.log('\n--- FASE 1: Generando Assets y Clips ---')

  for (let i = 0; i < storyboardData.length; i++) {
    const scene = storyboardData[i]
    console.log(`\n--- 🎬 Escena ${scene.id}: ${scene.text.substring(0, 20)}... ---`)

    const audioPath = path.join(dirs.audio, `scene_${scene.id}.mp3`)
    const imagePath = path.join(dirs.images, `scene_${scene.id}.png`)
    const videoClipPath = path.join(dirs.temp, `scene_${scene.id}.mp4`)

    // A. Generar Audio
    if (!fs.existsSync(audioPath)) {
      try {
        console.log('🎤 Generando audio...')
        await audioGenerator({ text: scene.text, outputPath: audioPath })
      } catch (error: any) {
        console.error(`❌ Error audio escena ${scene.id}:`, error.message)
        continue // Saltamos escena si falla audio
      }
    }

    // B. Generar Imagen
    if (!fs.existsSync(imagePath)) {
      try {
        console.log('🎨 Generando imagen...')
        await imageGenerator({
          rawPrompt: scene.imagePrompt,
          outputPath: imagePath,
          options: { aspectRatio: '16:9', model: 'gemini-2.5-flash-image' }
        })
        console.log('zzz Enfriando API (5s)...')
        await sleep(5000)
      } catch (error: any) {
        console.error(`❌ Error imagen escena ${scene.id}:`, error.message)
      }
    }

    // C. Renderizar Clip
    if (fs.existsSync(audioPath)) {
      const audioDuration: number = await getMP3Duration(audioPath)
      const totalDuration = audioDuration + TRANSITION_DURATION

      videoDurations.push(totalDuration)
      console.log(`⏱️ Duración: ${totalDuration.toFixed(2)}s`)

      if (fs.existsSync(imagePath)) {
        // Solo creamos el video si no existe ya
        if (!fs.existsSync(videoClipPath)) {
          await createSceneVideo({
            imagePath,
            audioPath,
            duration: totalDuration,
            outputPath: videoClipPath
          })
        }
        clipsPaths.push(videoClipPath)
      } else {
        console.error('⚠️ Imagen faltante, saltando clip.')
      }
    }
  }

  return { clipsPaths, videoDurations }
}

/**
 * FASE PRINCIPAL: Une los clips, pone música y crea la versión vertical.
 */
async function createMainVideoPipeline (clipsPaths: string[], videoDurations: number[]): Promise<void> {
  console.log('\n--- FASE PRINCIPAL: Creando Video Completo ---')

  const rawVideoPath = path.join(dirs.output, 'video_raw.mp4')
  const finalVideoPath = path.join(dirs.output, 'final_video.mp4')
  const verticalVideoPath = path.join(dirs.output, 'final_video_9_16.mp4')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  // 1. Unir Clips
  await mergeClipsXfade({
    clipsPaths,
    finalOutput: rawVideoPath,
    durations: videoDurations
  })

  // 2. Añadir Música
  console.log('🎵 Añadiendo música de fondo...')
  if (fs.existsSync(backgroundMusicFile)) {
    try {
      await addBackgroundMusic({
        videoPath: rawVideoPath,
        musicPath: backgroundMusicFile,
        outputPath: finalVideoPath,
        volume: BACKGROUND_VOLUME_AUDIO
      })
    } catch (e) {
      console.error('Error música:', e)
    }
  } else {
    fs.copyFileSync(rawVideoPath, finalVideoPath)
  }

  // 3. Versión Vertical
  console.log('📱 Generando versión vertical completa...')
  if (fs.existsSync(finalVideoPath)) {
    await createVerticalVideo({
      inputPath: finalVideoPath,
      outputPath: verticalVideoPath,
      zoomFactor: ZOOM_FACTOR
    })
  }
}

/**
 * FASE SHORTS: Itera sobre la configuración y genera videos cortos.
 */
async function createShortsPipeline (): Promise<void> {
  console.log('\n--- FASE SHORTS: Generando Clips Promocionales ---')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  for (const shortConfig of SHORTS_CONFIG) {
    console.log(`\n✂️ Procesando Short: ${shortConfig.name}`)

    // Recolectar clips para este short específico
    const { clips, durations } = await getClipsForShort(shortConfig.startId, shortConfig.endId)

    if (clips.length === 0) continue

    const rawPath = path.join(dirs.shorts, `${shortConfig.name}_raw.mp4`)
    const musicPath = path.join(dirs.shorts, `${shortConfig.name}_music.mp4`)
    const finalPath = path.join(dirs.shorts, `${shortConfig.name}_final_9_16.mp4`)

    try {
      // 1. Unir
      await mergeClipsXfade({ clipsPaths: clips, finalOutput: rawPath, durations })

      // 2. Música (Si existe, sino copia)
      if (fs.existsSync(backgroundMusicFile)) {
        await addBackgroundMusic({
          videoPath: rawPath,
          musicPath: backgroundMusicFile,
          outputPath: musicPath,
          volume: BACKGROUND_VOLUME_AUDIO
        })
      } else {
        fs.copyFileSync(rawPath, musicPath)
      }

      // 3. Verticalizar
      await createVerticalVideo({
        inputPath: musicPath,
        outputPath: finalPath,
        zoomFactor: shortConfig.zoom
      })

      console.log(`✅ Short listo: ${finalPath}`)
    } catch (error) {
      console.error(`❌ Falló short ${shortConfig.name}:`, error)
    }
  }
}

/**
 * Helper para obtener los paths y duraciones de un rango de escenas
 */
async function getClipsForShort (startId: number, endId: number): Promise<ShortAssets> {
  const clips: string[] = []
  const durations: number[] = []

  for (let id = startId; id <= endId; id++) {
    const clipPath = path.join(dirs.temp, `scene_${id}.mp4`)
    const audioPath = path.join(dirs.audio, `scene_${id}.mp3`)

    if (fs.existsSync(clipPath) && fs.existsSync(audioPath)) {
      clips.push(clipPath)
      const d: number = await getMP3Duration(audioPath)
      durations.push(d + TRANSITION_DURATION)
    }
  }
  return { clips, durations }
}

// Ejecutar
main().catch(console.error)
