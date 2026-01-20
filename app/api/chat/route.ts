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

function detectCocktailRequest(text: string) {
  const lowerText = text.toLowerCase();

  // Detectar confirmación explícita
  // Mejorado para capturar "coca-cola", "tinto de verano", etc.
  const confirmPattern = /confirmar\s+(?:pedido\s+(?:de\s+)?)?([\w\-\s]+)/i;
  const confirmMatch = text.match(confirmPattern);

  console.log(`🔍 Analizando mensaje: "${text}"`);

  if (confirmMatch) {
    const capturedName = confirmMatch[1].trim().toLowerCase();
    console.log(`✅ Patrón de confirmación detectado. Nombre capturado: "${capturedName}"`);

    // 1. Búsqueda exacta por KEY
    if (COCKTAIL_RECIPES[capturedName as keyof typeof COCKTAIL_RECIPES]) {
      console.log(`🎯 Match exacto por KEY: ${capturedName}`);
      return { cocktailId: capturedName, recipe: COCKTAIL_RECIPES[capturedName as keyof typeof COCKTAIL_RECIPES], confirmed: true };
    }

    // 2. Búsqueda por coincidencia en KEY o NOMBRE
    for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
      const recipeName = (recipe as any).name.toLowerCase();
      // Chequear si lo capturado está contenido en el nombre o key, o viceversa
      if (recipeName.includes(capturedName) || key.includes(capturedName) || capturedName.includes(recipeName) || capturedName.includes(key)) {
        console.log(`🎯 Match por coincidencia: "${capturedName}" -> ${key} (${recipeName})`);
        return { cocktailId: key, recipe, confirmed: true };
      }
    }
    console.log(`⚠️ Confirmación detectada pero no se encontró coctel para: "${capturedName}"`);
  } else {
    console.log("ℹ️ No se detectó patrón de confirmación explícita");
  }

  // 3. Confirmación implícita por nombre exacto
  // Si el mensaje es SOLO el nombre del trago (o muy parecido), asumimos confirmación.
  const cleanText = lowerText.trim().replace(/[^\w\s\-\u00C0-\u00FF]/g, '');

  for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    const name = (recipe as any).name.toLowerCase();

    // Lista de variaciones aceptadas para confirmación directa
    const acceptedVariations = [
      name,
      key,
      key.replace('_', ' '),
      // Variaciones comunes
      name + " por favor",
      "dame " + name,
      "quiero " + name,
      "un " + name,
      "una " + name
    ];

    // Check exact match with variations
    if (acceptedVariations.some(v => cleanText.includes(v) && cleanText.length < v.length + 10)) {
      console.log(`🚀 Match directo (implícito boost): "${cleanText}" para ${key}`);
      return { cocktailId: key, recipe, confirmed: true };
    }

    // Fix especifico coca-cola
    if (key === 'coca_cola' && (cleanText.includes('cocacola') || cleanText.includes('coca-cola'))) {
      console.log(`🚀 Match directo Coca-Cola: "${cleanText}"`);
      return { cocktailId: key, recipe, confirmed: true };
    }

    // Fix especifico vinos
    if (key.includes('vino') && cleanText.includes(name)) {
      console.log(`🚀 Match directo Vino: "${cleanText}"`);
      return { cocktailId: key, recipe, confirmed: true };
    }
  }

  // Búsqueda normal (seguimos retornando false para intents ambiguos como "quiero un...")
  for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    if (lowerText.includes((recipe as any).name.toLowerCase()) || lowerText.includes(key)) {
      return { cocktailId: key, recipe, confirmed: false };
    }
  }

  const keywords = ['quiero', 'dame', 'prepara', 'hazme', 'quisiera', 'me gustaría'];
  const hasCocktailIntent = keywords.some(keyword => lowerText.includes(keyword));

  return hasCocktailIntent ? { intent: 'request', cocktailId: null, confirmed: false } : null;
}

function generateRaspberryPayload(recipe: any, cocktailId: string) {
  // ... (unchanged)
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
    const cocktailRequest = detectCocktailRequest(message);
    const isFirstMessage = conversationHistory.length === 0;

    const systemPrompt = `Eres un barman profesional AI amable.
**INGREDIENTES:**
${Object.entries(PUMP_CONFIG).map(([_, p]) => `- ${p.ingredient.replace('_', ' ')}`).join('\n')}

**CÓCTELES:**
${Object.entries(COCKTAIL_RECIPES).map(([_, r]) => `- **${(r as any).name}**: ${Object.keys((r as any).ingredients).join(', ')}`).join('\n')}

**INSTRUCCIONES:**
1. Sé conciso (max 200 chars).
2. Si el usuario dice SOLO el nombre de un trago (ej: "Fanta"), asume que lo quiere: CONFIRMA que lo estás preparando.
3. Si dice "Quiero un [trago]", pídele confirmación o dile "Escribe el nombre del trago para servirlo".
4. Usa emojis 🍹.

**SI EL SISTEMA YA ESTÁ PREPARANDO EL TRAGO (detectado automáticamente):**
- Di algo como: "¡Marchando un [Trago]! 🚀" o "Preparando tu bebida..."

**EJEMPLOS:**
User: "Coca cola"
Tu: "¡Entendido! Sirviendo Coca-Cola bien fría 🥤"

User: "Hola"
Tu: "¡Hola! ¿Qué te sirvo hoy? Tenemos Tinto de Verano, Fanta..."`;

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
      model: 'llama-3.3-70b-versatile', // Modelo actualizado
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Preparar respuesta
    const finalResponse: any = {
      text: responseText,
      shouldPrepare: false,
      recipe: null,
      raspberryPayload: null,
      raspberryResponse: null
    };

    // Si se detectó un cóctel Y está confirmado, preparar y enviar
    if (cocktailRequest?.cocktailId && cocktailRequest.confirmed) {
      const recipe = COCKTAIL_RECIPES[cocktailRequest.cocktailId as keyof typeof COCKTAIL_RECIPES];
      finalResponse.shouldPrepare = true;
      finalResponse.recipe = recipe;
      finalResponse.raspberryPayload = generateRaspberryPayload(recipe, cocktailRequest.cocktailId);

      console.log('🍹 RASPBERRY PI PAYLOAD:', JSON.stringify(finalResponse.raspberryPayload, null, 2));

      // Enviar al Raspberry Pi
      try {
        const raspberryResult = await sendToRaspberryPi(finalResponse.raspberryPayload);
        finalResponse.raspberryResponse = raspberryResult;
        console.log('✅ Cóctel enviado a preparar exitosamente');
      } catch (error: any) {
        console.error('❌ Error al enviar al Raspberry Pi:', error.message);
        finalResponse.raspberryResponse = {
          error: true,
          message: `Error al comunicarse con el Raspberry Pi: ${error.message}`
        };
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
