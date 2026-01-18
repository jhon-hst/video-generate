import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import getMP3Duration from 'mp3-duration'

// --- TUS IMPORTACIONES LOCALES ---
// Asegúrate de que estos archivos existan y exporten las funciones correctamente
import { createSceneVideo } from './createSceneVideo'
import { mergeClipsXfade } from './mergeClipsXfade'
import { audioGenerator } from './audioGenerator'
import { imageGenerator } from './imageGenerator'
import { addBackgroundMusic } from './addBackgroundMusic'
import { createVerticalVideo } from './createVerticalVideo'

// Importamos constantes para mantener el código limpio (Magic Numbers)
import {
  BACKGROUND_VOLUME_AUDIO,
  TRANSITION_DURATION,
  ZOOM_FACTOR
} from '../constants'
import { sleep } from '../utils/sleep'

// ==========================================
// 1. DEFINICIÓN DE TIPOS (INTERFACES)
// ==========================================

// Estructura de cada escena en tu storyboard.json
interface Scene {
  id: number
  text: string
  imagePrompt: string
}

// Configuración para generar los videos cortos (Shorts/Reels)
interface ShortConfig {
  name: string
  startId: number // ID de la escena donde empieza el corte
  endId: number // ID de la escena donde termina el corte
  zoom: number // Zoom específico para este formato
}

// Estructura para organizar las rutas de las carpetas
interface Dirs {
  audio: string
  images: string
  temp: string
  music: string
  output: string
  shorts: string
}

// Lo que devuelve la función generadora de assets
interface AssetResult {
  clipsPaths: string[]
  videoDurations: number[]
}

// Lo que devuelve el helper de shorts
interface ShortAssets {
    clips: string[]
    durations: number[]
}

// ==========================================
// 2. CONFIGURACIÓN E INICIALIZACIÓN
// ==========================================

// Configuración para ESM (EcmaScript Modules) en Node
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 📍 ESTRATEGIA DE CONTENIDO: Configuración de los Shorts
// Aquí definimos qué fragmentos del video queremos extraer automáticamente.
const SHORTS_CONFIG: ShortConfig[] = [
  {
    name: 'short_intro_cliffhanger',
    startId: 1,
    endId: 3,
    zoom: ZOOM_FACTOR
  },
  {
    name: 'short_king_political_trick',
    startId: 25,
    endId: 26,
    zoom: ZOOM_FACTOR
  },
  {
    name: 'short_science_vs_religion',
    startId: 70,
    endId: 73,
    zoom: ZOOM_FACTOR
  }
]

// Definición de rutas del sistema
const dirs: Dirs = {
  audio: path.join(__dirname, '../assets/audio'),
  images: path.join(__dirname, '../assets/images'),
  temp: path.join(__dirname, '../assets/temp_clips'),
  music: path.join(__dirname, '../assets/backgroundAudio'),
  output: path.join(__dirname, '../output'),
  shorts: path.join(__dirname, '../output/shorts')
}

// Carga y validación del Storyboard
const storyboardPath = new URL('../data/storyboard.json', import.meta.url)
if (!fs.existsSync(storyboardPath)) {
  console.error('❌ FATAL: No encuentro storyboard.json en la ruta especificada.')
  process.exit(1)
}
const storyboard: Scene[] = JSON.parse(fs.readFileSync(storyboardPath.pathname, 'utf-8'))

// ==========================================
// 3. FUNCIÓN PRINCIPAL (EL DIRECTOR)
// ==========================================

export async function main (): Promise<void> {
  console.log('🚀 --- INICIANDO PIPELINE DE VIDEO ---')

  // 1. Preparar el terreno: Crear carpetas si no existen
  Object.values(dirs).forEach((d: string) => fs.ensureDirSync(d))

  // 2. FASE DE PRODUCCIÓN: Generar todos los assets (Imágenes, Audio, Videos pequeños)
  // Delegamos el trabajo sucio a la función 'generateAllAssets'
  const { clipsPaths, videoDurations } = await generateAllAssets(storyboard)

  // 3. FASE DE POST-PRODUCCIÓN (Video Largo)
  if (clipsPaths.length > 0) {
    await createMainVideoPipeline(clipsPaths, videoDurations)
  } else {
    console.error('⚠️ ALERTA: No se generaron clips. Saltando creación del video principal.')
  }

  // 4. FASE DE MARKETING (Shorts/Reels)
  // Generamos automáticamente el contenido para redes sociales
  await createShortsPipeline()

  console.log('\n🏁 --- PROCESO COMPLETADO CON ÉXITO ---')
}

// ==========================================
// 4. FUNCIONES WORKERS (LA LÓGICA)
// ==========================================

/**
 * 🏭 FASE 1: FÁBRICA DE ASSETS
 * Itera sobre el guion y asegura que existan el audio, la imagen y el clip de video
 * para cada escena. Si algo falta, lo crea.
 */
