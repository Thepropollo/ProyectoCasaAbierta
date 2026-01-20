// ============================================
// lib/cocktails.ts - Configuración Centralizada de Cócteles y Bombas
// ============================================

// Configuración de bombas IoT (Raspberry Pi)
export const PUMP_CONFIG = {
  pump_1: {
    id: 1,
    ingredient: 'vino_tinto',
    gpio_pin: 17,
    ml_per_second: 10
  },
  pump_2: {
    id: 2,
    ingredient: 'vino_blanco',
    gpio_pin: 27,
    ml_per_second: 10
  },
  pump_3: {
    id: 3,
    ingredient: 'sangria',
    gpio_pin: 22,
    ml_per_second: 10
  },
  pump_4: {
    id: 4,
    ingredient: 'vino_rosa_espumoso',
    gpio_pin: 23,
    ml_per_second: 10
  },
  pump_5: {
    id: 5,
    ingredient: 'fanta',
    gpio_pin: 24,
    ml_per_second: 10
  },
  pump_6: {
    id: 6,
    ingredient: 'coca_cola',
    gpio_pin: 25,
    ml_per_second: 10
  }
};

// Recetas de cócteles disponibles
export const COCKTAIL_RECIPES = {
  tinto_de_verano: {
    name: 'Tinto de Verano',
    description: 'Vino tinto refrescante con Fanta',
    ingredients: {
      "vino_tinto": 45,
      "fanta": 45
    }
  },
  sangria_preparada: {
    name: 'Sangría Preparada',
    description: 'La clásica sangría con un toque cítrico y dulce',
    ingredients: {
      "sangria": 50,
      "fanta": 25
    }
  },
  sangria: {
    name: 'Sangría',
    description: 'Sangría sola',
    ingredients: {
      "sangria": 50
    }
  },
  vino_blanco_spritz: {
    name: 'Vino Blanco Spritz',
    description: 'Vino blanco con un toque dulce de Fanta',
    ingredients: {
      "vino_blanco": 45,
      "fanta": 30
    }
  },
  sunset_mix: {
    name: 'Sunset Mix',
    description: 'Mezcla frutal de vino rosa, fanta y naranja',
    ingredients: {
      "vino_rosa_espumoso": 30,
      "fanta": 30,
    }
  },
  vino_tinto: {
    name: 'Vino Tinto',
    description: 'Vino tinto',
    ingredients: {
      "vino_tinto": 600
    }
  },
  vino_rosa_espumoso: {
    name: 'Vino Rosa Espumoso',
    description: 'Vino rosa espumoso',
    ingredients: {
      "vino_rosa_espumoso": 45
    }
  },
  vino_blanco: {
    name: 'Vino Blanco',
    description: 'Vino blanco',
    ingredients: {
      "vino_blanco": 45
    }
  },
  coca_cola: {
    name: 'Coca-Cola',
    description: 'Coca-Cola',
    ingredients: {
      "coca_cola": 45
    }
  },
  fanta: {
    name: 'Fanta',
    description: 'Fanta',
    ingredients: {
      "fanta": 45
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
  'vino_rosa_espumoso': '🍾',
  'fanta': '🍊',
  'jugo_naranja': '🍊',
};
