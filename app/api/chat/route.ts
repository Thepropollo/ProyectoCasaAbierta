import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { COCKTAIL_RECIPES, PUMP_CONFIG, getIngredientPump, INGREDIENT_EMOTES } from '@/lib/cocktails';

// ============================================
// CONFIGURACIÓN RASPBERRY PI
// ============================================
const RASPBERRY_PI_CONFIG = {
  host: '192.168.12.120',
  port: 5000,
  endpoint: '/hacer_trago'
};

const getRaspberryUrl = () =>
  `http://${RASPBERRY_PI_CONFIG.host}:${RASPBERRY_PI_CONFIG.port}${RASPBERRY_PI_CONFIG.endpoint}`;

function generateRaspberryPayload(recipe: any, cocktailId: string) {
  const pumps: any = {};
  let totalMl = 0;

  for (const [ingredientName, ml] of Object.entries(recipe.ingredients)) {
    const pumpKey = getIngredientPump(ingredientName);
    if (!pumpKey) continue;

    const pumpConfig = PUMP_CONFIG[pumpKey as keyof typeof PUMP_CONFIG];
    const mlValue = ml as number;
    const durationMs = (mlValue / pumpConfig.ml_per_second) * 1000;

    pumps[pumpKey] = {
      gpio_pin: pumpConfig.gpio_pin,
      ingredient: ingredientName,
      ml: mlValue,
      duration_ms: Math.round(durationMs)
    };

    totalMl += mlValue;
  }

  return {
    recipe_id: cocktailId,
    recipe_name: recipe.name,
    pumps,
    total_ml: totalMl,
    timestamp: Date.now()
  };
}

async function sendToRaspberryPi(payload: any) {
  try {
    const url = getRaspberryUrl();
    console.log(`🍹 Enviando payload a Raspberry Pi: ${url}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Respuesta de Raspberry Pi:', result);
    return result;
  } catch (error: any) {
    console.error('❌ Error al enviar a Raspberry Pi:', error.message);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key no configurada' },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey });

    // Construir lista de cócteles para el prompt
    const cocktailList = Object.entries(COCKTAIL_RECIPES)
      .map(([id, r]) => `- ID: "${id}" -> Nombre: "${(r as any).name}" (${(r as any).description})`)
      .join('\n');

    const systemPrompt = `Eres Cocktail AI, un barman experto y carismático. Tu trabajo es recomendar bebidas y, SOLO cuando estés 100% seguro de que el usuario quiere que se prepare una bebida específica AHORA MISMO, emitir la orden de preparación.

**INVENTARIO DISPONIBLE:**
${Object.entries(PUMP_CONFIG).map(([_, p]) => `- ${p.ingredient.replace('_', ' ')}`).join('\n')}

**MENÚ DE CÓCTELES:**
${cocktailList}

**REGLAS DE INTERACCIÓN:**
1. Sé breve, amable y usa emojis 🍹.
2. Si el usuario pide una recomendación, sugiere algo del menú pero NO lo sirvas todavía.
3. Si el usuario pide un trago (ej: "Quiero una sangría"), DEBES PREGUNTAR si lo quiere "tal cual" o con alguna modificación, o simplemente confirmar "¿Te sirvo una Sangría entonces?".
4. SOLO sirve el trago si el usuario confirma explícitamente (ej: "Sí", "Tal cual", "Dale", "Por favor", o si dice el nombre del trago de forma imperativa como "Dame una Coca Cola").
5. Para servir un trago, DEBES incluir un bloque JSON oculto al final de tu respuesta con el ID del cóctel.

**COMANDO DE PREPARACIÓN:**
Para activar la máquina, añade este bloque JSON al final de tu respuesta (el usuario no lo verá, yo lo procesaré):
\`\`\`json
{
  "action": "PREPARE",
  "cocktail_id": "ID_DEL_COCTEL_EXACTO"
}
\`\`\`

**EJEMPLOS:**
User: "¿Qué tienes?"
AI: "Tenemos Tinto de Verano, Sangría, vinos y refrescos. ¿Te apetece algo fresco? 🍹" (SIN JSON)

User: "Dame una Sangría"
AI: "¿La quieres sola o preparada con Fanta? 🍷" (SIN JSON)

User: "Preparada"
AI: "¡Marchando una Sangría Preparada! 🚀"
\`\`\`json
{ "action": "PREPARE", "cocktail_id": "sangria_preparada" }
\`\`\`

User: "Una coca cola"
AI: "¡Claro! Una Coca-Cola bien fría saliendo. 🥤"
\`\`\`json
{ "action": "PREPARE", "cocktail_id": "coca_cola" }
\`\`\`
`;

    // Construir historial de conversación para Groq
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Llamar a Groq con historial
    const completion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5, // Un poco más creativo pero preciso
    });

    let responseText = completion.choices[0]?.message?.content || "";
    let finalResponseText = responseText;
    let command: { action: string; cocktail_id: string } | null = null;

    // Detectar y extraer bloque JSON
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        command = JSON.parse(jsonMatch[1]);
        // Quitar el JSON de la respuesta visible al usuario
        finalResponseText = responseText.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error("Error parseando JSON del LLM:", e);
      }
    }

    // Preparar respuesta base
    const finalResponse: any = {
      text: finalResponseText,
      shouldPrepare: false,
      recipe: null,
      raspberryPayload: null,
      raspberryResponse: null
    };

    // Procesar comando si existe
    if (command && command.action === 'PREPARE' && command.cocktail_id) {
      const recipe = COCKTAIL_RECIPES[command.cocktail_id as keyof typeof COCKTAIL_RECIPES];

      if (recipe) {
        console.log(`🤖 LLM ordenó preparar: ${command.cocktail_id}`);
        finalResponse.shouldPrepare = true;
        finalResponse.recipe = recipe;
        finalResponse.raspberryPayload = generateRaspberryPayload(recipe, command.cocktail_id);

        console.log('🍹 RASPBERRY PI PAYLOAD:', JSON.stringify(finalResponse.raspberryPayload, null, 2));

        // Enviar al Raspberry Pi
        try {
          // Nota: Podríamos hacer esto asíncrono si no queremos esperar la respuesta
          // pero es mejor confirmar que se envió.
          const raspberryResult = await sendToRaspberryPi(finalResponse.raspberryPayload);
          finalResponse.raspberryResponse = raspberryResult;
        } catch (error: any) {
          console.error('❌ Error al enviar al Raspberry Pi:', error.message);
          finalResponse.text += "\n\n(⚠️ Hubo un error de conexión con la máquina, pero tu orden fue procesada).";
          finalResponse.raspberryResponse = {
            error: true,
            message: `Error al comunicarse con el Raspberry Pi: ${error.message}`
          };
        }
      } else {
        console.warn(`⚠️ LLM intentó preparar ID inválido: ${command.cocktail_id}`);
      }
    }

    return NextResponse.json(finalResponse);
  } catch (error: any) {
    console.error('Error en chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando el mensaje' },
      { status: 500 }
    );
  }
}
