import fs from 'fs-extra'
import path from 'path'

import getMP3Duration from 'mp3-duration'

import { mergeClipsXfade } from './mergeClipsXfade'
import { addBackgroundMusic } from './addBackgroundMusic'
import { createVerticalVideo } from './createVerticalVideo'

import {
  BACKGROUND_VOLUME_AUDIO,
  TRANSITION_DURATION
} from '../constants'
import { sleep } from '../utils/sleep'
import { createThumbnailShortYoutubeVideo } from './createThumbnailShortYoutubeVideo'
import { concatVideos } from './concatVideos'
import { Dirs, ShortAssets, ShortConfig } from './main'

/**
 * ✂️ FASE SHORTS: GENERADOR DE CLIPS VIRALES
 * Recorre la configuración SHORTS_CONFIG y crea videos independientes
 * reutilizando los materiales existentes (sin gastar más API).
 */

export async function createShortsPipeline ({ dirs, shorts }: {dirs: Dirs, shorts: ShortConfig[]}): Promise<void> {
  console.log('\n--- ✂️ FASE 3: Generando Shorts Multi-Plataforma ---')
  const backgroundMusicFile = path.join(dirs.music, 'background_chill.mpeg')

  const platforms = [
    { id: 'youtube', endingFile: 'end_short_youtube.mp4' }
    // { id: 'general', endingFile: 'end_tiktok.mp4' }
    // { id: 'reel', endingFile: 'end_reel.mp4' }
  ]

  for (const shortConfig of shorts) {
    console.log(`\n🎬 Procesando Short: "${shortConfig.name}"`)

    // 1. Obtener clips
    const { clips, durations } = await getClipsForShort({
      startId: shortConfig.startId,
      endId: shortConfig.endId,
      dirs
    })
    if (clips.length === 0) continue

    const baseRawPath = path.join(dirs.shorts, `${shortConfig.name}_base_raw.mp4`)
    const baseMusicPath = path.join(dirs.shorts, `${shortConfig.name}_base_music.mp4`)
    const baseVerticalPath = path.join(dirs.shorts, `${shortConfig.name}_base_9_16.mp4`)

    try {
      // --- A. MERGE CLIPS ---
      safeDelete(baseRawPath)
      await mergeClipsXfade({ clipsPaths: clips, finalOutput: baseRawPath, durations })

      // --- B. AÑADIR MÚSICA ---
      // safeDelete(baseMusicPath)
      // if (fs.existsSync(backgroundMusicFile)) {
      //   await addBackgroundMusic({
      //     videoPath: baseRawPath,
      //     musicPath: backgroundMusicFile,
      //     outputPath: baseMusicPath,
      //     volume: BACKGROUND_VOLUME_AUDIO
      //   })
      // } else {
      //   fs.copyFileSync(baseRawPath, baseMusicPath)
      // }
      // Por simplicidad, si no hay música solo copiamos el raw, la musica no se siente bien
      fs.copyFileSync(baseRawPath, baseMusicPath)

      // --- C. CONVERTIR A VERTICAL ---
      // Pequeña pausa técnica para asegurar que el archivo de música se cerró bien
      await sleep(500)

      safeDelete(baseVerticalPath)
      if (fs.existsSync(baseMusicPath)) {
        await createVerticalVideo({
          inputPath: baseMusicPath,
          outputPath: baseVerticalPath,
          zoomFactor: shortConfig.zoom
        })
      } else {
        throw new Error(`Base musical no encontrada: ${baseMusicPath}`)
      }

      console.log('   ✅ Base generada. Creando versiones...')

      // --- D. GENERAR VERSIONES POR PLATAFORMA ---
      for (const platform of platforms) {
        const endingPath = path.join(dirs.endShorts, platform.endingFile)
        const finalOutputPath = path.join(dirs.shorts, `${shortConfig.name}_${platform.id}.mp4`)

        safeDelete(finalOutputPath)

        const videosToConcat: string[] = []
        videosToConcat.push(baseVerticalPath)

        // Agregar Ending
        if (fs.existsSync(endingPath)) {
          videosToConcat.push(endingPath)
        } else {
          console.warn(`      ⚠️ Sin ending para ${platform.id}`)
        }

        // Caso Especial: YouTube Thumbnail
        let tempThumbVideoPath = ''
        if (platform.id === 'youtube') {
          const thumbName = shortConfig.thumbnailYoutubeShort
          const thumbImagePath = path.join(dirs.youtubeThumbnailShorts, thumbName)

          if (fs.existsSync(thumbImagePath)) {
            console.log('      📸 Generando miniatura...')
            tempThumbVideoPath = path.join(dirs.shorts, `temp_thumb_${shortConfig.name}.mp4`)
            safeDelete(tempThumbVideoPath)

            await createThumbnailShortYoutubeVideo({
              imagePath: thumbImagePath,
              outputPath: tempThumbVideoPath,
              duration: 0.25,
              musicPath: backgroundMusicFile // Usamos la música real
            })

            // Espera breve para asegurar escritura del thumbnail
            await sleep(500)
            videosToConcat.push(tempThumbVideoPath)
          }
        }

        // Concatenar Final
        if (videosToConcat.length > 1) {
          console.log(`      🔨 Ensamblando ${platform.id}...`)
          await concatVideos({
            inputPaths: videosToConcat,
            outputPath: finalOutputPath
          })
          console.log(`      ✨ Listo: ${shortConfig.name}_${platform.id}.mp4`)
        } else {
          fs.copyFileSync(baseVerticalPath, finalOutputPath)
        }

        // Limpieza del thumbnail temporal
        if (tempThumbVideoPath) {
          await sleep(200)
          safeDelete(tempThumbVideoPath)
        }
      }

      // --- LIMPIEZA DE BASES ---
      // Ahora sí podemos borrar tranquilos
      safeDelete(baseRawPath)
      safeDelete(baseMusicPath)
      safeDelete(baseVerticalPath)
    } catch (error) {
      console.error(`❌ Error en short ${shortConfig.name}:`, error)
    }
  }
}

/**
 * 🔍 HELPER: BUSCADOR DE ARCHIVOS
 * Busca en la carpeta temporal los archivos mp4 y mp3 correspondientes
 * a un rango de IDs.
 */
async function getClipsForShort ({ startId, endId, dirs }: {startId: number, endId: number, dirs: Dirs}): Promise<ShortAssets> {
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

// --- HELPER: BORRADO SEGURO (Mantenlo, es buena práctica) ---
function safeDelete (filePath: string) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (e) {
    /* Ignoramos si no se puede borrar */
    console.log('\n--- Error no-fatal, in safeDelete ---: ', e)
  }
}
