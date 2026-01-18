import { GoogleGenAI, Part } from '@google/genai'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'process'

import { config } from 'dotenv'
config()

// --- CONFIGURACIÓN ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// PROMPT ENGINEERING PRO (Optimizado para Flash + Expresividad)

// PROMPT ENGINEERING (Optimizado para EXPRESIVIDAD EXTREMA)

const STYLE_PREFIX = `
High-quality digital vector illustration, exact YouTube explainer cartoon style
inspired by 'OverSimplified', 'TheOdd1sOut', and modern animated infographics.

CRITICAL STYLE RULES (DO NOT IGNORE):
1. CHARACTERS:
   - Stick figures with clean white round heads.
   - Limbs are simple lines but VERY expressive.
   - Body language must be exaggerated and dynamic (leaning, jumping, pointing, shaking).

2. EXPRESSIONS (ABSOLUTELY ESSENTIAL):
   - Eyes are NOT dots.
   - Use big white eyes with tiny pupils for shock.
   - Angled eyebrows for anger.
   - Squinting eyes for confusion or suspicion.
   - Tears, sweat drops, motion lines when appropriate.
   - Mouths must be LARGE and readable (open shouting, squiggly confusion, sharp anger).

3. LINE ART:
   - Thick, uniform black outlines on ALL objects.
   - Clean vector look, no sketchiness.

4. COLORS:
   - Flat, solid, vibrant colors ONLY.
   - High contrast between characters and background.

5. COMPOSITION (VERY IMPORTANT):
   - Clear foreground, midground, and background layers.
   - Scene must feel full, not empty.
   - Add secondary visual elements to support the idea.

6. ENERGY & MOTION:
   - Always include motion lines, impact lines, sound waves, or action indicators.
   - Scene should feel like a paused animation frame, not a static pose.

7. CAMERA:
   - Use cinematic framing (close-up, extreme close-up, wide shot, slight angle).
   - Avoid perfectly centered boring shots unless explicitly requested.
`

const CHARACTER_DESC = `
a highly expressive stick figure character with a white round head,
wearing a BRIGHT CYAN BLUE hoodie.
The character acts like a dramatic cartoon actor,
with exaggerated gestures, leaning posture, and strong emotions.
`

const NEGATIVE_PROMPT = `
photorealistic, 3d, ultra-detailed, realistic anatomy, soft shading,
gradients, cinematic lighting, depth of field blur, anime, manga,
sketchy lines, thin outlines, pastel colors, empty background,
static pose, boring composition, lifeless, low energy
`

// Ruta de tu imagen de referencia
const STYLE_REF_PATH = '../data/style_reference.png'

interface ImageGenOptions {
  model?: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'
  aspectRatio?: '16:9'
}
interface imageGenerator {
  options?: ImageGenOptions,
  rawPrompt: string,
  outputPath: string
}
interface imageGenerator {
  options?: ImageGenOptions,
  rawPrompt: string,
  outputPath: string
}
export async function imageGenerator ({ rawPrompt, outputPath, options = {} }: imageGenerator) {
  console.log(`🎨 Generando: "${rawPrompt.substring(0, 30)}..."`)

  // 1. Preparamos el Prompt de Texto
  let textPrompt = STYLE_PREFIX + rawPrompt + '. ' + NEGATIVE_PROMPT

  if (rawPrompt.includes('blue hoodie')) {
    textPrompt = textPrompt.replace('stick figure wearing a bright blue hoodie', CHARACTER_DESC)
  }

  try {
    // --- SELECCIÓN DE MODELO ---
    // Puedes cambiar esto manualmente o pasarlo en 'options.model' desde main.ts
    // "gemini-3-pro-image-preview" (Mejor calidad, soporta referencia)
    // "gemini-2.5-flash-image" (Más rápido)
    const model = options.model || 'gemini-2.5-flash-image'

    // 2. Preparamos las PARTES del contenido
    const parts: Part[] = [{ text: textPrompt }]

    // LÓGICA DE REFERENCIA DE IMAGEN
    // Solo añadimos la imagen de referencia si usamos el modelo PRO y el archivo existe
    if (model.includes('pro') && fs.existsSync(STYLE_REF_PATH)) {
      const refImageBuffer = fs.readFileSync(STYLE_REF_PATH)
      const refImageBase64 = refImageBuffer.toString('base64')

      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: refImageBase64
        }
      })
    }

    const contents = { parts }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: options.aspectRatio || '16:9',
          // Flash no soporta imageSize, Pro sí. Lo manejamos dinámico.
          ...(model.includes('pro') ? { imageSize: '2K' } : {})
        },
        candidateCount: 1
      }
    })

    // 4. Guardar Resultado
    const candidate = response.candidates?.[0]
    const part = candidate?.content?.parts?.[0]

    if (part && part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, 'base64')
      await fs.ensureDir(path.dirname(outputPath))
      await fs.outputFile(outputPath, buffer)
      console.log(`✅ Imagen guardada: ${outputPath}`)
    } else {
      console.error('⚠️ La API respondió pero no generó imagen. Respuesta:', JSON.stringify(response, null, 2))
    }
  } catch (error) {
    console.error('❌ Error CRÍTICO en Gemini:')
    console.error(`   Mensaje: ${error.message}`)
    if (error.response) {
      console.error(`   Detalle API: ${JSON.stringify(error.response, null, 2)}`)
    }
  }
}

// BLOQUE DE PRUEBA
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    console.log('🧪 Iniciando prueba...')
    const testPrompt = 'stick figure in blue hoodie saying hello'
    const testOutput = '../output/test.png'
    await fs.ensureDir('../output')
    await imageGenerator({ rawPrompt: testPrompt, outputPath: testOutput })
  })()
}
