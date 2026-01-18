import fs from 'fs-extra'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg' // Necesitamos ffmpeg explícitamente para los helpers nuevos
import { fileURLToPath } from 'url'
// @ts-ignore
import getMP3Duration from 'mp3-duration'

// --- TUS IMPORTACIONES LOCALES ---
import { createSceneVideo } from './createSceneVideo'
import { mergeClipsXfade } from './mergeClipsXfade'
import { audioGenerator } from './audioGenerator'
import { imageGenerator } from './imageGenerator'
import { addBackgroundMusic } from './addBackgroundMusic'
import { createVerticalVideo } from './createVerticalVideo'

import {
  BACKGROUND_VOLUME_AUDIO,
  TRANSITION_DURATION,
  ZOOM_FACTOR
} from '../constants'
import { sleep } from '../utils/sleep'

// ==========================================
// 1. DEFINICIÓN DE TIPOS
// ==========================================

interface Scene {
  id: number
  text: string
  imagePrompt: string
  source?: string
}

interface ShortConfig {
  name: string
  startId: number
  endId: number
  zoom: number
  thumbnail: string // <--- NUEVO: Nombre del archivo de imagen para miniatura YouTube
}

interface Dirs {
  audio: string
  images: string
  temp: string
  music: string
  output: string
  shorts: string
  endShorts: string // <--- NUEVO
  youtubeThumbnails: string // <--- NUEVO
}

interface AssetResult {
  clipsPaths: string[]
  videoDurations: number[]
}

interface ShortAssets {
    clips: string[]
    durations: number[]
}

// ==========================================
// 2. CONFIGURACIÓN
// ==========================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuración de rutas
const dirs: Dirs = {
  audio: path.join(__dirname, '../assets/audio'),
  images: path.join(__dirname, '../assets/images'),
  temp: path.join(__dirname, '../assets/temp_clips'),
  music: path.join(__dirname, '../assets/backgroundAudio'),
  output: path.join(__dirname, '../output'),
  shorts: path.join(__dirname, '../output/shorts'),
  endShorts: path.join(__dirname, '../assets/endShorts'), // Asegúrate que exista
  youtubeThumbnails: path.join(__dirname, '../assets/youtubeThumbnailShorts') // Asegúrate que exista
}

// Configuración de los Shorts
const SHORTS_CONFIG: ShortConfig[] = [
  {
    name: 'short_intro_cliffhanger',
    startId: 1,
    endId: 3,
    zoom: ZOOM_FACTOR,
    thumbnail: 'thumbnail_1.png' // <--- Imagen específica para este short
  },
  {
    name: 'short_king_political_trick',
    startId: 25,
    endId: 26,
    zoom: 1.8,
    thumbnail: 'thumbnail_2.png'
  },
  {
    name: 'short_science_vs_religion',
    startId: 70,
    endId: 73,
    zoom: ZOOM_FACTOR,
    thumbnail: 'thumbnail_3.png'
  }
]

// Carga del Storyboard
const storyboardPath = new URL('../data/storyboard.json', import.meta.url)
if (!fs.existsSync(storyboardPath)) {
  console.error('❌ FATAL: No encuentro storyboard.json')
  process.exit(1)
}
const storyboard: Scene[] = JSON.parse(fs.readFileSync(storyboardPath.pathname, 'utf-8'))

// ==========================================
// 3. FUNCIÓN PRINCIPAL
// ==========================================

export async function main (): Promise<void> {
  console.log('🚀 --- INICIANDO PIPELINE DE VIDEO (MULTI-PLATAFORMA) ---')

  // Crear carpetas
  Object.values(dirs).forEach((d: string) => fs.ensureDirSync(d))

  // FASE 1: Generar Assets
  const { clipsPaths, videoDurations } = await generateAllAssets(storyboard)

  // FASE 2: Video Principal (Opcional, omitir si solo quieres probar shorts)
  if (clipsPaths.length > 0) {
    await createMainVideoPipeline(clipsPaths, videoDurations)
  }

  // FASE 3: Shorts Multi-Versión
  await createShortsPipeline()

  console.log('\n🏁 --- PROCESO COMPLETADO ---')
}

// ==========================================
// 4. FUNCIONES WORKERS
// ==========================================

