import fs from 'fs-extra'
import path from 'path'

import { mergeClipsXfade } from './mergeClipsXfade'
import { addBackgroundMusic } from './addBackgroundMusic'
import { createVerticalVideo } from './createVerticalVideo'
import {
  BACKGROUND_VOLUME_AUDIO,
  ZOOM_FACTOR
} from '../constants'
import { sleep } from '../utils/sleep'
import { Dirs } from './main'

/**
 * 🎞️ FASE PRINCIPAL: MONTAJE DEL VIDEO LARGO
 * 1. Une todos los clips.
 * 2. Añade música de fondo.
 * 3. Crea una versión vertical completa.
 */
export async function createMainVideoPipeline ({ clipsPaths, videoDurations, dirs }: {clipsPaths: string[], videoDurations: number[], dirs: Dirs}): Promise<void> {
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
