import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

import { generateAllAssets } from './generateAllAssets'
import { createMainVideoPipeline } from './createMainVideoPipeline'
// import { createShortsPipeline } from './createShortsPipeline'

// Estructura de cada escena en tu storyboard.json
interface Scene {
  id: number
  text: string
  imagePrompt: string
}

// Estructura para organizar las rutas de las carpetas
export interface Dirs {
  audio: string
  images: string
  temp: string
  music: string
  output: string
  shorts: string
  endShorts: string
  youtubeThumbnailShorts: string
  shortAudio:string
  shortImages: string
  shortTemp: string
}

// Configuración para generar los videos cortos (Shorts/Reels)
export interface ShortConfig {
  name: string
  startId: number // ID de la escena donde empieza el corte
  endId: number // ID de la escena donde termina el corte
  zoom: number // Zoom específico para este formato
  thumbnailYoutubeShort: string // Ruta de la miniatura para Youtube Shorts
}

// Lo que devuelve el helper de shorts
export interface ShortAssets {
    clips: string[]
    durations: number[]
}
// Configuración para ESM (EcmaScript Modules) en Node
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Definición de rutas del sistema
const dirs: Dirs = {
  audio: path.join(__dirname, '../assets/audio'),
  images: path.join(__dirname, '../assets/images'),
  temp: path.join(__dirname, '../assets/temp_clips'),
  shortAudio: path.join(__dirname, '../assets/shortAudio'),
  shortImages: path.join(__dirname, '../assets/shortImages'),
  shortTemp: path.join(__dirname, '../assets/shortTempClips'),
  music: path.join(__dirname, '../assets/backgroundAudio'),
  output: path.join(__dirname, '../output'),
  shorts: path.join(__dirname, '../output/shorts'),
  endShorts: path.join(__dirname, '../assets/endShorts'),
  youtubeThumbnailShorts: path.join(__dirname, '../assets/youtubeThumbnailShorts')
}

// Carga y validación del Storyboard
const storyboardPath = new URL('../data/storyboard.json', import.meta.url)
if (!fs.existsSync(storyboardPath)) {
  console.error('❌ FATAL: No encuentro storyboard.json en la ruta especificada.')
  process.exit(1)
}
const storyboard: Scene[] = JSON.parse(fs.readFileSync(storyboardPath.pathname, 'utf-8'))

// Carga y validación del Storyboard para crear un video tipo short
const storyboardShortPath = new URL('../data/storyboard_short.json', import.meta.url)
if (!fs.existsSync(storyboardShortPath)) {
  console.error('❌ FATAL: No encuentro storyboard_short.json en la ruta especificada.')
  process.exit(1)
}
const storyboardShort: Scene[] = JSON.parse(fs.readFileSync(storyboardShortPath.pathname, 'utf-8'))

// Carga y validación del Storyboard to shorts esto es del video largo 16:9 a quien le sacamos fragmentos de video para shorts shorts
const shortsPath = new URL('../data/shorts.json', import.meta.url)
if (!fs.existsSync(shortsPath)) {
  console.error('❌ FATAL: No encuentro shorts.json en la ruta especificada.')
  process.exit(1)
}
// const shorts: ShortConfig[] = JSON.parse(fs.readFileSync(shortsPath.pathname, 'utf-8'))

const IS_SHORT = false

export async function main (): Promise<void> {
  console.log('🚀 --- INICIANDO PIPELINE DE VIDEO ---')

  // 1. Preparar el terreno: Crear carpetas si no existen
  Object.values(dirs).forEach((d: string) => fs.ensureDirSync(d))

  // 2. FASE DE PRODUCCIÓN: Generar todos los assets (Imágenes, Audio, Videos pequeños)
  // Delegamos el trabajo a la función 'generateAllAssets'
  const { clipsPaths, videoDurations } = await generateAllAssets({
    storyboardData: IS_SHORT ? storyboardShort : storyboard,
    dirs,
    isShort: IS_SHORT
  })

  // 3. FASE DE POST-PRODUCCIÓN (Video Largo)
  if (clipsPaths.length > 0) {
    await createMainVideoPipeline({ clipsPaths, videoDurations, dirs, isShort: IS_SHORT })
  } else {
    console.error('⚠️ ALERTA: No se generaron clips. Saltando creación del video principal.')
  }

  // 4. FASE DE MARKETING (Shorts/Reels) se requiere el archivo shorts.json y los rangos definidos allí por ids
  // Generamos automáticamente el contenido para redes sociales
  // if (IS_SHORT) {
  //   await createShortsPipeline({ dirs, shorts })
  // }

  console.log('\n🏁 --- PROCESO COMPLETADO CON ÉXITO ---')
}