// ... (generateAllAssets SE MANTIENE IGUAL QUE ANTES) ...
async function generateAllAssets (storyboardData: Scene[]): Promise<AssetResult> {
  const clipsPaths: string[] = []
  const videoDurations: number[] = []
  console.log('\n--- 🏭 FASE 1: Generando Assets ---')

  for (let i = 0; i < storyboardData.length; i++) {
    const scene = storyboardData[i]
    // ... (Tu lógica de generación de assets existente) ...
    // ... (Estoy resumiendo para ahorrar espacio, usa tu código anterior aquí) ...

    // SIMULACIÓN DE PROCESO PARA QUE EL CÓDIGO COMPILE SI LO COPIAS DIRECTO
    // EN TU VERSIÓN FINAL USA EL CÓDIGO COMPLETO DE LA RESPUESTA ANTERIOR EN ESTA FUNCIÓN
    const videoClipPath = path.join(dirs.temp, `scene_${scene.id}.mp4`)
    const audioPath = path.join(dirs.audio, `scene_${scene.id}.mp3`)

    // Solo check básico para el ejemplo
    if (!fs.existsSync(audioPath)) { /* generate audio */ }
    if (!fs.existsSync(videoClipPath)) { /* create video */ }

    if (fs.existsSync(videoClipPath) && fs.existsSync(audioPath)) {
      clipsPaths.push(videoClipPath)
      const d = await getMP3Duration(audioPath)
      videoDurations.push(d + TRANSITION_DURATION)
    }
  }
  return { clipsPaths, videoDurations }
}

// ... (createMainVideoPipeline SE MANTIENE IGUAL QUE ANTES) ...
async function createMainVideoPipeline (clipsPaths: string[], videoDurations: number[]): Promise<void> {
  // ... Tu código anterior ...
}

/**
 * ✂️ FASE 3 REFACTORIZADA: SHORTS MULTI-PLATAFORMA
 */
async function createShortsPipeline (): Promise<void> {
  console.log('\n--- ✂️ FASE 3: Generando Shorts Multi-Plataforma ---')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  // Plataformas soportadas y sus archivos de cierre esperados
  const platforms = [
    { id: 'youtube', endingFile: 'end_short_youtube.mp4' },
    { id: 'tiktok', endingFile: 'end_tiktok.mp4' },
    { id: 'reel', endingFile: 'end_reel.mp4' }
  ]

  for (const shortConfig of SHORTS_CONFIG) {
    console.log(`\n🎬 Preparando Base para Short: "${shortConfig.name}"`)

    // 1. Obtener clips
    const { clips, durations } = await getClipsForShort(shortConfig.startId, shortConfig.endId)
    if (clips.length === 0) continue

    // Rutas temporales para la "Base" (contenido común)
    const baseRawPath = path.join(dirs.shorts, `${shortConfig.name}_base_raw.mp4`)
    const baseMusicPath = path.join(dirs.shorts, `${shortConfig.name}_base_music.mp4`)
    const baseVerticalPath = path.join(dirs.shorts, `${shortConfig.name}_base_9_16.mp4`)

    try {
      // 2. Crear el "Cuerpo" del video (Merge -> Música -> Vertical)
      //    Hacemos esto UNA vez y lo reutilizamos para las 3 plataformas.

      // A. Merge escenas
      await mergeClipsXfade({ clipsPaths: clips, finalOutput: baseRawPath, durations })

      // B. Música
      if (fs.existsSync(backgroundMusicFile)) {
        await addBackgroundMusic({
          videoPath: baseRawPath,
          musicPath: backgroundMusicFile,
          outputPath: baseMusicPath,
          volume: BACKGROUND_VOLUME_AUDIO
        })
      } else {
        fs.copyFileSync(baseRawPath, baseMusicPath)
      }

      // C. Convertir cuerpo a Vertical
      await createVerticalVideo({
        inputPath: baseMusicPath,
        outputPath: baseVerticalPath,
        zoomFactor: shortConfig.zoom
      })

      console.log('   ✅ Cuerpo base generado. Creando versiones...')

      // 3. Generar versiones por plataforma
      for (const platform of platforms) {
        const endingPath = path.join(dirs.endShorts, platform.endingFile)
        const finalOutputPath = path.join(dirs.shorts, `${shortConfig.name}_${platform.id}.mp4`)

        const videosToConcat: string[] = []

        // A. Añadimos el cuerpo
        videosToConcat.push(baseVerticalPath)

        // B. Añadimos el ending (si existe)
        if (fs.existsSync(endingPath)) {
          videosToConcat.push(endingPath)
        } else {
          console.warn(`      ⚠️ No se encontró ending para ${platform.id} (${endingPath})`)
        }

        // C. CASO ESPECIAL YOUTUBE: Thumbnail trick
        let tempThumbVideoPath = ''
        if (platform.id === 'youtube') {
          const thumbImagePath = path.join(dirs.youtubeThumbnails, shortConfig.thumbnail)

          if (fs.existsSync(thumbImagePath)) {
            console.log('      📸 Generando clip de miniatura (0.25s) para YouTube...')
            tempThumbVideoPath = path.join(dirs.shorts, `temp_thumb_${shortConfig.name}.mp4`)

            // Convertir imagen a video de 0.25s
            await createThumbnailVideo({
              imagePath: thumbImagePath,
              outputPath: tempThumbVideoPath,
              duration: 0.25
            })

            videosToConcat.push(tempThumbVideoPath)
          } else {
            console.warn(`      ⚠️ No se encontró la imagen de miniatura: ${shortConfig.thumbnail}`)
          }
        }

        // D. Concatenar todo (Cuerpo + Ending + [Thumbnail])
        if (videosToConcat.length > 1) {
          console.log(`      🔨 Ensamblando versión ${platform.id}...`)
          await concatVideos({
            inputPaths: videosToConcat,
            outputPath: finalOutputPath
          })
          console.log(`      ✨ Versión ${platform.id} lista: ${path.basename(finalOutputPath)}`)
        } else {
          // Si no hay ending ni thumbnail, solo copiamos la base
          fs.copyFileSync(baseVerticalPath, finalOutputPath)
        }

        // Limpieza del clip de thumbnail temporal
        if (tempThumbVideoPath && fs.existsSync(tempThumbVideoPath)) {
          fs.unlinkSync(tempThumbVideoPath)
        }
      }

      // Limpieza de archivos base temporales
      // fs.unlinkSync(baseRawPath)
      // fs.unlinkSync(baseMusicPath)
      // fs.unlinkSync(baseVerticalPath)
    } catch (error) {
      console.error(`❌ Falló la creación del short ${shortConfig.name}:`, error)
    }
  }
}