async function generateAllAssets (storyboardData: Scene[]): Promise<AssetResult> {
  const clipsPaths: string[] = []
  const videoDurations: number[] = []

  console.log('\n--- 🏭 FASE 1: Generando Assets y Clips Individuales ---')

  for (let i = 0; i < storyboardData.length; i++) {
    const scene = storyboardData[i]
    console.log(`\n🎬 Procesando Escena ${scene.id}: "${scene.text.substring(0, 30)}..."`)

    // Definimos las rutas esperadas para esta escena
    const audioPath = path.join(dirs.audio, `scene_${scene.id}.mp3`)
    const imagePath = path.join(dirs.images, `scene_${scene.id}.png`)
    const videoClipPath = path.join(dirs.temp, `scene_${scene.id}.mp4`)

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
          options: { aspectRatio: '16:9', model: 'gemini-2.5-flash-image' }
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
            outputPath: videoClipPath
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

/**
 * 🎞️ FASE PRINCIPAL: MONTAJE DEL VIDEO LARGO
 * 1. Une todos los clips.
 * 2. Añade música de fondo.
 * 3. Crea una versión vertical completa.
 */
async function createMainVideoPipeline (clipsPaths: string[], videoDurations: number[]): Promise<void> {
  console.log('\n--- 🎞️ FASE 2: Montaje del Video Principal (Youtube) ---')

  const rawVideoPath = path.join(dirs.output, 'video_raw.mp4')
  const finalVideoPath = path.join(dirs.output, 'final_video.mp4')
  const verticalVideoPath = path.join(dirs.output, 'final_video_9_16.mp4')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  // 1. UNIR CLIPS CON TRANSICIONES
  console.log('   🔄 Uniendo clips...')
  await mergeClipsXfade({
    clipsPaths,
    finalOutput: rawVideoPath,
    durations: videoDurations
  })

  console.log('   Descanzo para el sistema (20s)...')
  await sleep(20000)

  // 2. MEZCLA DE AUDIO (Música + Voz)
  console.log('   🎵 Mezclando música de fondo...')
  if (fs.existsSync(backgroundMusicFile)) {
    try {
      await addBackgroundMusic({
        videoPath: rawVideoPath,
        musicPath: backgroundMusicFile,
        outputPath: finalVideoPath,
        volume: BACKGROUND_VOLUME_AUDIO
      })
      console.log(`   ✅ Video Horizontal completado: ${finalVideoPath}`)
    } catch (e) {
      console.error('   ❌ Error añadiendo música, usando video sin música.', e)
      fs.copyFileSync(rawVideoPath, finalVideoPath)
    }
  } else {
    console.warn('   ⚠️ No hay música de fondo. Copiando video raw.')
    fs.copyFileSync(rawVideoPath, finalVideoPath)
  }

  console.log('   Descanzo para el sistema (20s)...')
  await sleep(20000)

  // 3. VERSIÓN VERTICAL AUTOMÁTICA
  console.log('   📱 Creando versión vertical completa...')
  if (fs.existsSync(finalVideoPath)) {
    await createVerticalVideo({
      inputPath: finalVideoPath,
      outputPath: verticalVideoPath,
      zoomFactor: ZOOM_FACTOR
    })
  }

  if (fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath)
}

/**
 * ✂️ FASE SHORTS: GENERADOR DE CLIPS VIRALES
 * Recorre la configuración SHORTS_CONFIG y crea videos independientes
 * reutilizando los materiales existentes (sin gastar más API).
 */
async function createShortsPipeline (): Promise<void> {
  console.log('   Descanzo para el sistema (20s)...')
  await sleep(20000)

  console.log('\n--- ✂️ FASE 3: Generando Shorts (Estrategia Cliffhanger) ---')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  for (const shortConfig of SHORTS_CONFIG) {
    console.log(`\n   🎬 Creando Short: "${shortConfig.name}" (Escenas ${shortConfig.startId}-${shortConfig.endId})`)

    // Paso 1: Recolectar solo los clips que pertenecen a este short
    const { clips, durations } = await getClipsForShort(shortConfig.startId, shortConfig.endId)

    if (clips.length === 0) {
      console.warn('   ⚠️ No se encontraron clips para este short. Saltando.')
      continue
    }

    // Rutas temporales y finales para este short
    const rawPath = path.join(dirs.shorts, `${shortConfig.name}_raw.mp4`)
    const musicPath = path.join(dirs.shorts, `${shortConfig.name}_music.mp4`)
    const finalPath = path.join(dirs.shorts, `${shortConfig.name}_final_9_16.mp4`)

    try {
      // Paso 2: Unir los fragmentos
      await mergeClipsXfade({
        clipsPaths: clips,
        finalOutput: rawPath,
        durations
      })

      // Paso 3: Ponerles música
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

      // Paso 4: Convertir a Vertical (TikTok Ready)
      await createVerticalVideo({
        inputPath: musicPath,
        outputPath: finalPath,
        zoomFactor: shortConfig.zoom
      })

      console.log(`   ✨ Short listo para subir: ${finalPath}`)

      // Limpieza (Opcional): Borrar los archivos intermedios para ahorrar espacio
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath)
      if (fs.existsSync(musicPath)) fs.unlinkSync(musicPath)
    } catch (error) {
      console.error(`   ❌ Falló la creación del short ${shortConfig.name}:`, error)
    }
  }
}

/**
 * 🔍 HELPER: BUSCADOR DE ARCHIVOS
 * Busca en la carpeta temporal los archivos mp4 y mp3 correspondientes
 * a un rango de IDs.
 */
async function getClipsForShort (startId: number, endId: number): Promise<ShortAssets> {
  const clips: string[] = []
  const durations: number[] = []

  for (let id = startId; id <= endId; id++) {
    const clipPath = path.join(dirs.temp, `scene_${id}.mp4`)
    const audioPath = path.join(dirs.audio, `scene_${id}.mp3`)

    // Verificamos que ambos existan antes de añadirlos
    if (fs.existsSync(clipPath) && fs.existsSync(audioPath)) {
      clips.push(clipPath)

      // Recalculamos duración por si acaso
      const d: number = await getMP3Duration(audioPath)
      durations.push(d + TRANSITION_DURATION)
    }
  }
  return { clips, durations }
}

// Ejecutar el script y capturar cualquier error fatal global
main().catch((err) => {
  console.error('❌ Error Fatal en el proceso:', err)
  process.exit(1)
})
