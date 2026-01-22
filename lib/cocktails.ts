// ============================================
// lib/cocktails.ts - Configuración Centralizada de Cócteles y Bombas
// ============================================

// Configuración de bombas IoT (Raspberry Pi)
export const PUMP_CONFIG = {
  pump_1: {
    id: 1,
    ingredient: 'vino_tinto',
    gpio_pin: 17,
    ml_per_second: 4.7
  },
  pump_2: {
    id: 2,
    ingredient: 'vino_blanco',
    gpio_pin: 27,
    ml_per_second: 4.2
  },
  pump_3: {
    id: 3,
    ingredient: 'sangria',
    gpio_pin: 22,
    ml_per_second: 4.7
  },
  pump_4: {
    id: 4,
    ingredient: 'vino_rosa',
    gpio_pin: 23,
    ml_per_second: 4.7
  },
  pump_5: {
    id: 5,
    ingredient: 'coca_cola',
    gpio_pin: 24,
    ml_per_second: 4.1
  },
  pump_6: {
    id: 6,
    ingredient: 'fanta',
    gpio_pin: 25,
    ml_per_second: 1.2
  }
};

// Determinar modo de operación (JURADO vs NORMAL)
// Si COCKTAIL_MODE es 'JURADO', se sirven cantidades reducidas.
const IS_JURADO = process.env.COCKTAIL_MODE === 'JURADO';

console.log(`🍹 MODO DE COCTELES: ${IS_JURADO ? 'JURADO (Degustación)' : 'NORMAL (Completo)'}`);

/**
 * Helper para seleccionar cantidad según el modo.
 * @param val1 Valor 1 (Normalmente menor/degustación)
 * @param val2 Valor 2 (Normalmente mayor/completo)
 */
function q(val1: number, val2: number): number {
  // Si es JURADO, el usuario pidió que tome los SEGUNDOS valores (val2).
  // Si es NORMAL (default), toma los PRIMEROS (val1).
  return IS_JURADO ? val2 : val1;
}

// Recetas de cócteles disponibles
export const COCKTAIL_RECIPES = {
  tinto_de_verano: {
    name: 'Calimocho',
    description: 'Vino tinto refrescante con Coca-Cola',
    ingredients: {
      "vino_tinto": q(25, 90),
      "coca_cola": q(45, 120)
    }
  },
  sangria: {
    name: 'Sangría',
    description: 'Sangría sola',
    ingredients: {
      "sangria": q(30, 100)
    }
  },
  vino_blanco_spritz: {
    name: 'Vino Blanco Spritz',
    description: 'Vino blanco con un toque dulce de Fanta',
    ingredients: {
      "vino_blanco": q(45, 90),
      "fanta": q(30, 120)
    }
  },
  sunset_mix: {
    name: 'Sunset Mix',
    description: 'Mezcla frutal de vino rosa, fanta',
    ingredients: {
      "vino_rosa": q(40, 90),
      "fanta": q(40, 120),
    }
  },
  vino_tinto: {
    name: 'Vino Tinto',
    description: 'Vino tinto',
    ingredients: {
      "vino_tinto": q(30, 100)
    }
  },
  vino_rosa: {
    name: 'Vino Rosa',
    description: 'Vino rosa',
    ingredients: {
      "vino_rosa": q(30, 100)
    }
  },
  vino_blanco: {
    name: 'Vino Blanco',
    description: 'Vino blanco',
    ingredients: {
      "vino_blanco": q(30, 100)
    }
  },
  coca_cola: {
    name: 'Coca-Cola',
    description: 'Coca-Cola',
    ingredients: {
      "coca_cola": q(75, 120)
    }
  },
  fanta: {
    name: 'Fanta',
    description: 'Fanta',
    ingredients: {
      "fanta": q(75, 120)
    }
  }
};

// Mapeo de ingredientes a bombas
export function getIngredientPump(ingredient: string): string | null {
  for (const [pumpKey, pumpConfig] of Object.entries(PUMP_CONFIG)) {
    if (pumpConfig.ingredient === ingredient) {
      return pumpKey;
    }
  }
  return null;
}

// Obtener lista de cócteles disponibles
export function getAvailableCocktails() {
  return Object.entries(COCKTAIL_RECIPES).map(([id, recipe]) => ({
    id,
    ...recipe
  }));
}

// Mapeo de ingredientes a emotes
export const INGREDIENT_EMOTES: { [key: string]: string } = {
  'vino_tinto': '🍷',
  'vino_blanco': '🥂',
  'sangria': '🍹',
  'vino_rosa': '🍾',
  'coca_cola': '🥤',
};