async function getClipsForShort (startId: number, endId: number): Promise<ShortAssets> {
  const clips: string[] = []
  const durations: number[] = []
  for (let id = startId; id <= endId; id++) {
    const clipPath = path.join(dirs.temp, `scene_${id}.mp4`)
    const audioPath = path.join(dirs.audio, `scene_${id}.mp3`)
    if (fs.existsSync(clipPath) && fs.existsSync(audioPath)) {
      clips.push(clipPath)
      const d = await getMP3Duration(audioPath)
      durations.push(d + TRANSITION_DURATION)
    }
  }
  return { clips, durations }
}

// ==========================================
// 5. NUEVOS HELPERS PARA ESTA FUNCIONALIDAD
// ==========================================

/**
 * Convierte una imagen estática en un video MP4 mudo de 9:16 (1080x1920)
 */
function createThumbnailVideo ({ imagePath, outputPath, duration }: { imagePath: string, outputPath: string, duration: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .loop(duration) // Loop de la imagen por X segundos
      .inputOptions(['-f image2']) // Forzar formato imagen
      .complexFilter([
        // Escalamos la imagen para asegurar que sea 1080x1920 y evite errores al concatenar
        'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
      ])
      .outputOptions([
        '-c:v libx264',
        '-t ' + duration, // Duración estricta
        '-pix_fmt yuv420p', // Formato de pixel estándar para compatibilidad
        '-r 30' // Frame rate estándar
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
  })
}

/**
 * Une múltiples videos verticalmente (Concatenación simple).
 * Útil para pegar el Ending y la Miniatura al final.
 */
function concatVideos ({ inputPaths, outputPath }: { inputPaths: string[], outputPath: string }): Promise<void> {
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

// ==========================================
// 6. CORRECCIÓN EN HELPER THUMBNAIL (CON AUDIO)
// ==========================================
// Sobrescribimos la función anterior para añadir audio mudo, vital para concatenar sin errores.

function createThumbnailVideo ({ imagePath, outputPath, duration }: { imagePath: string, outputPath: string, duration: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .loop(duration)
      .input('anullsrc=channel_layout=stereo:sample_rate=44100') // Generador de silencio
      .inputOptions(['-f lavfi']) // Formato para el generador
      .complexFilter([
        // Escalar imagen a 1080x1920
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v]',
                 // Cortar el audio generado para que dure lo mismo que el video
                 `[1:a]atrim=duration=${duration}[a]`
      ])
      .outputOptions([
        '-map [v]', '-map [a]',
        '-c:v libx264', '-c:a aac',
        '-t ' + duration,
        '-pix_fmt yuv420p',
        '-r 30'
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error('Error creando thumbnail video:', err)
        reject(err)
      })
  })
}

main().catch(console.error)
